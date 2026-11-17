import { describe, expect, it } from "vitest";
import { PUB, createOrder, makeEnv, setStatus } from "./helpers.js";

const post = (env: ReturnType<typeof makeEnv>, token: string, body: unknown) => env.api(token, "POST", "/api/betrieb/orders", body);

describe("phone number is required at intake", () => {
  it("rejects a missing, empty or invalid phone number", async () => {
    const env = makeEnv();
    const t = await env.token();
    for (const body of [{ item: "Fahrrad" }, { item: "Fahrrad", customerPhone: "  " }, { item: "Fahrrad", customerPhone: null }]) {
      const r = await post(env, t, body);
      expect(r.status).toBe(400);
      expect(r.json.error.code).toBe("VALIDATION");
      expect(r.json.error.message).toContain("Telefonnummer");
    }
    expect((await post(env, t, { item: "Fahrrad", customerPhone: "abc" })).status).toBe(400);
    expect((await post(env, t, { item: "Fahrrad", customerPhone: "0151 234567" })).status).toBe(201);
  });
});

describe("staff message to the customer", () => {
  it("goes by mail when an email was captured, even if a phone number exists", async () => {
    const env = makeEnv();
    const t = await env.token();
    const o = await createOrder(env, t, { item: "Auto, Bremsen", customerEmail: "kunde@beispiel.de", customerPhone: "+49 151 00000011" });
    const r = await env.api(t, "POST", `/api/betrieb/orders/${o.id}/notify`, { text: "Die Bremsbeläge sind bestellt. Es dauert zwei Tage länger." });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ type: "MITTEILUNG", channel: "MAIL", costEur: 0, recipientMasked: "k***@beispiel.de", orderCode: o.code });
    expect(r.json.text).toContain("Die Bremsbeläge sind bestellt. Es dauert zwei Tage länger.");
    expect(r.json.text).toContain(o.code);
    expect(r.json.text).not.toContain("Auto, Bremsen"); // never the item
    expect(env.db().messages.find((m) => m.id === r.json.id)?.recipient).toBe("kunde@beispiel.de");
  });

  it("goes by SMS to the phone number when there is no email", async () => {
    const env = makeEnv();
    const t = await env.token("mitarbeiter"); // staff, not only the owner
    const o = await createOrder(env, t, { item: "Fahrrad, Schlauch", customerPhone: "+49 151 00000077" });
    const r = await env.api(t, "POST", `/api/betrieb/orders/${o.id}/notify`, { text: "  Ersatzteil ist noch nicht da.  " });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ type: "MITTEILUNG", channel: "SMS", costEur: 0.075, recipientMasked: "+49 *** ****77" });
    expect(env.db().messages.find((m) => m.id === r.json.id)?.recipient).toBe("+49 151 00000077");
    expect(r.json.text).toContain("Ersatzteil ist noch nicht da. Den Stand");
    const overview = (await env.api(t, "GET", "/api/betrieb/messages")).json;
    expect(overview.messages.find((m: any) => m.id === r.json.id)).toBeTruthy();
    expect(overview.perOrder.find((p: any) => p.orderCode === o.code).count).toBe(2); // status link SMS at intake and this message
  });

  it("works without any subscription, can be sent repeatedly, and does not use up the one ready message", async () => {
    const env = makeEnv();
    const t = await env.token();
    const o = await createOrder(env, t, { item: "Rad", customerPhone: "+49 151 00000012" });
    const send = (text: string) => env.api(t, "POST", `/api/betrieb/orders/${o.id}/notify`, { text });
    expect((await send("Erste Nachricht")).status).toBe(201);
    expect((await send("Zweite Nachricht")).status).toBe(201);
    await env.pub("POST", `${PUB}/orders/${o.code}/subscribe`, { channel: "MAIL", contact: "k@beispiel.de", consent: true });
    await setStatus(env, t, o.id, "ABHOLBEREIT");
    const types = env.db().messages.filter((m) => m.orderId === o.id).map((m) => m.type);
    expect(types.filter((x) => x === "MITTEILUNG")).toHaveLength(2);
    expect(types.filter((x) => x === "ABHOLBEREIT")).toHaveLength(1);
    expect((await send("Noch eine, Auftrag ist abholbereit")).status).toBe(201); // ready orders may still get a message
  });

  it("validates the text and the order state", async () => {
    const env = makeEnv();
    const t = await env.token();
    const o = await createOrder(env, t, { item: "Rad" });
    const send = (id: string, text: unknown) => env.api(t, "POST", `/api/betrieb/orders/${id}/notify`, { text });
    expect((await send(o.id, "")).status).toBe(400);
    expect((await send(o.id, "   ")).status).toBe(400);
    expect((await send(o.id, 5)).status).toBe(400);
    expect((await send(o.id, "x".repeat(501))).status).toBe(400);
    expect((await send(o.id, "x".repeat(500))).status).toBe(201);
    expect((await send("o999", "Hallo")).status).toBe(404);
    await setStatus(env, t, o.id, "STORNIERT");
    const closed = await send(o.id, "Hallo");
    expect(closed.status).toBe(409);
    expect(closed.json.error.code).toBe("NOT_ALLOWED");
    const picked = await createOrder(env, t, { item: "Rad zwei" });
    await setStatus(env, t, picked.id, "ABHOLBEREIT");
    await setStatus(env, t, picked.id, "ABGEHOLT");
    expect((await send(picked.id, "Hallo")).status).toBe(409);
  });

  it("needs a login and is never visible to customers", async () => {
    const env = makeEnv();
    const t = await env.token();
    const o = await createOrder(env, t, { item: "Rad", customerPhone: "+49 151 00000013" });
    expect((await env.pub("POST", `/api/betrieb/orders/${o.id}/notify`, { text: "Hallo" })).status).toBe(401);
    const sent = await env.api(t, "POST", `/api/betrieb/orders/${o.id}/notify`, { text: "Geheimer Text 4711" });
    const view = await env.pub("GET", `${PUB}/orders/${o.code}`);
    expect(view.body).not.toContain("4711");
    expect(view.body).not.toContain("00000013");
    // STOP replies only exist for messages the customer ordered
    const stop = await env.api(t, "POST", `/api/betrieb/messages/${sent.json.id}/simulate-stop`);
    expect(stop.status).toBe(409);
  });
});

