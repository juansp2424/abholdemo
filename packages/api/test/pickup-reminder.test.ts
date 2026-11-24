import { describe, expect, it } from "vitest";
import { DAY_MS } from "../src/clock.js";
import { PUB, createOrder, makeEnv, setStatus } from "./helpers.js";

async function ready(over: Record<string, unknown> = {}, subscribe?: { channel: string; contact: string }) {
  const env = makeEnv();
  const owner = await env.token();
  const o = await createOrder(env, owner, { item: "Fahrrad, Kette", ...over });
  if (subscribe) await env.pub("POST", `${PUB}/orders/${o.code}/subscribe`, { ...subscribe, consent: true }); // only before it is ready
  await setStatus(env, owner, o.id, "ABHOLBEREIT");
  const days = (await env.pub("GET", `${PUB}/orders/${o.code}/slots`)).json.days;
  const reminders = () => env.db().messages.filter((m) => m.orderId === o.id && m.type === "ABHOLZEIT_ERINNERUNG");
  const touch = () => env.api(owner, "GET", "/api/betrieb/orders"); // the sweep runs before every request
  return { env, owner, o, days, reminders, touch };
}

describe("reminder for a booked pickup", () => {
  it("comes once on the day before, to the intake contact, with date, time and link", async () => {
    const { env, owner, o, days, reminders, touch } = await ready({ customerEmail: "kunde@beispiel.de" });
    const slot = days[2].slots[0]; // a later day
    await env.pub("PUT", `${PUB}/orders/${o.code}/slot`, { start: slot.start });
    const until = Math.round((new Date(Date.parse(slot.start)).setHours(0, 0, 0, 0) - new Date(env.time.value).setHours(0, 0, 0, 0)) / DAY_MS);
    await env.api(owner, "POST", "/api/demo/advance", { days: until - 2 });
    await touch();
    expect(reminders()).toHaveLength(0);
    await env.api(owner, "POST", "/api/demo/advance", { days: 1 });
    await touch();
    await touch();
    expect(reminders()).toHaveLength(1);
    const m = reminders()[0];
    expect(m).toMatchObject({ channel: "MAIL", recipient: "kunde@beispiel.de" });
    expect(m.text).toContain(o.code);
    expect(m.text).toMatch(/\d\d:\d\d Uhr/);
    expect(m.text).not.toContain("Kette");
  });

  it("uses the subscription contact when the customer subscribed", async () => {
    const { env, owner, o, days, reminders, touch } = await ready({}, { channel: "WHATSAPP", contact: "+49 151 00000055" });
    const slot = days[2].slots[0];
    await env.pub("PUT", `${PUB}/orders/${o.code}/slot`, { start: slot.start });
    const until = Math.round((new Date(Date.parse(slot.start)).setHours(0, 0, 0, 0) - new Date(env.time.value).setHours(0, 0, 0, 0)) / DAY_MS);
    await env.api(owner, "POST", "/api/demo/advance", { days: until - 1 });
    await touch();
    expect(reminders().map((m) => [m.channel, m.recipient])).toEqual([["WHATSAPP", "+49 151 00000055"]]);
  });

  it("does not remind for a pickup booked on the day before itself, nor after picking up", async () => {
    const { env, owner, o, days, reminders, touch } = await ready();
    const slot = days[1].slots[0];
    const until = Math.round((new Date(Date.parse(slot.start)).setHours(0, 0, 0, 0) - new Date(env.time.value).setHours(0, 0, 0, 0)) / DAY_MS);
    await env.api(owner, "POST", "/api/demo/advance", { days: until - 1 });
    const fresh = (await env.pub("GET", `${PUB}/orders/${o.code}/slots`)).json.days.flatMap((d: any) => d.slots);
    const tomorrow = fresh.find((s: any) => new Date(s.start).getDate() === new Date(Date.parse(slot.start)).getDate());
    await env.pub("PUT", `${PUB}/orders/${o.code}/slot`, { start: tomorrow.start });
    await touch();
    expect(reminders()).toHaveLength(0);
    await setStatus(env, owner, o.id, "ABGEHOLT");
    await touch();
    expect(reminders()).toHaveLength(0);
  });
});

describe("central page entry for drop-off booking", () => {
  it("lists the businesses that take online appointments", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const r = await env.pub("GET", "/api/public/dropoff-businesses");
    expect(r.json).toEqual([{ name: "Werkstatt Demo", webname: "werkstatt-demo", logoDataUrl: null }]);
    const s = (await env.api(owner, "GET", "/api/betrieb/settings")).json;
    await env.api(owner, "PUT", "/api/betrieb/settings", { ...s, dropOffEnabled: false });
    expect((await env.pub("GET", "/api/public/dropoff-businesses")).json).toEqual([]);
  });
});
