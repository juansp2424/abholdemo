import type { FastifyInstance } from "fastify";
import {
  businessUrl,
  normalizeCode,
  MANUAL_TRANSITIONS,
  ORDER_STATUSES,
  type Attendance,
  type DaySlotList,
  type OrderDetail,
  type OrderFilter,
  type OrderStatus,
  type OrderSummary,
  type BusinessInfo,
} from "@abholdemo/shared";
import { generateCode } from "../code.js";
import { isDateString, iso, toDateString } from "../clock.js";
import type { Ctx } from "../context.js";
import { actorOf, addMessage, applyStatus, logStatus, toDetail, toSummary } from "../domain.js";
import type { OrderRec, UserRec } from "../types.js";
import { EMAIL_ERROR, PHONE_ERROR, asObject, fail, invalid, isEmail, isPhone, optDate, optText } from "../validation.js";

const FILTERS: OrderFilter[] = ["alle", "offen", "abholbereit", "ueberfaellig", "heute_abgeholt"];
const PHOTO_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_PHOTO_BYTES = 3_000_000;

export function orderRoutes(app: FastifyInstance, ctx: Ctx) {
  const db = () => ctx.store.db;

  const findOrder = (id: string): OrderRec =>
    db().orders.find((o) => o.id === id) ?? fail(404, "NOT_FOUND", "Auftrag nicht gefunden.");

  app.get("/api/betrieb/business", async (): Promise<BusinessInfo> => {
    const s = db().settings;
    return { name: s.name, webname: s.webname, logoDataUrl: s.logoDataUrl, customerUrl: businessUrl(s.webname), quickCategories: s.quickCategories ?? [] };
  });

  app.get("/api/betrieb/orders", async (req): Promise<OrderSummary[]> => {
    const query = req.query as { filter?: string; q?: string };
    const filter = (query.filter ?? "alle") as OrderFilter;
    if (!FILTERS.includes(filter)) invalid("Dieser Filter ist unbekannt.");
    const now = ctx.now();
    const today = toDateString(now);
    const q = (query.q ?? "").trim();
    const qCode = normalizeCode(q);
    const qName = q.toLowerCase();

    const matches = (o: OrderRec) => {
      switch (filter) {
        case "offen":
          return o.status === "ANGENOMMEN" || o.status === "IN_ARBEIT";
        case "abholbereit":
          return o.status === "ABHOLBEREIT";
        case "ueberfaellig":
          return o.status === "UEBERFAELLIG";
        case "heute_abgeholt":
          return o.status === "ABGEHOLT" && !!o.pickedUpAt && toDateString(Date.parse(o.pickedUpAt)) === today;
        default:
          return true;
      }
    };
    const searchHit = (o: OrderRec) =>
      !q || o.code.includes(qCode) || (!!o.customerName && o.customerName.toLowerCase().includes(qName));

    const seq = (o: OrderRec) => Number(o.id.slice(1));
    return db()
      .orders.filter((o) => matches(o) && searchHit(o))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || seq(b) - seq(a))
      .map((o) => toSummary(db(), o, now));
  });

  app.post("/api/betrieb/orders", async (req, reply): Promise<OrderDetail> => {
    const body = asObject(req.body);
    const item = optText(body.item, "Der Gegenstand", 120);
    if (!item) invalid("Bitte geben Sie an, was repariert werden soll.");
    const category = optText(body.category, "Die Kategorie", 60);
    const customerName = optText(body.customerName, "Der Name", 80);
    const customerEmail = optText(body.customerEmail, "Die Mailadresse", 120);
    if (customerEmail && !isEmail(customerEmail)) invalid(EMAIL_ERROR);
    const customerPhone = optText(body.customerPhone, "Die Handynummer", 30);
    if (customerPhone && !isPhone(customerPhone)) invalid(PHONE_ERROR);
    const plannedPickupDate = optDate(body.plannedPickupDate, "Das Abholdatum");
    const estimatedCompletion = optDate(body.estimatedCompletion, "Die voraussichtliche Fertigstellung");

    let photo: { mime: string; data: Buffer } | null = null;
    if (body.photoDataUrl !== undefined && body.photoDataUrl !== null && body.photoDataUrl !== "") {
      const m = typeof body.photoDataUrl === "string" ? PHOTO_RE.exec(body.photoDataUrl) : null;
      if (!m) invalid("Das Foto kann nicht gelesen werden. Erlaubt sind JPG, PNG und WebP.");
      const data = Buffer.from(m![2], "base64");
      if (data.length > MAX_PHOTO_BYTES) invalid("Das Foto ist zu groß.");
      photo = { mime: m![1], data };
    }

    const d = db();
    const now = ctx.now();
    const user = req.user as UserRec;
    const order: OrderRec = {
      id: `o${++d.counters.order}`,
      code: generateCode(ctx.rng, (c) => d.orders.some((o) => o.code === c)),
      item,
      category,
      customerName,
      customerEmail,
      customerPhone,
      plannedPickupDate,
      estimatedCompletion,
      status: "ANGENOMMEN",
      createdAt: iso(now),
      readyAt: null,
      pickedUpAt: null,
      photoMime: photo?.mime ?? null,
      log: [],
      subscription: null,
      consentLog: [],
      booking: null,
      readyMessageSent: false,
      reminderSent: false,
    };
    const actor = actorOf(user);
    logStatus(order, now, null, "ANGENOMMEN", actor);
    if (photo) ctx.store.photos.save(order.id, photo.mime, photo.data);
    d.orders.push(order);
    // R27: status link by mail when staff captured an address (simulated, free)
    if (customerEmail) addMessage(d, order, "STATUSLINK", "MAIL", customerEmail, now);
    reply.code(201);
    return toDetail(d, ctx.store.photos, order, now);
  });

  app.get("/api/betrieb/orders/:id", async (req): Promise<OrderDetail> => {
    const o = findOrder((req.params as { id: string }).id);
    return toDetail(db(), ctx.store.photos, o, ctx.now());
  });

  app.post("/api/betrieb/orders/:id/status", async (req): Promise<OrderDetail> => {
    const o = findOrder((req.params as { id: string }).id);
    const target = asObject(req.body).status;
    if (typeof target !== "string" || !ORDER_STATUSES.includes(target as OrderStatus)) {
      invalid("Dieser Status ist unbekannt.");
    }
    if (!MANUAL_TRANSITIONS[o.status].includes(target as OrderStatus)) {
      fail(409, "INVALID_TRANSITION", "Dieser Statuswechsel ist nicht möglich.");
    }
    const now = ctx.now();
    applyStatus(db(), o, target as OrderStatus, actorOf(req.user as UserRec), now);
    return toDetail(db(), ctx.store.photos, o, now);
  });

  app.get("/api/betrieb/day-slots", async (req): Promise<DaySlotList> => {
    const now = ctx.now();
    const q = (req.query as { date?: string }).date;
    if (q !== undefined && !isDateString(q)) invalid("Das Datum ist ungültig. Bitte JJJJ-MM-TT verwenden.");
    const date = q ?? toDateString(now);
    const entries = db()
      .orders.filter(
        (o) =>
          o.booking &&
          o.status !== "STORNIERT" &&
          (!o.booking.released || o.status === "ABGEHOLT") &&
          toDateString(Date.parse(o.booking.start)) === date,
      )
      .map((o) => {
        const b = o.booking!;
        const attendance: Attendance =
          o.status === "ABGEHOLT" ? "ERSCHIENEN" : Date.parse(b.end) < now ? "NICHT_ERSCHIENEN" : "ERWARTET";
        return { orderId: o.id, code: o.code, start: b.start, end: b.end, status: o.status, attendance };
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    return { date: date as string, entries };
  });
}
