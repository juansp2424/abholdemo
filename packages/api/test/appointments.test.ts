import { describe, expect, it } from "vitest";
import { DAY_MS } from "../src/clock.js";
import { makeEnv } from "./helpers.js";

const WEB = "/api/public/b/werkstatt-demo/dropoff";
const person = { service: "Wartung Paket 1", item: "Fahrrad, Rennrad", customerName: "Kim Test", customerPhone: "+49 151 00000077", channel: "SMS" };

async function setup() {
  const env = makeEnv();
  const owner = await env.token();
  const info = await env.pub("GET", WEB);
  const first = info.json.days[0].slots[0];
  const book = (extra: Record<string, unknown> = {}, opts?: { remoteAddress?: string }) => env.pub("POST", WEB, { ...person, start: first.start, ...extra }, opts);
  return { env, owner, info: info.json, first, book };
}

describe("drop-off appointments, customer side", () => {
  it("lists free windows from tomorrow with the quick selection as services", async () => {
    const { info } = await setup();
    expect(info.enabled).toBe(true);
    expect(info.services).toEqual(["Wartung Paket 1", "Reifenwechsel (Sommer) mit Einlagerung"]);
    const tomorrow = new Date(2026, 10, 12).getTime();
    expect(Date.parse(info.days[0].slots[0].start)).toBeGreaterThanOrEqual(tomorrow);
    expect(info.days.length).toBeGreaterThan(5);
  });

  it("books, confirms by message without name or item, and shows the appointment by its secret link", async () => {
    const { env, book } = await setup();
    const r = await book();
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ businessName: "Werkstatt Demo", service: "Wartung Paket 1", state: "GEBUCHT", changeable: true, orderCode: null });
    expect(r.json.token).toMatch(/^[23456789A-Z]{10}$/);
    expect(JSON.stringify(r.json)).not.toMatch(/Kim|00000077/);
    const msg = env.db().messages.at(-1)!;
    expect(msg).toMatchObject({ type: "TERMIN_BESTAETIGUNG", channel: "SMS", recipient: "+49 151 00000077", orderId: "" });
    expect(msg.text).toContain(`/termin/${r.json.token}`);
    expect(msg.text).not.toMatch(/Kim|Rennrad/);
    expect((await env.pub("GET", `/api/public/appointments/${r.json.token}`)).json.state).toBe("GEBUCHT");
    expect((await env.pub("GET", "/api/public/appointments/XXXXXXXXXX")).status).toBe(404);
  });

  it("respects capacity, valid windows and validation", async () => {
    const { book, env } = await setup();
    expect((await book({ customerPhone: "+49 151 00000071" })).status).toBe(201);
    expect((await book({ customerPhone: "+49 151 00000072" })).status).toBe(201);
    expect((await book({ customerPhone: "+49 151 00000073" })).status).toBe(409); // capacity 2
    expect((await book({ start: new Date(2026, 10, 11, 23, 0).toISOString() })).status).toBe(400);
    for (const bad of [{ service: "" }, { item: " " }, { customerName: "" }, { customerPhone: "abc" }, { channel: "MAIL" }, { channel: "FAX" }, { customerEmail: "nope" }]) {
      expect((await book({ ...bad, customerPhone: bad.customerPhone ?? "+49 151 00000079" })).status).toBe(400);
    }
    expect((await book({ website: "http://spam" })).status).toBe(400);
    expect(env.db().appointments.filter((a) => a.state === "GEBUCHT").length).toBe(3 + 2); // seed has three
  });

  it("allows at most three open appointments per phone number", async () => {
    const { info, env } = await setup();
    const slots = info.days.flatMap((d: any) => d.slots).slice(0, 4);
    const res = [];
    for (const s of slots) res.push((await env.pub("POST", WEB, { ...person, start: s.start })).status);
    expect(res).toEqual([201, 201, 201, 409]);
  });

  it("cancels and rebooks by the link; rebooking sends a message", async () => {
    const { env, book, info } = await setup();
    const t = (await book()).json.token;
    const other = info.days[1].slots[0].start;
    const r = await env.pub("PUT", `/api/public/appointments/${t}`, { start: other });
    expect(r.status).toBe(200);
    expect(r.json.start).toBe(other);
    expect(env.db().messages.at(-1)!.type).toBe("TERMIN_GEAENDERT");
    expect((await env.pub("GET", `/api/public/appointments/${t}/slots`)).json.days.length).toBeGreaterThan(0);
    expect((await env.pub("DELETE", `/api/public/appointments/${t}`)).json.state).toBe("ABGESAGT_KUNDE");
    expect((await env.pub("DELETE", `/api/public/appointments/${t}`)).status).toBe(409);
  });

  it("is closed when the business switches it off", async () => {
    const { env, owner, book } = await setup();
    const s = (await env.api(owner, "GET", "/api/betrieb/settings")).json;
    expect((await env.api(owner, "PUT", "/api/betrieb/settings", { ...s, dropOffEnabled: false })).status).toBe(200);
    expect((await env.pub("GET", WEB)).json).toMatchObject({ enabled: false, days: [] });
    expect((await book()).status).toBe(409);
    expect((await env.api(owner, "PUT", "/api/betrieb/settings", { ...s, dropOffCapacity: 11 })).status).toBe(400);
  });
});

