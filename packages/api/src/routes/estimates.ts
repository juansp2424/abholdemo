import type { FastifyInstance } from "fastify";
import {
  ESTIMATE_CHANNELS,
  ESTIMATE_DEFAULT_VALID_DAYS,
  ESTIMATE_DESCRIPTION_MAX,
  ESTIMATE_MAX_CENTS,
  ESTIMATE_STATUSES,
  type EstimateChannel,
  type OrderDetail,
} from "@abholdemo/shared";
import { DAY_MS, iso, toDateString } from "../clock.js";
import type { Ctx } from "../context.js";
import { addMessage, closeEstimate, germanDate, openEstimate, toDetail } from "../domain.js";
import type { OrderRec } from "../types.js";
import { asObject, fail, invalid, optDate, optText } from "../validation.js";

/** Cost estimates, staff side. The customer side lives in public.ts. */
export function estimateRoutes(app: FastifyInstance, ctx: Ctx) {
  const db = () => ctx.store.db;
  const find = (req: { params: unknown }): OrderRec => {
    const id = (req.params as { id: string }).id;
    return db().orders.find((o) => o.id === id) ?? fail(404, "NOT_FOUND", "Auftrag nicht gefunden.");
  };
  const detail = (o: OrderRec) => toDetail(db(), ctx.store.photos, o, ctx.now());

  // Send a new estimate. An open one is replaced (next version).
  app.post("/api/betrieb/orders/:id/estimate", async (req, reply): Promise<OrderDetail> => {
    const o = find(req);
    const body = asObject(req.body);
    if (!ESTIMATE_STATUSES.includes(o.status)) {
      fail(409, "NOT_ALLOWED", "Ein Kostenvoranschlag geht nur, solange der Auftrag noch nicht fertig ist.");
    }
    const cents = body.amountCents;
    if (typeof cents !== "number" || !Number.isInteger(cents) || cents < 1 || cents > ESTIMATE_MAX_CENTS) {
      invalid("Bitte geben Sie einen Betrag zwischen 0,01 und 100.000 Euro an.");
    }
    const description = optText(body.description, "Die Beschreibung", ESTIMATE_DESCRIPTION_MAX);
    if (!description) invalid("Bitte beschreiben Sie kurz, wofür der Betrag gilt.");
    const channel = body.channel as EstimateChannel;
    if (!ESTIMATE_CHANNELS.includes(channel)) invalid("Bitte wählen Sie Mail oder WhatsApp.");
    const to = channel === "MAIL" ? o.customerEmail : o.customerPhone;
    if (!to) invalid(channel === "MAIL" ? "Für diesen Auftrag ist keine Mailadresse gespeichert." : "Für diesen Auftrag ist keine Telefonnummer gespeichert.");
    const now = ctx.now();
    const today = toDateString(now);
    const validUntil = optDate(body.validUntil, "Das Datum") ?? toDateString(now + ESTIMATE_DEFAULT_VALID_DAYS * DAY_MS);
    if (validUntil < today) invalid("Das Datum darf nicht in der Vergangenheit liegen.");

    const prev = openEstimate(o);
    if (prev) closeEstimate(prev, "ZURUECKGEZOGEN", now);
    o.estimates.push({
      version: (o.estimates.at(-1)?.version ?? 0) + 1,
      amountCents: cents as number,
      description: description!,
      validUntil,
      state: "OFFEN",
      channel,
      sentAt: iso(now),
      decidedAt: null,
      decidedVia: null,
      reminderSent: false,
    });
    addMessage(db(), o, "KOSTENVORANSCHLAG", channel, to!, now, germanDate(validUntil));
    reply.code(201);
    return detail(o);
  });

  app.post("/api/betrieb/orders/:id/estimate/withdraw", async (req): Promise<OrderDetail> => {
    const o = find(req);
    const e = openEstimate(o) ?? fail(409, "NOT_ALLOWED", "Es gibt keinen offenen Kostenvoranschlag.");
    closeEstimate(e, "ZURUECKGEZOGEN", ctx.now());
    return detail(o);
  });

  // The customer answered by phone or in the shop: staff records the decision.
  app.post("/api/betrieb/orders/:id/estimate/decide", async (req): Promise<OrderDetail> => {
    const o = find(req);
    const decision = asObject(req.body).decision;
    if (decision !== "FREIGEGEBEN" && decision !== "ABGELEHNT") invalid("Bitte wählen Sie Freigegeben oder Abgelehnt.");
    const e = openEstimate(o) ?? fail(409, "NOT_ALLOWED", "Es gibt keinen offenen Kostenvoranschlag.");
    closeEstimate(e, decision as "FREIGEGEBEN" | "ABGELEHNT", ctx.now());
    e.decidedVia = "BETRIEB";
    return detail(o);
  });
}
