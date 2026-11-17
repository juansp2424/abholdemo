import { describe, expect, it } from "vitest";
import { PUB, createOrder, makeEnv, setStatus } from "./helpers.js";

async function setup(capacity = 1) {
  const env = makeEnv();
  const owner = await env.token();
  const s = env.db().settings;
  await env.api(owner, "PUT", "/api/betrieb/settings", { ...s, slotCapacity: capacity });
  const mk = async () => {
    const o = await createOrder(env, owner);
    await setStatus(env, owner, o.id, "ABHOLBEREIT");
    return o;
  };
  const slots = async (code: string) => (await env.pub("GET", `${PUB}/orders/${code}/slots`)).json.days.flatMap((d: any) => d.slots);
  const book = (code: string, start: string) => env.pub("PUT", `${PUB}/orders/${code}/slot`, { start });
  return { env, owner, mk, slots, book };
}

describe("slot booking", () => {
  it("rejects a second booking of a full slot (capacity 1)", async () => {
    const { mk, slots, book } = await setup(1);
    const a = await mk();
    const b = await mk();
    const free = (await slots(a.code)).filter((s: any) => s.free > 0);
    const target = free[1].start; // free[0] ... any free slot
    expect((await book(a.code, target)).status).toBe(200);
    const second = await book(b.code, target);
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe("SLOT_FULL");
    expect(second.json.error.message).toContain("voll");
  });

  it("rebooking replaces the own booking and frees the old slot", async () => {
    const { env, mk, slots, book } = await setup(1);
    const a = await mk();
    const b = await mk();
    const list = await slots(a.code);
    const [s1, s2] = [list[2].start, list[3].start];
    expect((await book(a.code, s1)).status).toBe(200);
    const view = await book(a.code, s2);
    expect(view.json.slot.start).toBe(s2);
    expect(env.db().orders.filter((o) => o.booking && !o.booking.released && o.code === a.code)).toHaveLength(1);
    expect((await book(b.code, s1)).status).toBe(200); // old slot is free again
    expect((await book(a.code, s2)).status).toBe(200); // booking the own slot again is fine
  });

  it("lists the own full slot, hides slots full for others", async () => {
    const { mk, slots, book } = await setup(1);
    const a = await mk();
    const b = await mk();
    const target = (await slots(a.code))[2].start;
    await book(a.code, target);
    const forA = await slots(a.code);
    const forB = await slots(b.code);
    expect(forA.find((s: any) => s.start === target)?.free).toBe(0);
    expect(forB.find((s: any) => s.start === target)).toBeUndefined();
  });

  it("ABGEHOLT releases the capacity but the booking stays in the day list", async () => {
    const { env, owner, mk, slots, book } = await setup(1);
    const a = await mk();
    const c = await mk();
    const target = (await slots(a.code))[4].start;
    await book(a.code, target);
    expect((await book(c.code, target)).status).toBe(409);
    expect((await setStatus(env, owner, a.id, "ABGEHOLT")).status).toBe(200);
    expect((await book(c.code, target)).status).toBe(200);
    const date = `${new Date(target).getFullYear()}-${String(new Date(target).getMonth() + 1).padStart(2, "0")}-${String(new Date(target).getDate()).padStart(2, "0")}`;
    const day = await env.api(owner, "GET", `/api/betrieb/day-slots?date=${date}`);
    const entry = day.json.entries.filter((e: any) => e.code === a.code);
    expect(entry).toHaveLength(1);
    expect(entry[0].attendance).toBe("ERSCHIENEN");
    expect(day.json.entries.find((e: any) => e.code === c.code).attendance).toBe("ERWARTET");
    const detail = await env.api(owner, "GET", `/api/betrieb/orders/${a.id}`);
    expect(detail.json.slot).toBeNull(); // released: no active slot
  });

  it("STORNIERT releases the slot and customer cancel removes it", async () => {
    const { env, owner, mk, slots, book } = await setup(1);
    const a = await mk();
    const b = await mk();
    const target = (await slots(a.code))[5].start;
    await book(a.code, target);
    await setStatus(env, owner, a.id, "STORNIERT");
    expect((await book(b.code, target)).status).toBe(200);
    const del = await env.pub("DELETE", `${PUB}/orders/${b.code}/slot`);
    expect(del.status).toBe(200);
    expect(del.json.slot).toBeNull();
    const day = await env.api(owner, "GET", "/api/betrieb/day-slots");
    expect(day.json.entries.find((e: any) => e.code === a.code)).toBeUndefined();
    expect(day.json.entries.find((e: any) => e.code === b.code)).toBeUndefined();
  });

  it("rejects slots that do not exist or are in the past", async () => {
    const { env, mk, book } = await setup(2);
    const a = await mk();
    const odd = await book(a.code, new Date(2026, 10, 12, 9, 7).toISOString());
    expect(odd.status).toBe(400);
    expect(odd.json.error.code).toBe("SLOT_INVALID");
    expect((await book(a.code, new Date(2026, 10, 11, 9, 0).toISOString())).json.error.code).toBe("SLOT_INVALID"); // past
    expect((await book(a.code, new Date(2026, 10, 15, 10, 0).toISOString())).json.error.code).toBe("SLOT_INVALID"); // Sunday
    expect((await book(a.code, "kaputt")).json.error.code).toBe("SLOT_INVALID");
    void env;
  });

  it("booking needs a ready order", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const o = await createOrder(env, owner);
    const r = await env.pub("PUT", `${PUB}/orders/${o.code}/slot`, { start: new Date(2026, 10, 12, 9, 0).toISOString() });
    expect(r.status).toBe(409);
  });

  it("day list marks missed slots", async () => {
    const env = makeEnv();
    const owner = await env.token();
    let day = await env.api(owner, "GET", "/api/betrieb/day-slots");
    const seedEntry = (list: any) => list.entries.find((e: any) => e.code === "7KP4QX");
    expect(seedEntry(day.json).attendance).toBe("ERWARTET");
    expect(day.json.entries.find((e: any) => e.code === "Z5MA9H").attendance).toBe("ERSCHIENEN");
    env.time.value += 3 * 3_600_000;
    day = await env.api(owner, "GET", "/api/betrieb/day-slots");
    expect(seedEntry(day.json).attendance).toBe("NICHT_ERSCHIENEN");
  });
});

