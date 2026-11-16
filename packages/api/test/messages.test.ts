import { describe, expect, it } from "vitest";
import { CHANNEL_COST_EUR, statusUrl } from "@abholdemo/shared";
import { maskContact } from "../src/messages.js";
import { PUB, createOrder, makeEnv, orderId, setStatus } from "./helpers.js";

const messages = async (env: ReturnType<typeof makeEnv>, token: string, qs = "") =>
  (await env.api(token, "GET", `/api/betrieb/messages${qs}`)).json;

describe("masking", () => {
  it("masks mail and phone", () => {
    expect(maskContact("MAIL", "petra@beispiel.de")).toBe("p***@beispiel.de");
    expect(maskContact("SMS", "+49 151 23456712")).toBe("+49 *** ****12");
    expect(maskContact("WHATSAPP", "0151 2345 6789")).toBe("*** ****89");
  });
});

describe("messages", () => {
  it("creates the ABHOLBEREIT message only with an active subscription, and only once", async () => {
    const env = makeEnv();
    const owner = await env.token();
    // no subscription: no message
    const plain = await createOrder(env, owner);
    await setStatus(env, owner, plain.id, "ABHOLBEREIT");
    expect(env.db().messages.filter((m) => m.orderId === plain.id)).toHaveLength(0);

    // revoked subscription: no message
    const revoked = await createOrder(env, owner);
    await env.pub("POST", `${PUB}/orders/${revoked.code}/subscribe`, { channel: "MAIL", contact: "r@beispiel.de", consent: true });
    await env.pub("POST", `${PUB}/orders/${revoked.code}/unsubscribe`, { source: "LINK" });
    await setStatus(env, owner, revoked.id, "ABHOLBEREIT");
    expect(env.db().messages.filter((m) => m.orderId === revoked.id)).toHaveLength(0);

    // active subscription: exactly one
    const sub = await createOrder(env, owner, { item: "Abo Schuh" });
    await env.pub("POST", `${PUB}/orders/${sub.code}/subscribe`, { channel: "MAIL", contact: "kunde@beispiel.de", consent: true });
    await setStatus(env, owner, sub.id, "IN_ARBEIT");
    expect(env.db().messages.filter((m) => m.orderId === sub.id)).toHaveLength(0);
    await setStatus(env, owner, sub.id, "ABHOLBEREIT");
    expect((await setStatus(env, owner, sub.id, "ABHOLBEREIT")).status).toBe(409); // no second one
    await setStatus(env, owner, sub.id, "ABGEHOLT");
    const mine = env.db().messages.filter((m) => m.orderId === sub.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ type: "ABHOLBEREIT", channel: "MAIL", costEur: 0, recipient: "kunde@beispiel.de" });
    const link = statusUrl("schuster-demo", sub.code);
    expect(mine[0].text).toContain(link);
    expect(mine[0].text).toContain(`Ihr Auftrag ${sub.code} bei Schuhmacher Demo ist abholbereit`);
    expect(mine[0].text.endsWith(` Keine Nachricht mehr? Abbestellen: ${link}?abmelden=1`)).toBe(true);
    expect(mine[0].text).not.toContain("Abo Schuh"); // never the item
  });

  it("uses the STOP suffix for SMS and WhatsApp and the template from the settings", async () => {
    const env = makeEnv();
    const owner = await env.token();
    await env.api(owner, "PUT", "/api/betrieb/settings", { ...env.db().settings, messageTemplate: "Hallo, {nummer} ist fertig bei {betrieb}: {link}" });
    const o = await createOrder(env, owner);
    await env.pub("POST", `${PUB}/orders/${o.code}/subscribe`, { channel: "WHATSAPP", contact: "+49 151 00000011", consent: true });
    await setStatus(env, owner, o.id, "ABHOLBEREIT");
    const m = env.db().messages.find((x) => x.orderId === o.id)!;
    expect(m.text).toBe(`Hallo, ${o.code} ist fertig bei Schuhmacher Demo: ${statusUrl("schuster-demo", o.code)} Antworten Sie STOP, dann bekommen Sie keine Nachricht mehr.`);
  });

  it("sends the STATUSLINK on intake with an email, free of charge", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const none = await createOrder(env, owner);
    expect(env.db().messages.filter((m) => m.orderId === none.id)).toHaveLength(0);
    const o = await createOrder(env, owner, { item: "Mit Mail", customerEmail: "kunde@beispiel.de" });
    const view = (await messages(env, owner)).messages.find((m: any) => m.orderId === o.id);
    expect(view).toMatchObject({
      type: "STATUSLINK", channel: "MAIL", recipientMasked: "k***@beispiel.de", costEur: 0,
      deliveryStatus: "ZUGESTELLT_SIMULIERT", orderCode: o.code, link: statusUrl("schuster-demo", o.code),
    });
    expect(view.text).toBe(`Guten Tag, Ihr Auftrag ${o.code} bei Schuhmacher Demo ist angenommen. Den Stand sehen Sie hier: ${statusUrl("schuster-demo", o.code)}`);
    expect(view.text).not.toContain("Mit Mail");
    // the intake mail does not subscribe the customer to the ready message
    await setStatus(env, owner, o.id, "ABHOLBEREIT");
    expect(env.db().messages.filter((m) => m.orderId === o.id)).toHaveLength(1);
  });

  it("creates the reminder via demo advance, once, and marks the order overdue", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const r = await env.api(owner, "POST", "/api/demo/advance", { days: 3 });
    expect(r.status).toBe(200);
    expect(r.json.newlyOverdue).toEqual(["G8UE4R"]);
    expect(r.json.remindersCreated).toBe(1);
    expect(r.json.offsetDays).toBe(3);
    const d = await env.api(owner, "GET", `/api/betrieb/orders/${orderId(env, "G8UE4R")}`);
    expect(d.json.status).toBe("UEBERFAELLIG");
    expect(d.json.log.at(-1)).toMatchObject({ from: "ABHOLBEREIT", to: "UEBERFAELLIG", actorId: null, actorName: "System" });
    const mine = env.db().messages.filter((m) => m.orderId === orderId(env, "G8UE4R"));
    expect(mine.map((m) => m.type)).toEqual(["ABHOLBEREIT", "ERINNERUNG"]);
    expect(mine[1].text).toContain("Bitte holen Sie ihn bald ab");
    expect(mine[1].text.endsWith("Antworten Sie STOP, dann bekommen Sie keine Nachricht mehr.")).toBe(true);
    env.time.value += 3_600_000; // avoid exact boundary of the 14 day deadline
    const again = await env.api(owner, "POST", "/api/demo/advance", { days: 9 });
    expect(again.json.remindersCreated).toBe(0);
    // D3FY6W has no subscription: overdue after 14 days but no reminder
    expect(again.json.newlyOverdue).toContain("D3FY6W");
    expect(env.db().messages.filter((m) => m.orderId === orderId(env, "D3FY6W"))).toHaveLength(0);
    expect(env.db().messages.filter((m) => m.type === "ERINNERUNG")).toHaveLength(2); // RT8WMZ (seed) + G8UE4R
  });

  it("validates advance days", async () => {
    const env = makeEnv();
    const owner = await env.token();
    for (const days of [0, 61, 1.5, "3"]) {
      expect((await env.api(owner, "POST", "/api/demo/advance", { days })).status).toBe(400);
    }
  });

  it("computes costs per channel and the month total", async () => {
    const env = makeEnv();
    const owner = await env.token();
    // seed month 2026-10: WhatsApp 0.0456 + SMS 0.075
    const oct = await messages(env, owner, "?month=2026-10");
    expect(oct.monthCount).toBe(2);
    expect(oct.monthTotalEur).toBe(0.1206);
    for (const m of oct.messages) expect(m.costEur).toBe(CHANNEL_COST_EUR[m.channel as "SMS" | "WHATSAPP"]);
    // current month starts with one seed SMS reminder
    const start = await messages(env, owner);
    expect(start.month).toBe("2026-11");
    expect(start.monthTotalEur).toBe(0.075);
    const channels = [["SMS", "+49 151 00000021"], ["WHATSAPP", "+49 151 00000022"], ["MAIL", "k@beispiel.de"]] as const;
    for (const [channel, contact] of channels) {
      const o = await createOrder(env, owner);
      await env.pub("POST", `${PUB}/orders/${o.code}/subscribe`, { channel, contact, consent: true });
      await setStatus(env, owner, o.id, "ABHOLBEREIT");
    }
    const now = await messages(env, owner);
    expect(now.monthCount).toBe(start.monthCount + 3);
    expect(now.monthTotalEur).toBe(0.075 + 0.075 + 0.0456); // 0.1956
    const costs = now.messages.slice(0, 3).map((m: any) => [m.channel, m.costEur]);
    expect(costs).toEqual(expect.arrayContaining([["SMS", 0.075], ["WHATSAPP", 0.0456], ["MAIL", 0]]));
    expect(now.messages[0].recipientMasked).toMatch(/\*\*\*/);
    expect(now.perOrder.every((p: any) => p.count >= 1)).toBe(true);
    expect((await env.api(owner, "GET", "/api/betrieb/messages?month=abc")).status).toBe(400);
  });
});
