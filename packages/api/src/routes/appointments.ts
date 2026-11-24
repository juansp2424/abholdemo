import { randomInt } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  CHANNELS_ALL,
  CODE_ALPHABET,
  DROPOFF_ITEM_MAX,
  DROPOFF_MAX_OPEN_PER_PHONE,
  DROPOFF_SERVICE_MAX,
  NEUTRAL_NOT_FOUND_MESSAGE,
  RATE_LIMIT_MESSAGE,
  type AppointmentView,
  type Channel,
  type OrderDetail,
  type PublicAppointment,
  type PublicDropOffInfo,
} from "@abholdemo/shared";
import { iso, isDateString, toDateString } from "../clock.js";
import type { Ctx } from "../context.js";
import { addAppointmentMessage, toAppointmentView, toDetail, toPublicAppointment } from "../domain.js";
import { activeDropOffs, dropOffDays } from "../slots.js";
import type { AppointmentRec, UserRec } from "../types.js";
import { EMAIL_ERROR, PHONE_ERROR, asObject, fail, invalid, isEmail, isPhone, optText } from "../validation.js";
import { insertOrder } from "./orders.js";
import { clientKey } from "./public.js";

const TOKEN_LENGTH = 10;
const NEUTRAL_404 = { error: { code: "NOT_FOUND", message: NEUTRAL_NOT_FOUND_MESSAGE } };
const digits = (phone: string) => phone.replace(/\D/g, "");

