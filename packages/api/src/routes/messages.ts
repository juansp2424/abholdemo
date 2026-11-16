import type { FastifyInstance } from "fastify";
import type { MessageView, MessagesOverview } from "@abholdemo/shared";
import { toMonthString } from "../clock.js";
import type { Ctx } from "../context.js";
import { revokeSubscription, toMessageView } from "../domain.js";
import { fail, invalid } from "../validation.js";

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
    for (const m of inMonth) counts.set(m.orderId, (counts.get(m.orderId) ?? 0) + 1);
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

  // Demo: the customer answered STOP to an SMS or WhatsApp message.
  app.post("/api/betrieb/messages/:id/simulate-stop", async (req): Promise<MessageView> => {
    const db = ctx.store.db;
    const msg = db.messages.find((m) => m.id === (req.params as { id: string }).id);
    if (!msg) return fail(404, "NOT_FOUND", "Nachricht nicht gefunden.");
    if (msg.channel === "MAIL") {
      return fail(409, "NOT_ALLOWED", "Eine STOP Antwort gibt es nur bei SMS und WhatsApp.");
    }
    const order = db.orders.find((o) => o.id === msg.orderId);
    if (order) revokeSubscription(order, "STOP", ctx.now());
    msg.stopSimulated = true;
    return toMessageView(db, msg);
  });
}
