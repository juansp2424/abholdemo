import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  CODE_REGEX,
  PHONE_END_LENGTH,
  NEUTRAL_NOT_FOUND_MESSAGE,
  type CentralOrderView,
  RATE_LIMIT_MESSAGE,
  SLOT_STATUSES,
  SUBSCRIBE_STATUSES,
  normalizeCode,
  type Channel,
  type PublicBusiness,
  type PublicOrderView,
  type PublicSlotsResponse,
  type RevokeSource,
} from "@abholdemo/shared";
import { iso } from "../clock.js";
import type { Ctx } from "../context.js";
import { addSubscription, revokeSubscription, toPublicView } from "../domain.js";
import { activeBookings, generateSlotDays } from "../slots.js";
import type { OrderRec } from "../types.js";
import { EMAIL_ERROR, PHONE_ERROR, asObject, fail, invalid, isEmail, isPhone } from "../validation.js";

const CHANNELS: Channel[] = ["MAIL", "SMS", "WHATSAPP"];
const NEUTRAL_404 = { error: { code: "NOT_FOUND", message: NEUTRAL_NOT_FOUND_MESSAGE } };
const RATE_LIMITED = { error: { code: "RATE_LIMITED", message: RATE_LIMIT_MESSAGE } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Device key: socket address. When the socket is loopback (request came through our own dev proxy),
 * the LAST X-Forwarded-For entry, which the proxy appends itself. Earlier entries are client supplied
 * and ignored, so a client cannot choose its own key.
 */
export function clientKey(req: FastifyRequest): string {
  const addr = req.raw.socket.remoteAddress ?? "unknown";
  const loopback = addr === "127.0.0.1" || addr === "::1" || addr.startsWith("::ffff:127.");
  if (loopback || process.env.TRUST_PROXY) {
    const xff = req.headers["x-forwarded-for"];
    const raw = Array.isArray(xff) ? xff.join(",") : xff;
    const last = raw?.split(",").at(-1)?.trim();
    if (last) return last;
  }
  return addr;
}

type Resolved = { order: OrderRec } | { status: number; body: unknown };

export function publicRoutes(app: FastifyInstance, ctx: Ctx) {
  const db = () => ctx.store.db;

  const lastDigits = (phone: string | null) => (phone ?? "").replace(/\D/g, "").slice(-PHONE_END_LENGTH);

  /**
   * Finds an order by code. Unknown, malformed and foreign codes (and a wrong phone ending, when one is
   * required) are one neutral failure and count towards the lock. `webname` undefined means the central page.
   */
  function resolveCode(req: FastifyRequest, rawCode: unknown, webname?: string, phoneEnd?: string): Resolved {
    const key = clientKey(req);
    if (ctx.limiter.isLocked(key)) return { status: 429, body: RATE_LIMITED };
    const code = normalizeCode(typeof rawCode === "string" ? rawCode : "");
    const order =
      (webname === undefined || webname === db().settings.webname) && CODE_REGEX.test(code)
        ? db().orders.find((o) => o.code === code)
        : undefined;
    if (!order || (phoneEnd !== undefined && lastDigits(order.customerPhone) !== phoneEnd)) {
      ctx.limiter.recordFail(key);
      return { status: 404, body: NEUTRAL_404 };
    }
    return { order };
  }

  function resolve(req: FastifyRequest): Resolved {
    const params = req.params as { webname: string; code: string };
    return resolveCode(req, params.code, params.webname);
  }

  /** Same response time for found and not found (R10). */
  async function padded(started: number) {
    const wait = ctx.lookupMinMs - (Date.now() - started);
    if (wait > 0) await sleep(wait);
  }

  const publicBusiness = (): PublicBusiness => {
    const s = db().settings;
    return { name: s.name, webname: s.webname, logoDataUrl: s.logoDataUrl, pickupDeadlineDays: s.pickupDeadlineDays, defaultChannel: s.defaultChannel };
  };

  const ORDER = "/api/public/b/:webname/orders/:code";

  app.get("/api/public/b/:webname", async (req): Promise<PublicBusiness> => {
    const s = db().settings;
    if ((req.params as { webname: string }).webname !== s.webname) {
      return fail(404, "NOT_FOUND", "Diesen Betrieb gibt es nicht.");
    }
    return publicBusiness();
  });

  // Central page: the code alone identifies the business.
  app.get("/api/public/orders/:code", async (req, reply) => {
    const started = Date.now();
    const r = resolveCode(req, (req.params as { code: string }).code);
    await padded(started);
    if ("order" in r) return { business: publicBusiness(), order: toPublicView(db(), r.order) } satisfies CentralOrderView;
    return reply.code(r.status).send(r.body);
  });

  // Central entry by hand: code plus the last digits of the phone number. Nothing personal goes into the URL.
  app.post("/api/public/lookup", async (req, reply) => {
    const started = Date.now();
    const b = asObject(req.body);
    const digits = typeof b.phoneEnd === "string" ? b.phoneEnd.replace(/\D/g, "") : "";
    const r = resolveCode(req, b.code, undefined, digits.length === PHONE_END_LENGTH ? digits : "invalid");
    await padded(started);
    if ("order" in r) return { code: r.order.code };
    return reply.code(r.status).send(r.body);
  });

  app.get(ORDER, async (req, reply) => {
    const started = Date.now();
    const r = resolve(req);
    await padded(started);
    if ("order" in r) return toPublicView(db(), r.order);
    return reply.code(r.status).send(r.body);
  });

  app.post(`${ORDER}/subscribe`, async (req, reply): Promise<PublicOrderView | undefined> => {
    const r = resolve(req);
    if (!("order" in r)) return void reply.code(r.status).send(r.body);
    const o = r.order;
    const b = asObject(req.body);
    if (b.consent !== true) invalid("Bitte setzen Sie den Haken, damit wir Ihnen schreiben dürfen.");
    if (typeof b.channel !== "string" || !CHANNELS.includes(b.channel as Channel)) {
      invalid("Bitte wählen Sie Mail, SMS oder WhatsApp.");
    }
    const channel = b.channel as Channel;
    const contact = typeof b.contact === "string" ? b.contact.trim() : "";
    if (channel === "MAIL" ? !isEmail(contact) : !isPhone(contact)) {
      invalid(channel === "MAIL" ? EMAIL_ERROR : PHONE_ERROR);
    }
    if (!SUBSCRIBE_STATUSES.includes(o.status)) {
      fail(409, "NOT_ALLOWED", "Bescheid sagen lassen geht nur, solange Ihr Auftrag noch nicht fertig ist.");
    }
    addSubscription(o, channel, contact, ctx.now());
    return toPublicView(db(), o);
  });

  app.post(`${ORDER}/unsubscribe`, async (req, reply): Promise<PublicOrderView | undefined> => {
    const r = resolve(req);
    if (!("order" in r)) return void reply.code(r.status).send(r.body);
    const source = asObject(req.body).source;
    if (source !== "LINK" && source !== "STOP") invalid("Bitte geben Sie an, wie abbestellt wird.");
    revokeSubscription(r.order, source as RevokeSource, ctx.now()); // idempotent
    return toPublicView(db(), r.order);
  });

  app.get(`${ORDER}/slots`, async (req, reply): Promise<PublicSlotsResponse | undefined> => {
    const r = resolve(req);
    if (!("order" in r)) return void reply.code(r.status).send(r.body);
    const o = r.order;
    if (!SLOT_STATUSES.includes(o.status)) {
      fail(409, "NOT_ALLOWED", "Abholzeiten gibt es, sobald Ihr Auftrag fertig ist.");
    }
    const s = db().settings;
    const own = o.booking && !o.booking.released ? Date.parse(o.booking.start) : null;
    const days = generateSlotDays(s, ctx.now())
      .map((day) => ({
        date: day.date,
        slots: day.slots
          .map((sl) => ({
            start: iso(sl.start),
            end: iso(sl.end),
            free: s.slotCapacity - activeBookings(db().orders, sl.start),
            isOwn: sl.start === own,
          }))
          .filter((sl) => sl.free > 0 || sl.isOwn)
          .map(({ start, end, free }) => ({ start, end, free })),
      }))
      .filter((day) => day.slots.length > 0);
    return { days };
  });

  app.put(`${ORDER}/slot`, async (req, reply): Promise<PublicOrderView | undefined> => {
    const r = resolve(req);
    if (!("order" in r)) return void reply.code(r.status).send(r.body);
    const o = r.order;
    if (!SLOT_STATUSES.includes(o.status)) {
      fail(409, "NOT_ALLOWED", "Abholzeiten gibt es, sobald Ihr Auftrag fertig ist.");
    }
    const startRaw = asObject(req.body).start;
    const startMs = typeof startRaw === "string" ? Date.parse(startRaw) : NaN;
    const s = db().settings;
    const slot = Number.isNaN(startMs)
      ? undefined
      : generateSlotDays(s, ctx.now())
          .flatMap((d) => d.slots)
          .find((sl) => sl.start === startMs);
    if (!slot) fail(400, "SLOT_INVALID", "Diese Abholzeit gibt es nicht. Bitte wählen Sie eine andere.");
    // Check and write happen synchronously, so there is no double booking.
    if (activeBookings(db().orders, slot!.start, o.id) >= s.slotCapacity) {
      fail(409, "SLOT_FULL", "Diese Abholzeit ist leider schon voll. Bitte wählen Sie eine andere.");
    }
    o.booking = { start: iso(slot!.start), end: iso(slot!.end), bookedAt: iso(ctx.now()), released: false };
    return toPublicView(db(), o);
  });

  app.delete(`${ORDER}/slot`, async (req, reply): Promise<PublicOrderView | undefined> => {
    const r = resolve(req);
    if (!("order" in r)) return void reply.code(r.status).send(r.body);
    const o = r.order;
    if (!SLOT_STATUSES.includes(o.status)) {
      fail(409, "NOT_ALLOWED", "Abholzeiten gibt es, sobald Ihr Auftrag fertig ist.");
    }
    o.booking = null;
    return toPublicView(db(), o);
  });
}
