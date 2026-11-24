import { describe, expect, it } from "vitest";
import { NEUTRAL_NOT_FOUND_MESSAGE, RATE_LIMIT_MESSAGE, RATE_LIMIT_WINDOW_MS } from "@abholdemo/shared";
import { createRateLimiter } from "../src/rateLimit.js";
import { PUB, createOrder, makeEnv, orderId, setStatus } from "./helpers.js";

describe("neutral 404", () => {
  it("gives byte identical bodies for unknown, malformed and foreign codes", async () => {
    const env = makeEnv();
    const unknown = await env.pub("GET", `${PUB}/orders/ZZZZZZ`);
    const near = await env.pub("GET", `${PUB}/orders/H7RT3J`); // one char off a real code
    const malformed = await env.pub("GET", `${PUB}/orders/abc`);
    const zeros = await env.pub("GET", `${PUB}/orders/OOO111`);
    const foreign = await env.pub("GET", `/api/public/b/anderer-betrieb/orders/H7RT3K`); // valid code, other business
    for (const r of [unknown, near, malformed, zeros, foreign]) {
      expect(r.status).toBe(404);
      expect(r.body).toBe(unknown.body);
    }
    expect(unknown.json).toEqual({ error: { code: "NOT_FOUND", message: NEUTRAL_NOT_FOUND_MESSAGE } });
  });

  it("accepts lower case and spaces for valid codes", async () => {
    const env = makeEnv();
    const r = await env.pub("GET", `${PUB}/orders/${encodeURIComponent(" h7rt 3k ")}`);
    expect(r.status).toBe(200);
    expect(r.json.code).toBe("H7RT3K");
  });

  it("unknown business has a plain message", async () => {
    const r = await makeEnv().pub("GET", "/api/public/b/gibts-nicht");
    expect(r.status).toBe(404);
    expect(r.json.error.message).toBe("Diesen Betrieb gibt es nicht.");
  });

  it("takes at least 300 ms, found or not", async () => {
    const env = makeEnv({ lookupMinMs: 300 });
    for (const code of ["H7RT3K", "ZZZZZZ"]) {
      const t = Date.now();
      await env.pub("GET", `${PUB}/orders/${code}`);
      expect(Date.now() - t).toBeGreaterThanOrEqual(295);
    }
  });
});

describe("rate limit", () => {
  it("locks after 10 failures, even for valid codes, and unlocks after the window", async () => {
    const env = makeEnv();
    for (let i = 0; i < 10; i++) {
      const r = await env.pub("GET", `${PUB}/orders/ZZZZZ${i + 2}`);
      expect(r.status).toBe(404);
    }
    const locked = await env.pub("GET", `${PUB}/orders/H7RT3K`);
    expect(locked.status).toBe(429);
    expect(locked.json).toEqual({ error: { code: "RATE_LIMITED", message: RATE_LIMIT_MESSAGE } });
    // other public order routes are locked too
    expect((await env.pub("GET", `${PUB}/orders/H7RT3K/slots`)).status).toBe(429);
    env.time.value += RATE_LIMIT_WINDOW_MS + 1000;
    expect((await env.pub("GET", `${PUB}/orders/H7RT3K`)).status).toBe(200);
  });

  it("does not lock after 9 failures", async () => {
    const env = makeEnv();
    for (let i = 0; i < 9; i++) await env.pub("GET", `${PUB}/orders/ZZZZZ${i + 2}`);
    expect((await env.pub("GET", `${PUB}/orders/H7RT3K`)).status).toBe(200);
  });

  it("failures expire after the window (injected clock)", async () => {
    let t = 0;
    const lim = createRateLimiter(() => t);
    for (let i = 0; i < 9; i++) lim.recordFail("k");
    t += 61_000;
    lim.recordFail("k");
    expect(lim.isLocked("k")).toBe(false);
    for (let i = 0; i < 9; i++) lim.recordFail("k");
    expect(lim.isLocked("k")).toBe(true);
    t += 59_000;
    expect(lim.isLocked("k")).toBe(true);
    t += 2_000;
    expect(lim.isLocked("k")).toBe(false);
  });

  it("uses the last X-Forwarded-For entry: rotating fake first entries do not dodge the limit", async () => {
    const env = makeEnv();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await env.pub("GET", `${PUB}/orders/ZZZZZ${(i % 8) + 2}`, undefined, {
        headers: { "x-forwarded-for": `203.0.113.${i}, 198.51.100.7` },
      });
      codes.push(r.status);
    }
    expect(codes.slice(0, 10).every((c) => c === 404)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
    const valid = await env.pub("GET", `${PUB}/orders/H7RT3K`, undefined, { headers: { "x-forwarded-for": "203.0.113.99, 198.51.100.7" } });
    expect(valid.status).toBe(429);
  });

  it("keys by IP: X-Forwarded-For only counts when the socket is loopback", async () => {
    const env = makeEnv();
    const fail = (xff: string, remoteAddress?: string) =>
      env.pub("GET", `${PUB}/orders/ZZZZZZ`, undefined, { headers: { "x-forwarded-for": xff }, remoteAddress });
    for (let i = 0; i < 10; i++) await fail("9.9.9.9, 1.1.1.1");
    expect((await env.pub("GET", `${PUB}/orders/H7RT3K`, undefined, { headers: { "x-forwarded-for": "1.1.1.1" } })).status).toBe(429);
    expect((await env.pub("GET", `${PUB}/orders/H7RT3K`, undefined, { headers: { "x-forwarded-for": "2.2.2.2" } })).status).toBe(200);
    // a remote client cannot dodge the limit by changing the header
    for (let i = 0; i < 10; i++) await fail(`3.3.3.${i}`, "10.0.0.5");
    const r = await env.pub("GET", `${PUB}/orders/H7RT3K`, undefined, { headers: { "x-forwarded-for": "4.4.4.4" }, remoteAddress: "10.0.0.5" });
    expect(r.status).toBe(429);
  });
});

