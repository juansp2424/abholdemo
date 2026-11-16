import { describe, expect, it } from "vitest";
import { generateSlotDays } from "../src/slots.js";
import { defaultSettings } from "../src/seed.js";
import { BASE, PUB, createOrder, makeEnv, setStatus } from "./helpers.js";

const midnight = new Date(2026, 10, 11, 0, 0, 0).getTime(); // Wednesday
const hhmm = (ms: number) => new Date(ms).toTimeString().slice(0, 5);

describe("slot generation", () => {
  it("uses both intervals of a day and leaves out the lunch break", () => {
    const days = generateSlotDays(defaultSettings(), midnight);
    const wed = days[0];
    expect(wed.date).toBe("2026-11-11");
    expect(wed.slots).toHaveLength(32); // 16 + 16 at 15 minutes
    expect(hhmm(wed.slots[0].start)).toBe("09:00");
    expect(hhmm(wed.slots[15].end)).toBe("13:00");
    expect(hhmm(wed.slots[16].start)).toBe("14:00");
    expect(hhmm(wed.slots[31].end)).toBe("18:00");
  });

  it("omits closed Sunday and covers 7 calendar days", () => {
    const days = generateSlotDays(defaultSettings(), midnight);
    expect(days.map((d) => d.date)).toEqual([
      "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", // Wed to Sat
      "2026-11-16", "2026-11-17", // Sunday 15th is closed, 7 days end on Tuesday 17th
    ]);
    expect(days[3].slots).toHaveLength(16); // Saturday morning only
  });

  it("changes with slot length", () => {
    const s = { ...defaultSettings(), slotLengthMinutes: 30 as const };
    expect(generateSlotDays(s, midnight)[0].slots).toHaveLength(16);
    const s60 = { ...defaultSettings(), slotLengthMinutes: 60 as const };
    expect(generateSlotDays(s60, midnight)[0].slots).toHaveLength(8);
  });

  it("excludes past slots and a slot starting exactly now", () => {
    const now = new Date(2026, 10, 11, 10, 0, 0).getTime();
    const first = generateSlotDays(defaultSettings(), now)[0].slots[0];
    expect(hhmm(first.start)).toBe("10:15");
  });
});

describe("slots via public api", () => {
  it("lists free capacity and honours capacity and slot length settings", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const o = await createOrder(env, owner);
    await setStatus(env, owner, o.id, "ABHOLBEREIT");
    let r = await env.pub("GET", `${PUB}/orders/${o.code}/slots`);
    expect(r.status).toBe(200);
    // seed: 7KP4QX holds 10:15 today, capacity 2 -> 1 free
    const today = r.json.days[0];
    expect(today.date).toBe("2026-11-11");
    expect(today.slots[0].start).toBe(new Date(2026, 10, 11, 10, 15).toISOString());
    expect(today.slots[0].free).toBe(1);
    expect(today.slots[1].free).toBe(2);

    const settings = env.db().settings;
    const put = await env.api(owner, "PUT", "/api/betrieb/settings", { ...settings, slotLengthMinutes: 30, slotCapacity: 1 });
    expect(put.status).toBe(200);
    r = await env.pub("GET", `${PUB}/orders/${o.code}/slots`);
    const hours = r.json.days[0].slots.map((s: any) => hhmm(Date.parse(s.start)));
    expect(hours.slice(0, 2)).toEqual(["10:30", "11:00"]);
    expect(r.json.days[0].slots.every((s: any) => s.free === 1)).toBe(true);
  });

  it("is not available before the order is ready", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const o = await createOrder(env, owner);
    const r = await env.pub("GET", `${PUB}/orders/${o.code}/slots`);
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("NOT_ALLOWED");
  });
});

void BASE;
