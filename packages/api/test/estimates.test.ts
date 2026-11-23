import { describe, expect, it } from "vitest";
import { DAY_MS } from "../src/clock.js";
import { BASE, createOrder, makeEnv, orderId, setStatus } from "./helpers.js";

const body = { amountCents: 24950, description: "Neue Bremsscheiben vorne", channel: "MAIL" };
const est = (id: string) => `/api/betrieb/orders/${id}/estimate`;
const pubEst = (code: string) => `/api/public/orders/${code}/estimate`;

async function setup(over: Record<string, unknown> = { customerEmail: "kunde@beispiel.de" }) {
  const env = makeEnv();
  const owner = await env.token();
  const o = await createOrder(env, owner, { item: "Auto, Bremsen", ...over });
  return { env, owner, o, digits: "0099" };
}

describe("cost estimates, staff side", () => {
  it("sends an estimate, creates a message without amount and shows it in the detail", async () => {
    const { env, owner, o } = await setup();
    const r = await env.api(owner, "POST", est(o.id), body);
    expect(r.status).toBe(201);
    expect(r.json.estimates).toHaveLength(1);
    expect(r.json.estimates[0]).toMatchObject({ version: 1, amountCents: 24950, state: "OFFEN", channel: "MAIL", decidedVia: null });
    expect(r.json.estimates[0].reminderSent).toBeUndefined();
    const msg = env.db().messages.find((m) => m.type === "KOSTENVORANSCHLAG" && m.orderId === o.id)!;
    expect(msg).toMatchObject({ channel: "MAIL", recipient: "kunde@beispiel.de", costEur: 0 });
    expect(msg.text).toContain(o.code);
    expect(msg.text).not.toMatch(/249|24950|Bremsscheiben|Auto/);
    const list = await env.api(owner, "GET", "/api/betrieb/orders?filter=freigabe");
    expect(list.json.map((x: any) => x.code).sort()).toEqual([o.code, "H7RT3K", "Q9XB2M"].sort()); // plus the two open seed examples
    expect(list.json[0].estimateState).toBe("OFFEN");
  });

  it("sends by WhatsApp to the phone number and replaces an open estimate with the next version", async () => {
    const { env, owner, o } = await setup({});
    await env.api(owner, "POST", est(o.id), { ...body, channel: "WHATSAPP" });
    const r = await env.api(owner, "POST", est(o.id), { ...body, channel: "WHATSAPP", amountCents: 30000 });
    expect(r.json.estimates.map((e: any) => [e.version, e.state])).toEqual([[1, "ZURUECKGEZOGEN"], [2, "OFFEN"]]);
    const m = env.db().messages.filter((x) => x.type === "KOSTENVORANSCHLAG" && x.orderId === o.id);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ channel: "WHATSAPP", recipient: "+49 151 00000099", costEur: 0.0456 });
  });

  it("validates input and status", async () => {
    const { env, owner, o } = await setup({});
    for (const bad of [{ amountCents: 0 }, { amountCents: 1.5 }, { amountCents: 10_000_001 }, { description: " " }, { channel: "SMS" }, { channel: "MAIL" }, { validUntil: "2020-01-01" }, { validUntil: "kein Datum" }]) {
      expect((await env.api(owner, "POST", est(o.id), { ...body, ...bad })).status).toBe(400);
    }
    await setStatus(env, owner, o.id, "ABHOLBEREIT");
    expect((await env.api(owner, "POST", est(o.id), body)).status).toBe(409);
    expect((await env.api(owner, "POST", est("o999"), body)).status).toBe(404);
    expect((await env.pub("POST", est(o.id), body)).status).toBe(401);
  });

  it("withdraws, records a phone decision and closes the estimate when the work is finished", async () => {
    const { env, owner, o } = await setup();
    await env.api(owner, "POST", est(o.id), body);
    expect((await env.api(owner, "POST", `${est(o.id)}/withdraw`)).json.estimates[0].state).toBe("ZURUECKGEZOGEN");
    expect((await env.api(owner, "POST", `${est(o.id)}/withdraw`)).status).toBe(409);
    await env.api(owner, "POST", est(o.id), body);
    const d = await env.api(owner, "POST", `${est(o.id)}/decide`, { decision: "FREIGEGEBEN" });
    expect(d.json.estimates[1]).toMatchObject({ state: "FREIGEGEBEN", decidedVia: "BETRIEB" });
    expect((await env.api(owner, "POST", `${est(o.id)}/decide`, { decision: "ABGELEHNT" })).status).toBe(409);
    await env.api(owner, "POST", est(o.id), body);
    await setStatus(env, owner, o.id, "ABHOLBEREIT");
    expect(env.db().orders.find((x) => x.id === o.id)!.estimates.at(-1)!.state).toBe("ZURUECKGEZOGEN");
  });
});

