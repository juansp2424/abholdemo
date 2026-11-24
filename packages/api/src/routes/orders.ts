import type { FastifyInstance } from "fastify";
import {
  centralUrl,
  contactChannel,
  COMPLETION_NOTE_MAX,
  ESTIMATE_STATUSES,
  normalizeCode,
  MANUAL_TRANSITIONS,
  ORDER_STATUSES,
  WEEKDAYS,
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
import { actorOf, addMessage, applyStatus, germanDate, logStatus, toAppointmentView, toDetail, toSummary } from "../domain.js";
import type { OrderRec, UserRec } from "../types.js";
import { EMAIL_ERROR, PHONE_ERROR, asObject, fail, invalid, isEmail, isPhone, optDate, optText } from "../validation.js";

const FILTERS: OrderFilter[] = ["alle", "offen", "freigabe", "abholbereit", "ueberfaellig", "heute_abgeholt"];
const PHOTO_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_PHOTO_BYTES = 3_000_000;

export interface NewOrderFields {
  item: string;
  category: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string;
  plannedPickupDate: string | null;
  estimatedCompletion: string | null;
}

/** Creates an order (validated fields) with the status link message. Used by "Neuer Auftrag" and by drop-off appointments. */
export function insertOrder(ctx: Ctx, user: UserRec, f: NewOrderFields, now: number): OrderRec {
  const d = ctx.store.db;
  const order: OrderRec = {
    id: `o${++d.counters.order}`,
    code: generateCode(ctx.rng, (c) => d.orders.some((o) => o.code === c)),
    ...f,
    status: "ANGENOMMEN",
    createdAt: iso(now),
    readyAt: null,
    pickedUpAt: null,
    photoMime: null,
    log: [],
    subscription: null,
    consentLog: [],
    booking: null,
    estimates: [],
    completionLog: [],
    readyMessageSent: false,
    reminderSent: false,
  };
  logStatus(order, now, null, "ANGENOMMEN", actorOf(user));
  d.orders.push(order);
  // R27: status link right at intake: mail if an address was captured, else SMS to the phone number (simulated)
  const linkChannel = contactChannel(f.customerEmail, f.customerPhone)!; // the phone number is required
  addMessage(d, order, "STATUSLINK", linkChannel, linkChannel === "MAIL" ? f.customerEmail! : f.customerPhone, now);
  return order;
}

export function orderRoutes(app: FastifyInstance, ctx: Ctx) {
  const db = () => ctx.store.db;

  const findOrder = (id: string): OrderRec =>
    db().orders.find((o) => o.id === id) ?? fail(404, "NOT_FOUND", "Auftrag nicht gefunden.");

  app.get("/api/betrieb/business", async (): Promise<BusinessInfo> => {
    const s = db().settings;
    return { name: s.name, webname: s.webname, logoDataUrl: s.logoDataUrl, customerUrl: centralUrl(), quickCategories: s.quickCategories ?? [] };
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
        case "freigabe":
          return o.estimates.at(-1)?.state === "OFFEN";
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
    const customerPhone = optText(body.customerPhone, "Die Telefonnummer", 30);
    if (!customerPhone) invalid("Bitte geben Sie die Telefonnummer des Kunden an. Damit können Sie ihm bei Verzögerungen Bescheid sagen.");
    if (!isPhone(customerPhone!)) invalid(PHONE_ERROR);
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

    const now = ctx.now();
    const order = insertOrder(ctx, req.user as UserRec, { item: item!, category, customerName, customerEmail, customerPhone: customerPhone!, plannedPickupDate, estimatedCompletion }, now);
    if (photo) {
      order.photoMime = photo.mime;
      ctx.store.photos.save(order.id, photo.mime, photo.data);
    }
    const d = db();
    reply.code(201);
    return toDetail(d, ctx.store.photos, order, now);
  });

  // New expected completion date, e.g. a part arrives later. Optional message to the intake contact.
  app.post("/api/betrieb/orders/:id/completion", async (req): Promise<OrderDetail> => {
    const o = findOrder((req.params as { id: string }).id);
    const body = asObject(req.body);
    if (!ESTIMATE_STATUSES.includes(o.status)) {
      fail(409, "NOT_ALLOWED", "Das Datum lässt sich nur ändern, solange der Auftrag noch in der Werkstatt ist.");
    }
    const date = optDate(body.date, "Das Datum");
    const now = ctx.now();
    if (date && date < toDateString(now)) invalid("Das Datum darf nicht in der Vergangenheit liegen.");
    const note = optText(body.note, "Der Grund", COMPLETION_NOTE_MAX);
    if (date === o.estimatedCompletion) invalid("Das ist schon das eingetragene Datum.");
    const notify = body.notify === true && !!date;
    const from = o.estimatedCompletion;
    o.estimatedCompletion = date;
    o.completionLog.push({ at: iso(now), from, to: date, note: date ? note : null, notified: notify, actorName: (req.user as UserRec).displayName });
    if (notify) {
      const channel = contactChannel(o.customerEmail, o.customerPhone)!;
      const to = channel === "MAIL" ? o.customerEmail! : o.customerPhone!;
      addMessage(db(), o, "NEUES_DATUM", channel, to, now, `${germanDate(date!)}${note ? `\n${note}` : ""}`);
    }
    return toDetail(db(), ctx.store.photos, o, now);
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
    const completions = db()
      .orders.filter((o) => o.estimatedCompletion === date && o.status !== "STORNIERT")
      .map((o) => ({ orderId: o.id, code: o.code, status: o.status }))
      .sort((a, b) => a.code.localeCompare(b.code));
    const [y, m, d] = (date as string).split("-").map(Number);
    const weekday = WEEKDAYS[(new Date(y, m - 1, d).getDay() + 6) % 7];
    const openingHours = db().settings.openingHours[weekday].map((iv) => ({ ...iv }));
    const dropOffs = db()
      .appointments.filter((a) => (a.state === "GEBUCHT" || a.state === "ERSCHIENEN" || a.state === "NICHT_ERSCHIENEN") && toDateString(Date.parse(a.start)) === date)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map((a) => toAppointmentView(db(), a));
    return { date: date as string, entries, completions, openingHours, dropOffs };
  });
}