describe("drop-off appointments, staff side and over time", () => {
  it("turns an appointment into an order with prefilled fields", async () => {
    const { env, owner, book } = await setup();
    const t = (await book({ customerEmail: "kim@beispiel.de" })).json.token;
    const a = env.db().appointments.find((x) => x.token === t)!;
    const r = await env.api(owner, "POST", `/api/betrieb/appointments/${a.id}/convert`);
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ item: "Fahrrad, Rennrad", category: "Wartung Paket 1", customerName: "Kim Test", customerPhone: "+49 151 00000077", customerEmail: "kim@beispiel.de", status: "ANGENOMMEN" });
    expect(a).toMatchObject({ state: "ERSCHIENEN", orderId: r.json.id });
    expect((await env.pub("GET", `/api/public/appointments/${t}`)).json).toMatchObject({ orderCode: r.json.code, changeable: false });
    expect((await env.api(owner, "POST", `/api/betrieb/appointments/${a.id}/convert`)).status).toBe(409);
    const day = new Date(Date.parse(a.start)).toISOString().slice(0, 10);
    void day;
  });

  it("lists appointments per day, marks no-show and cancels with a message", async () => {
    const { env, owner, book } = await setup();
    const t = (await book()).json.token;
    const a = env.db().appointments.find((x) => x.token === t)!;
    const local = new Date(Date.parse(a.start));
    const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    const list = await env.api(owner, "GET", `/api/betrieb/appointments?date=${date}`);
    expect(list.json.map((x: any) => x.id)).toContain(a.id);
    expect((await env.api(owner, "GET", `/api/betrieb/day-slots?date=${date}`)).json.dropOffs.map((x: any) => x.id)).toContain(a.id);
    expect((await env.api(owner, "POST", `/api/betrieb/appointments/${a.id}/cancel`)).json.state).toBe("ABGESAGT_BETRIEB");
    expect(env.db().messages.at(-1)!).toMatchObject({ type: "TERMIN_ABSAGE", link: expect.stringContaining("/b/werkstatt-demo/termin") });
    expect((await env.api(owner, "POST", `/api/betrieb/appointments/${a.id}/no-show`)).status).toBe(409);
    expect((await env.pub("POST", `/api/betrieb/appointments/${a.id}/no-show`)).status).toBe(401);
  });

  it("sends one reminder the day before and marks no-show after the day", async () => {
    const { env, owner, book, info } = await setup();
    const later = info.days[2].slots[0].start; // two or more days ahead
    const t = (await book({ start: later })).json.token;
    const a = env.db().appointments.find((x) => x.token === t)!;
    const reminders = () => env.db().messages.filter((m) => m.appointmentId === a.id && m.type === "TERMIN_ERINNERUNG").length;
    const touch = () => env.api(owner, "GET", "/api/betrieb/orders");
    const daysUntil = Math.round((new Date(Date.parse(later)).setHours(0, 0, 0, 0) - new Date(2026, 10, 11).getTime()) / DAY_MS);
    await env.api(owner, "POST", "/api/demo/advance", { days: daysUntil - 1 });
    await touch();
    await touch();
    expect(reminders()).toBe(1);
    await env.api(owner, "POST", "/api/demo/advance", { days: 2 });
    await touch();
    expect(a.state).toBe("NICHT_ERSCHIENEN");
  });
});