describe("central customer page", () => {
  it("finds the order by code alone, with the business branding, and links in messages are central", async () => {
    const env = makeEnv();
    const t = await env.token();
    const o = await createOrder(env, t, { item: "Rad", customerPhone: "+49 151 00004711" });
    const r = await env.pub("GET", `/api/public/orders/${o.code.toLowerCase()}`);
    expect(r.status).toBe(200);
    expect(r.json.business).toMatchObject({ name: "Werkstatt Demo", webname: "werkstatt-demo" });
    expect(r.json.order).toMatchObject({ code: o.code, status: "ANGENOMMEN" });
    expect(r.body).not.toContain("00004711");
    expect(r.body).not.toContain("Rad");
    expect(o.statusUrl).toBe(`http://localhost:5174/a/${o.code}`);
    expect(env.db().messages.find((m) => m.orderId === o.id)).toMatchObject({ type: "STATUSLINK", channel: "SMS", link: `http://localhost:5174/a/${o.code}` });
  });

  it("the entry by hand needs the last 4 digits of the phone number and answers every failure the same", async () => {
    const env = makeEnv();
    const t = await env.token();
    const o = await createOrder(env, t, { item: "Rad", customerPhone: "+49 151 00004711" });
    const lookup = (body: unknown) => env.pub("POST", "/api/public/lookup", body);
    const ok = await lookup({ code: ` ${o.code.slice(0, 3).toLowerCase()} ${o.code.slice(3)} `, phoneEnd: "4711" });
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({ code: o.code });
    expect((await lookup({ code: o.code, phoneEnd: "47 11" })).status).toBe(200); // spaces are ignored
    const wrongPin = await lookup({ code: o.code, phoneEnd: "0000" });
    const wrongCode = await lookup({ code: "ZZZZZZ", phoneEnd: "4711" });
    const malformed = await lookup({ code: "x", phoneEnd: "4711" });
    const noPin = await lookup({ code: o.code });
    const shortPin = await lookup({ code: o.code, phoneEnd: "11" });
    for (const r of [wrongPin, wrongCode, malformed, noPin, shortPin]) {
      expect(r.status).toBe(404);
      expect(r.body).toBe(wrongCode.body); // no hint whether the code or the digits were wrong
    }
  });

  it("failed tries at the central entry count towards the lock", async () => {
    const env = makeEnv();
    const t = await env.token();
    const o = await createOrder(env, t, { item: "Rad", customerPhone: "+49 151 00004711" });
    for (let i = 0; i < 10; i++) expect((await env.pub("POST", "/api/public/lookup", { code: o.code, phoneEnd: "0000" })).status).toBe(404);
    const locked = await env.pub("POST", "/api/public/lookup", { code: o.code, phoneEnd: "4711" });
    expect(locked.status).toBe(429); // even the right digits are refused during the lock
    expect((await env.pub("GET", `/api/public/orders/${o.code}`)).status).toBe(429);
  });
});