describe("public responses contain no personal data", () => {
  it("never leaks seed names, emails, phones, items or photos", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
    const withPhoto = await createOrder(env, owner, {
      item: "Geheimer Gegenstand", category: "Tasche", customerName: "Zora Unbekannt",
      customerEmail: "zora@beispiel.de", customerPhone: "+49 151 00000099", photoDataUrl: png,
    });
    const orders = env.db().orders;
    const secrets = new Set<string>();
    for (const o of orders) {
      for (const v of [o.item, o.category, o.customerName, o.customerEmail, o.customerPhone, o.subscription?.contact, o.photoMime]) {
        if (v) secrets.add(v);
      }
    }
    expect(secrets.size).toBeGreaterThan(20);

    const responses: string[] = [JSON.stringify((await env.pub("GET", PUB)).json)];
    // subscribe (contact must not come back) and book a slot, then read every order
    const sub = await env.pub("POST", `${PUB}/orders/${withPhoto.code}/subscribe`, { channel: "MAIL", contact: "zora@beispiel.de", consent: true });
    responses.push(sub.body);
    for (const o of env.db().orders) {
      const r = await env.pub("GET", `${PUB}/orders/${o.code}`);
      expect(r.status).toBe(200);
      responses.push(r.body);
      if (o.status === "ABHOLBEREIT" || o.status === "UEBERFAELLIG") responses.push((await env.pub("GET", `${PUB}/orders/${o.code}/slots`)).body);
    }
    const all = responses.join("\n");
    for (const secret of secrets) expect(all, secret).not.toContain(secret);
    expect(all).not.toMatch(/photo|data:image|customer|email|phone|contact|"id"|"item"/i);
    expect(all).not.toContain("@");
  });

  it("returns exactly the whitelisted fields", async () => {
    const env = makeEnv();
    const r = await env.pub("GET", `${PUB}/orders/7KP4QX`);
    expect(Object.keys(r.json).sort()).toEqual(
      [
        "code", "status", "statusLabel", "statusText", "estimatedCompletion", "plannedPickupDate", "slot",
        "pickupDeadlineDays", "pickupDeadline", "canSubscribe", "notifyActive", "notifyChannel", "slotBookingOpen", "estimateState", "completionPostponed", "completionNote",
      ].sort(),
    );
    expect(r.json).toMatchObject({ status: "ABHOLBEREIT", notifyActive: true, notifyChannel: "MAIL", slotBookingOpen: true, canSubscribe: false, pickupDeadlineDays: 14 });
    expect(r.json.slot).not.toBeNull();
    expect(Object.keys(r.json.slot).sort()).toEqual(["end", "start"]);
    const bus = await env.pub("GET", PUB);
    expect(Object.keys(bus.json).sort()).toEqual(["defaultChannel", "dropOffEnabled", "logoDataUrl", "name", "pickupDeadlineDays", "webname"]);
  });

  it("shows estimated completion and sets no cookies", async () => {
    const env = makeEnv();
    const res = await env.app.inject({ method: "GET", url: `${PUB}/orders/Q9XB2M` });
    expect(res.headers["set-cookie"]).toBeUndefined();
    const json = res.json();
    expect(json.estimatedCompletion).toBe("2026-11-12");
    expect(json.pickupDeadline).toBeNull(); // only when ready or overdue
  });
});