describe("cost estimates, customer side", () => {
  it("shows amount and text only after the last phone digits", async () => {
    const { env, owner, o, digits } = await setup();
    await env.api(owner, "POST", est(o.id), body);
    const open = await env.pub("GET", `/api/public/orders/${o.code}`);
    expect(open.json.order.estimateState).toBe("OFFEN");
    expect(open.body).not.toMatch(/24950|Bremsscheiben/);
    for (const wrong of ["1234", "", "99"]) expect((await env.pub("POST", pubEst(o.code), { phoneEnd: wrong })).status).toBe(404);
    const ok = await env.pub("POST", pubEst(o.code), { phoneEnd: digits });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ version: 1, amountCents: 24950, description: "Neue Bremsscheiben vorne", state: "OFFEN" });
    expect(Object.keys(ok.json).sort()).toEqual(["amountCents", "decidedAt", "description", "state", "validUntil", "version"]);
  });

  it("approves once and confirms by message; the decision cannot be repeated", async () => {
    const { env, owner, o, digits } = await setup();
    await env.api(owner, "POST", est(o.id), body);
    const r = await env.pub("POST", `${pubEst(o.code)}/decision`, { phoneEnd: digits, version: 1, decision: "FREIGEGEBEN" });
    expect(r.status).toBe(200);
    expect(r.json.state).toBe("FREIGEGEBEN");
    const rec = env.db().orders.find((x) => x.id === o.id)!.estimates[0];
    expect(rec.decidedVia).toBe("KUNDENSEITE");
    const conf = env.db().messages.find((m) => m.type === "KV_ENTSCHEIDUNG" && m.orderId === o.id)!;
    expect(conf.text).toContain("freigegeben");
    expect(conf.text).not.toMatch(/249|24950/);
    expect((await env.pub("POST", `${pubEst(o.code)}/decision`, { phoneEnd: digits, version: 1, decision: "ABGELEHNT" })).status).toBe(409);
  });

  it("rejects wrong digits, wrong version and unknown decisions", async () => {
    const { env, owner, o, digits } = await setup();
    await env.api(owner, "POST", est(o.id), body);
    expect((await env.pub("POST", `${pubEst(o.code)}/decision`, { phoneEnd: "0000", version: 1, decision: "FREIGEGEBEN" })).status).toBe(404);
    expect((await env.pub("POST", `${pubEst(o.code)}/decision`, { phoneEnd: digits, version: 7, decision: "FREIGEGEBEN" })).status).toBe(409);
    expect((await env.pub("POST", `${pubEst(o.code)}/decision`, { phoneEnd: digits, version: 1, decision: "VIELLEICHT" })).status).toBe(400);
    expect(env.db().orders.find((x) => x.id === o.id)!.estimates[0].state).toBe("OFFEN");
  });

  it("counts wrong digits towards the lock", async () => {
    const { env, owner, o } = await setup();
    await env.api(owner, "POST", est(o.id), body);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await env.pub("POST", pubEst(o.code), { phoneEnd: "0000" }, { remoteAddress: "10.1.1.1" })).status;
    expect(last).toBe(429);
  });
});

describe("cost estimates over time", () => {
  it("sends one reminder a day before the end and expires after the last day", async () => {
    const { env, owner, o } = await setup();
    await env.api(owner, "POST", est(o.id), { ...body, validUntil: new Date(BASE + 3 * DAY_MS).toISOString().slice(0, 10) });
    const kinds = () => env.db().messages.filter((m) => m.type === "KV_ERINNERUNG" && m.orderId === o.id).length;
    const touch = () => env.api(owner, "GET", "/api/betrieb/orders"); // the sweep runs before every request
    await env.api(owner, "POST", "/api/demo/advance", { days: 1 });
    await touch();
    expect(kinds()).toBe(0);
    await env.api(owner, "POST", "/api/demo/advance", { days: 1 });
    await touch();
    expect(kinds()).toBe(1);
    await touch();
    expect(kinds()).toBe(1); // only one
    await env.api(owner, "POST", "/api/demo/advance", { days: 2 });
    await touch();
    const e = env.db().orders.find((x) => x.id === o.id)!.estimates[0];
    expect(e.state).toBe("ABGELAUFEN");
    expect((await env.pub("POST", `${pubEst(o.code)}/decision`, { phoneEnd: "0099", version: 1, decision: "FREIGEGEBEN" })).status).toBe(409);
  });

  it("seed examples: two open and one approved", () => {
    const env = makeEnv();
    const state = (c: string) => env.db().orders.find((o) => o.code === c)!.estimates.map((e) => [e.channel, e.state]);
    expect(state("Q9XB2M")).toEqual([["MAIL", "OFFEN"]]);
    expect(state("H7RT3K")).toEqual([["WHATSAPP", "OFFEN"]]);
    expect(state("C6VJ5T")).toEqual([["WHATSAPP", "FREIGEGEBEN"]]);
    expect(orderId(env, "H7RT3K")).toBeTruthy();
  });
});