describe("slots follow the opening hours", () => {
  it("never books the lunch break, before opening or after closing", async () => {
    const { mk, book } = await setup(2);
    const a = await mk();
    // Thursday 2026-11-12: open 09:00 to 13:00 and 14:00 to 18:00
    for (const [h, m] of [[13, 0], [13, 30], [8, 45], [18, 0], [18, 15]]) {
      expect((await book(a.code, new Date(2026, 10, 12, h, m).toISOString())).json.error.code).toBe("SLOT_INVALID");
    }
    expect((await book(a.code, new Date(2026, 10, 12, 12, 45).toISOString())).status).toBe(200); // last slot before the break
    expect((await book(a.code, new Date(2026, 10, 12, 14, 0).toISOString())).status).toBe(200); // first slot after the break
  });

  it("releases upcoming bookings that no longer fit after the owner changes the hours, keeps the others", async () => {
    const { env, owner, mk, book } = await setup(2);
    const morning = await mk();
    const afternoon = await mk();
    expect((await book(morning.code, new Date(2026, 10, 12, 10, 0).toISOString())).status).toBe(200);
    expect((await book(afternoon.code, new Date(2026, 10, 12, 15, 0).toISOString())).status).toBe(200);
    const s = env.db().settings;
    const afternoonOnly = { ...s.openingHours, do: [{ open: "14:00", close: "18:00" }] };
    const saved = await env.api(owner, "PUT", "/api/betrieb/settings", { ...s, openingHours: afternoonOnly });
    expect(saved.status).toBe(200);
    expect(saved.json.releasedBookings).toBe(1);
    const view = (code: string) => env.pub("GET", `${PUB}/orders/${code}`);
    expect((await view(morning.code)).json.slot).toBeNull();
    expect((await view(afternoon.code)).json.slot).not.toBeNull();
    // A slot length that no longer matches the booked start is dropped as well
    const again = await env.api(owner, "PUT", "/api/betrieb/settings", { ...env.db().settings, slotLengthMinutes: 45 });
    expect(again.json.releasedBookings).toBeGreaterThanOrEqual(1); // 15:00 is not a 45 minute slot start (14:00, 14:45, 15:30, ...); the seed booking may go too
    expect((await view(afternoon.code)).json.slot).toBeNull();
  });

  it("does not touch past bookings or picked up orders", async () => {
    const { env, owner, mk, book } = await setup(2);
    const a = await mk();
    await book(a.code, new Date(2026, 10, 12, 10, 0).toISOString());
    await setStatus(env, owner, a.id, "ABGEHOLT");
    env.time.value = new Date(2026, 10, 13, 9, 0).getTime(); // booking is now in the past
    const s = env.db().settings;
    const saved = await env.api(owner, "PUT", "/api/betrieb/settings", { ...s, openingHours: { ...s.openingHours, do: [] } });
    expect(saved.json.releasedBookings).toBe(0);
    expect(env.db().orders.find((o) => o.code === a.code)?.booking).not.toBeNull();
  });
});
