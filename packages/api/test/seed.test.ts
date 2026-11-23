import { describe, expect, it } from "vitest";
import { seed } from "../src/seed.js";
import { BASE, makeEnv } from "./helpers.js";

describe("seed", () => {
  const db = seed(BASE);
  const by = (code: string) => db.orders.find((o) => o.code === code)!;

  it("has the fixed orders in the right states", () => {
    const states = Object.fromEntries(db.orders.map((o) => [o.code, o.status]));
    expect(states).toEqual({
      H7RT3K: "ANGENOMMEN", N4WZ8P: "ANGENOMMEN", Q9XB2M: "IN_ARBEIT", C6VJ5T: "IN_ARBEIT",
      "7KP4QX": "ABHOLBEREIT", D3FY6W: "ABHOLBEREIT", G8UE4R: "ABHOLBEREIT",
      RT8WMZ: "UEBERFAELLIG", Z5MA9H: "ABGEHOLT", X2SP7N: "STORNIERT",
    });
    expect(db.users.map((u) => [u.id, u.username, u.role])).toEqual([["u1", "inhaber", "INHABER"], ["u2", "mitarbeiter", "MITARBEITER"]]);
  });

  it("books 7KP4QX at the next free slot today and has consistent logs", () => {
    expect(by("7KP4QX").booking).toMatchObject({ start: new Date(2026, 10, 11, 10, 15).toISOString(), released: false });
    expect(by("Z5MA9H").booking?.released).toBe(true);
    for (const o of db.orders) {
      expect(o.log[0]).toMatchObject({ from: null, to: "ANGENOMMEN" });
      expect(o.log.at(-1)!.to).toBe(o.status);
      for (let i = 1; i < o.log.length; i++) {
        expect(o.log[i].from).toBe(o.log[i - 1].to);
        expect(Date.parse(o.log[i].at)).toBeGreaterThanOrEqual(Date.parse(o.log[i - 1].at));
      }
      expect(Date.parse(o.log.at(-1)!.at)).toBeLessThanOrEqual(BASE);
      if (o.subscription) expect(o.consentLog[0].type).toBe("ZUSTIMMUNG");
    }
    expect(by("RT8WMZ").log.at(-1)).toMatchObject({ actorName: "System", actorId: null });
  });

  it("creates the expected messages and uses invented contact data only", () => {
    const types = (code: string) => db.messages.filter((m) => m.orderId === by(code).id).map((m) => m.type);
    expect(types("H7RT3K")).toEqual(["STATUSLINK", "KOSTENVORANSCHLAG"]);
    expect(types("Q9XB2M")).toEqual(["KOSTENVORANSCHLAG"]);
    expect(types("C6VJ5T")).toEqual(["KOSTENVORANSCHLAG", "KV_ENTSCHEIDUNG"]);
    expect(types("7KP4QX")).toEqual(["ABHOLBEREIT"]);
    expect(types("G8UE4R")).toEqual(["ABHOLBEREIT"]);
    expect(types("RT8WMZ")).toEqual(["ABHOLBEREIT", "ERINNERUNG"]);
    expect(types("D3FY6W")).toEqual([]);
    for (const o of db.orders) {
      if (o.customerEmail) expect(o.customerEmail).toMatch(/@beispiel\.de$/);
      if (o.customerPhone) expect(o.customerPhone).toMatch(/^\+49 151 000000\d\d$/);
    }
  });

  it("contains no dashes in German texts", () => {
    const texts = [...db.messages.map((m) => m.text), db.settings.messageTemplate, db.settings.name];
    for (const t of texts) {
      expect(t).not.toMatch(/[–—]/);
      expect(t).not.toContain(" - ");
    }
  });

  it("seeds a fresh app and a reseed is stable", async () => {
    const env = makeEnv();
    expect(env.db().orders).toHaveLength(10);
    expect(env.db().messages).toHaveLength(9);
  });

  it("books the next opening day when today has no slots left", () => {
    const late = new Date(2026, 10, 14, 13, 30).getTime(); // Saturday after closing
    const s = seed(late);
    expect(s.orders.find((o) => o.code === "7KP4QX")!.booking!.start).toBe(new Date(2026, 10, 16, 9, 0).toISOString()); // Monday
  });

  it("keeps seed bookings inside opening hours whatever the seed time", () => {
    const times = {
      "00:05 weekday": new Date(2026, 10, 11, 0, 5).getTime(),
      "19:30 weekday": new Date(2026, 10, 11, 19, 30).getTime(),
      sunday: new Date(2026, 10, 15, 11, 0).getTime(),
      "saturday afternoon": new Date(2026, 10, 14, 15, 0).getTime(),
    };
    const days = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;
    const mins = (d: Date) => d.getHours() * 60 + d.getMinutes();
    for (const [label, now] of Object.entries(times)) {
      const s = seed(now);
      for (const code of ["Z5MA9H", "7KP4QX"]) {
        const b = s.orders.find((o) => o.code === code)!.booking!;
        expect(b, `${label} ${code}`).toBeTruthy();
        const start = new Date(b.start);
        const end = new Date(b.end);
        const hours = s.settings.openingHours[days[start.getDay()]];
        const ok = hours.some((iv) => {
          const [oh, om] = iv.open.split(":").map(Number);
          const [ch, cm] = iv.close.split(":").map(Number);
          return mins(start) >= oh * 60 + om && mins(end) <= ch * 60 + cm && end.getDate() === start.getDate();
        });
        expect(ok, `${label} ${code} ${b.start}`).toBe(true);
        expect((start.getMinutes()) % 15).toBe(0);
      }
      const z = s.orders.find((o) => o.code === "Z5MA9H")!;
      expect(Date.parse(z.booking!.end)).toBeLessThanOrEqual(now);
      expect(Date.parse(z.pickedUpAt!)).toBeLessThanOrEqual(now);
      expect(Date.parse(z.pickedUpAt!)).toBeGreaterThanOrEqual(new Date(now).setHours(0, 0, 0, 0));
      expect(Date.parse(s.orders.find((o) => o.code === "7KP4QX")!.booking!.start)).toBeGreaterThan(now);
    }
  });
});