describe("subscribe and unsubscribe", () => {
  it("needs consent, a valid contact and a pre ready status", async () => {
    const env = makeEnv();
    const url = `${PUB}/orders/H7RT3K/subscribe`;
    const noConsent = await env.pub("POST", url, { channel: "MAIL", contact: "a@beispiel.de", consent: false });
    expect(noConsent.status).toBe(400);
    expect(noConsent.json.error.message).toBe("Bitte setzen Sie den Haken, damit wir Ihnen schreiben dürfen.");
    expect((await env.pub("POST", url, { channel: "MAIL", contact: "a@beispiel.de" })).status).toBe(400);
    expect((await env.pub("POST", url, { channel: "MAIL", contact: "nicht-mail", consent: true })).status).toBe(400);
    expect((await env.pub("POST", url, { channel: "SMS", contact: "abc", consent: true })).status).toBe(400);
    const ready = await env.pub("POST", `${PUB}/orders/D3FY6W/subscribe`, { channel: "MAIL", contact: "a@beispiel.de", consent: true });
    expect(ready.status).toBe(409);
    expect(ready.json.error.code).toBe("NOT_ALLOWED");
  });

  it("stores timestamp and the server side consent wording", async () => {
    const { CONSENT_TEXT } = await import("@abholdemo/shared");
    const env = makeEnv();
    const owner = await env.token();
    const r = await env.pub("POST", `${PUB}/orders/N4WZ8P/subscribe`, {
      channel: "SMS", contact: "+49 151 00000077", consent: true, consentText: "gefälscht",
    });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ notifyActive: true, notifyChannel: "SMS", canSubscribe: false });
    const d = await env.api(owner, "GET", `/api/betrieb/orders/${orderId(env, "N4WZ8P")}`);
    expect(d.json.subscription).toMatchObject({ channel: "SMS", contact: "+49 151 00000077", consentText: CONSENT_TEXT, active: true });
    expect(d.json.subscription.consentAt).toBe(new Date(env.time.value).toISOString());
    expect(d.json.consentLog).toEqual([
      { at: new Date(env.time.value).toISOString(), type: "ZUSTIMMUNG", channel: "SMS", text: CONSENT_TEXT, source: "KUNDENSEITE" },
    ]);
  });

  it("unsubscribe by LINK is logged once and is idempotent", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const url = `${PUB}/orders/Q9XB2M/unsubscribe`;
    const r1 = await env.pub("POST", url, { source: "LINK" });
    expect(r1.json).toMatchObject({ notifyActive: false, notifyChannel: null, canSubscribe: true });
    await env.pub("POST", url, { source: "LINK" });
    const d = await env.api(owner, "GET", `/api/betrieb/orders/${orderId(env, "Q9XB2M")}`);
    const events = d.json.consentLog.filter((e: any) => e.type === "WIDERRUF");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("LINK");
    expect(d.json.subscription).toMatchObject({ active: false, revokeSource: "LINK" });
    expect((await env.pub("POST", url, { source: "X" })).status).toBe(400);
  });

  it("simulated STOP revokes the subscription (SMS and WhatsApp only)", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const msgs = (await env.api(owner, "GET", "/api/betrieb/messages?month=2026-10")).json.messages;
    const wa = msgs.find((m: any) => m.channel === "WHATSAPP");
    const r = await env.api(owner, "POST", `/api/betrieb/messages/${wa.id}/simulate-stop`);
    expect(r.status).toBe(200);
    expect(r.json.stopSimulated).toBe(true);
    const d = await env.api(owner, "GET", `/api/betrieb/orders/${orderId(env, "G8UE4R")}`);
    expect(d.json.subscription).toMatchObject({ active: false, revokeSource: "STOP" });
    expect(d.json.consentLog.at(-1)).toMatchObject({ type: "WIDERRUF", source: "STOP" });
    const mail = (await env.api(owner, "GET", "/api/betrieb/messages")).json.messages.find((m: any) => m.channel === "MAIL");
    const no = await env.api(owner, "POST", `/api/betrieb/messages/${mail.id}/simulate-stop`);
    expect(no.status).toBe(409);
    expect(no.json.error.code).toBe("NOT_ALLOWED");
  });
});

void setStatus;
