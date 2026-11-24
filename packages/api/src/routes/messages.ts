import type { FastifyInstance } from "fastify";
import { NOTIFY_MAX_LENGTH, contactChannel, type MessageView, type MessagesOverview } from "@abholdemo/shared";
import { toMonthString } from "../clock.js";
import type { Ctx } from "../context.js";
import { addMessage, revokeSubscription, toMessageView } from "../domain.js";
import { asObject, fail, invalid, optText } from "../validation.js";

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function messageRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/betrieb/messages", async (req): Promise<MessagesOverview> => {
    const db = ctx.store.db;
    const q = (req.query as { month?: string }).month;
    if (q !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(q)) invalid("Der Monat ist ungültig. Bitte JJJJ-MM verwenden.");
    const month = q ?? toMonthString(ctx.now());
    const seq = (id: string) => Number(id.slice(1));
    const inMonth = db.messages
      .filter((m) => toMonthString(Date.parse(m.createdAt)) === month)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || seq(b.id) - seq(a.id));

    const counts = new Map<string, number>();
    for (const m of inMonth) if (m.orderId) counts.set(m.orderId, (counts.get(m.orderId) ?? 0) + 1);
    const perOrder = [...counts].map(([orderId, count]) => ({
      orderId,
      orderCode: db.orders.find((o) => o.id === orderId)?.code ?? "",
      count,
    }));
    perOrder.sort((a, b) => b.count - a.count || a.orderCode.localeCompare(b.orderCode));

    return {
      month,
      messages: inMonth.map((m) => toMessageView(db, m)),
      monthTotalEur: round4(inMonth.reduce((sum, m) => sum + m.costEur, 0)),
      monthCount: inMonth.length,
      perOrder,
    };
  });

  // Free text message from staff, e.g. "parts are on order". Goes to the intake contact: mail if captured, else SMS.
  app.post("/api/betrieb/orders/:id/notify", async (req, reply): Promise<MessageView> => {
    const db = ctx.store.db;
    const order = db.orders.find((o) => o.id === (req.params as { id: string }).id);
    if (!order) return fail(404, "NOT_FOUND", "Auftrag nicht gefunden.");
    const text = optText(asObject(req.body).text, "Die Mitteilung", NOTIFY_MAX_LENGTH);
    if (!text) invalid("Bitte schreiben Sie, was der Kunde erfahren soll.");
    if (order.status === "ABGEHOLT" || order.status === "STORNIERT") {
      fail(409, "NOT_ALLOWED", "Zu diesem Auftrag kann keine Mitteilung mehr gesendet werden.");
    }
    const channel = contactChannel(order.customerEmail, order.customerPhone);
    if (!channel) return fail(409, "NOT_ALLOWED", "Für diesen Auftrag ist weder eine Mailadresse noch eine Telefonnummer gespeichert.");
    const recipient = channel === "MAIL" ? order.customerEmail! : order.customerPhone!;
    reply.code(201);
    return toMessageView(db, addMessage(db, order, "MITTEILUNG", channel, recipient, ctx.now(), text!));
  });

  // Demo: the customer answered STOP to an SMS or WhatsApp message.
  app.post("/api/betrieb/messages/:id/simulate-stop", async (req): Promise<MessageView> => {
    const db = ctx.store.db;
    const msg = db.messages.find((m) => m.id === (req.params as { id: string }).id);
    if (!msg) return fail(404, "NOT_FOUND", "Nachricht nicht gefunden.");
    if (msg.type !== "ABHOLBEREIT" && msg.type !== "ERINNERUNG") {
      return fail(409, "NOT_ALLOWED", "Eine STOP Antwort gibt es nur bei Nachrichten, die der Kunde bestellt hat.");
    }
    if (msg.channel === "MAIL") {
      return fail(409, "NOT_ALLOWED", "Eine STOP Antwort gibt es nur bei SMS und WhatsApp.");
    }
    const order = db.orders.find((o) => o.id === msg.orderId);
    if (order) revokeSubscription(order, "STOP", ctx.now());
    msg.stopSimulated = true;
    return toMessageView(db, msg);
  });
}
