import { describe, expect, it } from "vitest";
import { createOrder, makeEnv } from "./helpers.js";

describe("day list for the calendar", () => {
  it("returns opening hours of the weekday and expected completions of the date", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const now = (await env.api(owner, "GET", "/api/demo/clock")).json.now as string;
    const d = new Date(now);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const a = await createOrder(env, owner, { item: "Fertig heute", estimatedCompletion: date });
    const b = await createOrder(env, owner, { item: "Fertig heute zwei", estimatedCompletion: date });
    const cancelled = await createOrder(env, owner, { item: "Storniert", estimatedCompletion: date });
    await env.api(owner, "POST", `/api/betrieb/orders/${cancelled.id}/status`, { status: "STORNIERT" });
    await createOrder(env, owner, { item: "Anderer Tag", estimatedCompletion: "2030-01-01" });

    const day = (await env.api(owner, "GET", `/api/betrieb/day-slots?date=${date}`)).json;
    const codes = day.completions.map((c: { code: string }) => c.code);
    expect(codes).toContain(a.code);
    expect(codes).toContain(b.code);
    expect(codes).not.toContain(cancelled.code);
    expect(day.completions.every((c: { status: string }) => c.status !== "STORNIERT")).toBe(true);
    expect([...codes]).toEqual([...codes].sort());
    expect(Array.isArray(day.openingHours)).toBe(true);
  });

  it("gives two intervals on a weekday and none on Sunday", async () => {
    const env = makeEnv();
    const owner = await env.token();
    // 2030-01-07 is a Monday, 2030-01-06 a Sunday
    const mon = (await env.api(owner, "GET", "/api/betrieb/day-slots?date=2030-01-07")).json;
    expect(mon.openingHours).toEqual([
      { open: "09:00", close: "13:00" },
      { open: "14:00", close: "18:00" },
    ]);
    const sun = (await env.api(owner, "GET", "/api/betrieb/day-slots?date=2030-01-06")).json;
    expect(sun.openingHours).toEqual([]);
    expect(sun.entries).toEqual([]);
    expect(sun.completions).toEqual([]);
  });
});