/** Customer side: book, view, cancel and rebook a drop-off appointment. No login; the link holds a secret token. */
export function appointmentPublicRoutes(app: FastifyInstance, ctx: Ctx) {
  const db = () => ctx.store.db;

  const checkBusiness = (req: FastifyRequest) => {
    const s = db().settings;
    if ((req.params as { webname: string }).webname !== s.webname) fail(404, "NOT_FOUND", "Diesen Betrieb gibt es nicht.");
    if (!s.dropOffEnabled) fail(409, "NOT_ALLOWED", "Dieser Betrieb bietet gerade keine Termine zum Abgeben an.");
  };

  /** Free windows; `exclude` keeps the customer's own appointment out of the count when rebooking. */
  const freeDays = (exclude?: string) => {
    const s = db().settings;
    return dropOffDays(s, ctx.now())
      .map((day) => ({
        date: day.date,
        slots: day.slots
          .map((sl) => ({ start: iso(sl.start), end: iso(sl.end), free: s.dropOffCapacity - activeDropOffs(db().appointments, sl.start, exclude) }))
          .filter((sl) => sl.free > 0),
      }))
      .filter((day) => day.slots.length > 0);
  };

  /** A requested start must be one of the generated windows and still have room. Check and write happen synchronously. */
  const takeWindow = (startRaw: unknown, exclude?: string) => {
    const startMs = typeof startRaw === "string" ? Date.parse(startRaw) : NaN;
    const slot = Number.isNaN(startMs) ? undefined : dropOffDays(db().settings, ctx.now()).flatMap((d) => d.slots).find((sl) => sl.start === startMs);
    if (!slot) return fail(400, "SLOT_INVALID", "Diesen Termin gibt es nicht. Bitte wählen Sie einen anderen.");
    if (activeDropOffs(db().appointments, slot.start, exclude) >= db().settings.dropOffCapacity) {
      return fail(409, "SLOT_FULL", "Dieser Termin ist leider schon voll. Bitte wählen Sie einen anderen.");
    }
    return slot;
  };

  /** Unknown tokens count towards the lock like unknown order codes. */
  const byToken = (req: FastifyRequest): AppointmentRec | null => {
    const key = clientKey(req);
    if (ctx.limiter.isLocked(key)) fail(429, "RATE_LIMITED", RATE_LIMIT_MESSAGE);
    const token = (req.params as { token: string }).token;
    const a = db().appointments.find((x) => x.token === token);
    if (!a) ctx.limiter.recordFail(key);
    return a ?? null;
  };

  // Central start page: which businesses take online drop-off appointments (one in the demo).
  app.get("/api/public/dropoff-businesses", async () => {
    const s = db().settings;
    return s.dropOffEnabled ? [{ name: s.name, webname: s.webname, logoDataUrl: s.logoDataUrl }] : [];
  });

  app.get("/api/public/b/:webname/dropoff", async (req): Promise<PublicDropOffInfo> => {
    const s = db().settings;
    if ((req.params as { webname: string }).webname !== s.webname) fail(404, "NOT_FOUND", "Diesen Betrieb gibt es nicht.");
    return { enabled: s.dropOffEnabled, services: s.quickCategories, days: s.dropOffEnabled ? freeDays() : [] };
  });

  app.post("/api/public/b/:webname/dropoff", async (req, reply): Promise<PublicAppointment> => {
    checkBusiness(req);
    const key = clientKey(req);
    if (ctx.limiter.isLocked(key)) fail(429, "RATE_LIMITED", RATE_LIMIT_MESSAGE);
    const b = asObject(req.body);
    if (typeof b.website === "string" && b.website.trim()) {
      ctx.limiter.recordFail(key);
      invalid("Die Buchung konnte nicht gespeichert werden.");
    }
    const service = optText(b.service, "Die Leistung", DROPOFF_SERVICE_MAX);
    if (!service) invalid("Bitte wählen Sie, was gemacht werden soll.");
    const item = optText(b.item, "Die Beschreibung", DROPOFF_ITEM_MAX);
    if (!item) invalid("Bitte beschreiben Sie kurz, was Sie bringen, zum Beispiel: Auto, VW Golf.");
    const name = optText(b.customerName, "Der Name", 80);
    if (!name) invalid("Bitte geben Sie Ihren Namen an.");
    const phone = optText(b.customerPhone, "Die Telefonnummer", 30);
    if (!phone || !isPhone(phone)) invalid(PHONE_ERROR);
    const email = optText(b.customerEmail, "Die Mailadresse", 120);
    if (email && !isEmail(email)) invalid(EMAIL_ERROR);
    const channel = b.channel as Channel;
    if (!CHANNELS_ALL.includes(channel)) invalid("Bitte wählen Sie Mail, SMS oder WhatsApp.");
    if (channel === "MAIL" && !email) invalid("Für die Bestätigung per Mail brauchen wir Ihre Mailadresse.");
    const open = db().appointments.filter((a) => a.state === "GEBUCHT" && digits(a.customerPhone) === digits(phone!)).length;
    if (open >= DROPOFF_MAX_OPEN_PER_PHONE) {
      fail(409, "NOT_ALLOWED", `Mit dieser Telefonnummer sind schon ${DROPOFF_MAX_OPEN_PER_PHONE} Termine gebucht. Bitte sagen Sie zuerst einen ab oder rufen Sie an.`);
    }
    const slot = takeWindow(b.start);
    const d = db();
    const now = ctx.now();
    let token = "";
    do token = Array.from({ length: TOKEN_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    while (d.appointments.some((a) => a.token === token));
    const a: AppointmentRec = {
      id: `a${++d.counters.appointment}`, token, start: iso(slot.start), end: iso(slot.end), service: service!, item: item!,
      customerName: name!, customerPhone: phone!, customerEmail: email, channel, state: "GEBUCHT", createdAt: iso(now), orderId: null, reminderSent: false,
    };
    d.appointments.push(a);
    addAppointmentMessage(d, a, "TERMIN_BESTAETIGUNG", now);
    reply.code(201);
    return toPublicAppointment(d, a, now);
  });

  app.get("/api/public/appointments/:token", async (req, reply) => {
    const a = byToken(req);
    if (!a) return reply.code(404).send(NEUTRAL_404);
    return toPublicAppointment(db(), a, ctx.now());
  });

  app.get("/api/public/appointments/:token/slots", async (req, reply) => {
    const a = byToken(req);
    if (!a) return reply.code(404).send(NEUTRAL_404);
    return { days: freeDays(a.id) };
  });

  app.delete("/api/public/appointments/:token", async (req, reply) => {
    const a = byToken(req);
    if (!a) return reply.code(404).send(NEUTRAL_404);
    const now = ctx.now();
    if (!toPublicAppointment(db(), a, now).changeable) fail(409, "NOT_ALLOWED", "Dieser Termin lässt sich nicht mehr absagen.");
    a.state = "ABGESAGT_KUNDE";
    return toPublicAppointment(db(), a, now);
  });

  app.put("/api/public/appointments/:token", async (req, reply) => {
    const a = byToken(req);
    if (!a) return reply.code(404).send(NEUTRAL_404);
    const now = ctx.now();
    if (!toPublicAppointment(db(), a, now).changeable) fail(409, "NOT_ALLOWED", "Dieser Termin lässt sich nicht mehr ändern.");
    const slot = takeWindow(asObject(req.body).start, a.id);
    if (slot.start === Date.parse(a.start)) invalid("Das ist schon Ihr Termin.");
    a.start = iso(slot.start);
    a.end = iso(slot.end);
    a.reminderSent = false;
    addAppointmentMessage(db(), a, "TERMIN_GEAENDERT", now);
    return toPublicAppointment(db(), a, now);
  });
}

/** Staff side: list, turn into an order, no-show, cancel with message. */
export function appointmentRoutes(app: FastifyInstance, ctx: Ctx) {
  const db = () => ctx.store.db;
  const find = (req: FastifyRequest): AppointmentRec =>
    db().appointments.find((a) => a.id === (req.params as { id: string }).id) ?? fail(404, "NOT_FOUND", "Termin nicht gefunden.");
  const mustBeBooked = (a: AppointmentRec) => {
    if (a.state !== "GEBUCHT") fail(409, "NOT_ALLOWED", "Dieser Termin ist nicht mehr offen.");
  };

  app.get("/api/betrieb/appointments", async (req): Promise<AppointmentView[]> => {
    const q = (req.query as { date?: string }).date;
    if (q !== undefined && !isDateString(q)) invalid("Das Datum ist ungültig. Bitte JJJJ-MM-TT verwenden.");
    const date = q ?? toDateString(ctx.now());
    return db()
      .appointments.filter((a) => toDateString(Date.parse(a.start)) === date)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map((a) => toAppointmentView(db(), a));
  });

  // The customer is here: create the order from the booking (item, service, name, contact), then print the tag.
  app.post("/api/betrieb/appointments/:id/convert", async (req, reply): Promise<OrderDetail> => {
    const a = find(req);
    if (a.state !== "GEBUCHT" && a.state !== "NICHT_ERSCHIENEN") fail(409, "NOT_ALLOWED", "Zu diesem Termin gibt es schon einen Auftrag oder er wurde abgesagt.");
    const now = ctx.now();
    const order = insertOrder(ctx, req.user as UserRec, {
      item: a.item.slice(0, 120), category: a.service, customerName: a.customerName, customerEmail: a.customerEmail,
      customerPhone: a.customerPhone, plannedPickupDate: null, estimatedCompletion: null,
    }, now);
    a.state = "ERSCHIENEN";
    a.orderId = order.id;
    reply.code(201);
    return toDetail(db(), ctx.store.photos, order, now);
  });

  app.post("/api/betrieb/appointments/:id/no-show", async (req): Promise<AppointmentView> => {
    const a = find(req);
    mustBeBooked(a);
    a.state = "NICHT_ERSCHIENEN";
    return toAppointmentView(db(), a);
  });

  app.post("/api/betrieb/appointments/:id/cancel", async (req): Promise<AppointmentView> => {
    const a = find(req);
    mustBeBooked(a);
    a.state = "ABGESAGT_BETRIEB";
    addAppointmentMessage(db(), a, "TERMIN_ABSAGE", ctx.now());
    return toAppointmentView(db(), a);
  });
}
