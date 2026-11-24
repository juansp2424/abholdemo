import { describe, expect, it } from "vitest";
import { DAY_MS, toDateString } from "../src/clock.js";
import { BASE, createOrder, makeEnv, setStatus } from "./helpers.js";

const day = (n: number) => toDateString(BASE + n * DAY_MS);
const url = (id: string) => `/api/betrieb/orders/${id}/completion`;

async function setup(over: Record<string, unknown> = {}) {
  const env = makeEnv();
  const owner = await env.token();
  const o = await createOrder(env, owner, { item: "Auto, Inspektion", estimatedCompletion: day(1), ...over });
  const msgs = () => env.db().messages.filter((m) => m.orderId === o.id && m.type === "NEUES_DATUM");
  return { env, owner, o, msgs };
}

describe("new expected completion date", () => {
  it("postpones with a reason, informs the customer and shows it on the customer page", async () => {
    const { env, owner, o, msgs } = await setup({ customerEmail: "kunde@beispiel.de" });
    const r = await env.api(owner, "POST", url(o.id), { date: day(3), note: "Das Ersatzteil kommt später.", notify: true });
    expect(r.status).toBe(200);
    expect(r.json.estimatedCompletion).toBe(day(3));
    expect(r.json.completionLog).toEqual([expect.objectContaining({ from: day(1), to: day(3), note: "Das Ersatzteil kommt später.", notified: true, actorName: "Maria Leisten" })]);
    expect(msgs()).toHaveLength(1);
    const m = msgs()[0];
    expect(m).toMatchObject({ channel: "MAIL", recipient: "kunde@beispiel.de" });
    expect(m.text).toContain(day(3).split("-").reverse().join("."));
    expect(m.text).toContain("Das Ersatzteil kommt später.");
    expect(m.text).not.toContain("Inspektion");
    const pub = await env.pub("GET", `/api/public/orders/${o.code}`);
    expect(pub.json.order).toMatchObject({ estimatedCompletion: day(3), completionPostponed: true, completionNote: "Das Ersatzteil kommt später." });
  });

  it("sends by SMS without an email, and not at all without notify", async () => {
    const { env, owner, o, msgs } = await setup();
    await env.api(owner, "POST", url(o.id), { date: day(2), notify: false });
    expect(msgs()).toHaveLength(0);
    await env.api(owner, "POST", url(o.id), { date: day(4), notify: true });
    expect(msgs()).toHaveLength(1);
    expect(msgs()[0].channel).toBe("SMS");
  });

  it("an earlier date is not postponed; removing the date sends nothing", async () => {
    const { env, owner, o, msgs } = await setup({ estimatedCompletion: day(5) });
    await env.api(owner, "POST", url(o.id), { date: day(2), notify: true, note: "Geht schneller." });
    let pub = await env.pub("GET", `/api/public/orders/${o.code}`);
    expect(pub.json.order).toMatchObject({ completionPostponed: false, completionNote: "Geht schneller." });
    await env.api(owner, "POST", url(o.id), { date: null, notify: true, note: "egal" });
    pub = await env.pub("GET", `/api/public/orders/${o.code}`);
    expect(pub.json.order).toMatchObject({ estimatedCompletion: null, completionPostponed: false, completionNote: null });
    expect(msgs()).toHaveLength(1);
  });

  it("validates date, note and status", async () => {
    const { env, owner, o } = await setup();
    expect((await env.api(owner, "POST", url(o.id), { date: day(-1), notify: true })).status).toBe(400);
    expect((await env.api(owner, "POST", url(o.id), { date: "morgen", notify: true })).status).toBe(400);
    expect((await env.api(owner, "POST", url(o.id), { date: day(1), notify: true })).status).toBe(400); // unchanged
    expect((await env.api(owner, "POST", url(o.id), { date: day(2), note: "x".repeat(201), notify: true })).status).toBe(400);
    await setStatus(env, owner, o.id, "ABHOLBEREIT");
    expect((await env.api(owner, "POST", url(o.id), { date: day(2), notify: true })).status).toBe(409);
    expect((await env.pub("POST", url(o.id), { date: day(2), notify: true })).status).toBe(401);
  });
});
