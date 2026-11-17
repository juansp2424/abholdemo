import { describe, expect, it } from "vitest";
import { createOrder, makeEnv } from "./helpers.js";

describe("auth and roles", () => {
  it("logs in both demo users and rejects wrong credentials", async () => {
    const env = makeEnv();
    const ok = await env.pub("POST", "/api/auth/login", { username: "inhaber", password: "demo1234" });
    expect(ok.status).toBe(200);
    expect(ok.json.user).toEqual({ id: "u1", username: "inhaber", displayName: "Maria Leisten", role: "INHABER", active: true });
    expect(ok.json.user.passwordHash).toBeUndefined();
    expect((await env.pub("POST", "/api/auth/login", { username: "mitarbeiter", password: "demo1234" })).status).toBe(200);
    for (const body of [{ username: "inhaber", password: "falsch" }, { username: "niemand", password: "x" }, {}]) {
      const r = await env.pub("POST", "/api/auth/login", body);
      expect(r.status).toBe(401);
      expect(r.json.error.message).toBe("Benutzername oder Passwort stimmt nicht.");
    }
    expect(env.db().users[0].passwordHash.startsWith("scrypt$")).toBe(true);
  });

  it("needs a token for betrieb and demo endpoints, logout revokes it", async () => {
    const env = makeEnv();
    for (const url of ["/api/betrieb/orders", "/api/betrieb/business", "/api/demo/clock", "/api/auth/me"]) {
      expect((await env.pub("GET", url)).status, url).toBe(401);
    }
    expect((await env.api("falsch", "GET", "/api/betrieb/orders")).status).toBe(401);
    const t = await env.token("mitarbeiter");
    expect((await env.api(t, "GET", "/api/auth/me")).json.username).toBe("mitarbeiter");
    expect((await env.api(t, "POST", "/api/auth/logout")).status).toBe(204);
    expect((await env.api(t, "GET", "/api/auth/me")).status).toBe(401);
  });

  it("MITARBEITER gets 403 on settings and staff, but may use the rest", async () => {
    const env = makeEnv();
    const t = await env.token("mitarbeiter");
    const checks: [string, string, unknown?][] = [
      ["GET", "/api/betrieb/settings"],
      ["PUT", "/api/betrieb/settings", env.db().settings],
      ["POST", "/api/betrieb/settings/preview", { template: "x" }],
      ["GET", "/api/betrieb/staff"],
      ["POST", "/api/betrieb/staff", { username: "neu.neu", displayName: "N", role: "MITARBEITER", password: "123456" }],
      ["PATCH", "/api/betrieb/staff/u1", { active: false }],
    ];
    for (const [m, u, p] of checks) {
      const r = await env.api(t, m, u, p);
      expect(r.status, `${m} ${u}`).toBe(403);
      expect(r.json.error).toEqual({ code: "FORBIDDEN", message: "Nur für Inhaber." });
    }
    expect((await env.api(t, "GET", "/api/betrieb/orders")).status).toBe(200);
    expect((await env.api(t, "GET", "/api/betrieb/business")).json.webname).toBe("werkstatt-demo");
    expect((await env.api(t, "GET", "/api/demo/clock")).status).toBe(200);
    expect((await createOrder(env, t)).log[0].actorName).toBe("Tom Werner");
  });
});

describe("staff management", () => {
  const newUser = { username: "neu.kraft", displayName: "Nina Neu", role: "MITARBEITER", password: "geheim12" };

  it("creates staff, rejects bad input and duplicates", async () => {
    const env = makeEnv();
    const t = await env.token();
    const r = await env.api(t, "POST", "/api/betrieb/staff", newUser);
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ username: "neu.kraft", role: "MITARBEITER", active: true });
    expect(r.json.passwordHash).toBeUndefined();
    expect((await env.api(t, "POST", "/api/betrieb/staff", newUser)).status).toBe(400);
    expect((await env.api(t, "POST", "/api/betrieb/staff", { ...newUser, username: "AB" })).status).toBe(400);
    expect((await env.api(t, "POST", "/api/betrieb/staff", { ...newUser, username: "okay.name", password: "123" })).status).toBe(400);
    expect((await env.api(t, "GET", "/api/betrieb/staff")).json).toHaveLength(3);
    const login = await env.pub("POST", "/api/auth/login", { username: "neu.kraft", password: "geheim12" });
    expect(login.status).toBe(200);
  });

  it("deactivation blocks login and revokes existing tokens", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const staffToken = await env.token("mitarbeiter");
    const r = await env.api(owner, "PATCH", "/api/betrieb/staff/u2", { active: false });
    expect(r.status).toBe(200);
    expect(r.json.active).toBe(false);
    expect((await env.api(staffToken, "GET", "/api/betrieb/orders")).status).toBe(401);
    const login = await env.pub("POST", "/api/auth/login", { username: "mitarbeiter", password: "demo1234" });
    expect(login.status).toBe(401);
    expect(env.db().tokens.some((t) => t.userId === "u2")).toBe(false);
    const back = await env.api(owner, "PATCH", "/api/betrieb/staff/u2", { active: true });
    expect(back.json.active).toBe(true);
    expect((await env.pub("POST", "/api/auth/login", { username: "mitarbeiter", password: "demo1234" })).status).toBe(200);
  });

  it("an owner cannot deactivate themselves or remove the last active owner", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const self = await env.api(owner, "PATCH", "/api/betrieb/staff/u1", { active: false });
    expect(self.status).toBe(409);
    expect(self.json.error.code).toBe("NOT_ALLOWED");
    expect((await env.api(owner, "PATCH", "/api/betrieb/staff/u1", { role: "MITARBEITER" })).status).toBe(409);

    // second owner: now u1 may be deactivated by u3, but u3 is then the last owner
    const u3 = (await env.api(owner, "POST", "/api/betrieb/staff", { ...newUser, role: "INHABER" })).json;
    const t3 = (await env.pub("POST", "/api/auth/login", { username: "neu.kraft", password: "geheim12" })).json.token;
    expect((await env.api(t3, "PATCH", "/api/betrieb/staff/u1", { active: false })).status).toBe(200);
    expect((await env.api(owner, "GET", "/api/betrieb/staff")).status).toBe(401); // u1 token revoked
    expect((await env.api(t3, "PATCH", `/api/betrieb/staff/${u3.id}`, { role: "MITARBEITER" })).status).toBe(409);
    expect((await env.api(t3, "PATCH", `/api/betrieb/staff/${u3.id}`, { displayName: "Nina Neuer" })).json.displayName).toBe("Nina Neuer");
    expect((await env.api(t3, "PATCH", "/api/betrieb/staff/u99", { active: false })).status).toBe(404);
  });
});

describe("settings", () => {
  it("validates and stores settings, previews the message", async () => {
    const env = makeEnv();
    const t = await env.token();
    const cur = (await env.api(t, "GET", "/api/betrieb/settings")).json;
    expect(cur.webname).toBe("werkstatt-demo");
    const put = (patch: object) => env.api(t, "PUT", "/api/betrieb/settings", { ...cur, ...patch });
    expect((await put({ slotLengthMinutes: 20 })).status).toBe(400);
    expect((await put({ slotCapacity: 0 })).status).toBe(400);
    expect((await put({ pickupDeadlineDays: 61 })).status).toBe(400);
    expect((await put({ messageTemplate: "kurz" })).status).toBe(400);
    expect((await put({ defaultChannel: "FAX" })).status).toBe(400);
    expect((await put({ openingHours: { ...cur.openingHours, mo: [{ open: "10:00", close: "09:00" }] } })).status).toBe(400);
    expect((await put({ openingHours: { ...cur.openingHours, mo: [{ open: "09:00", close: "12:00" }, { open: "11:00", close: "13:00" }] } })).status).toBe(400);
    const noLink = await put({ messageTemplate: "Ihr Auftrag ist fertig, bitte kommen Sie vorbei." });
    expect(noLink.status).toBe(400);
    expect(noLink.json.error).toEqual({
      code: "VALIDATION",
      message: "Der Nachrichtentext muss {link} enthalten, damit der Kunde eine Abholzeit wählen kann.",
    });
    const ok = await put({ webname: "hacker", name: "Neuer Name", pickupDeadlineDays: 7, slotCapacity: 3 });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ webname: "werkstatt-demo", name: "Neuer Name", pickupDeadlineDays: 7, slotCapacity: 3 });
    const prev = await env.api(t, "POST", "/api/betrieb/settings/preview", { template: "Fertig: {nummer} bei {betrieb} {link}" });
    expect(prev.json.text).toBe("Fertig: ABC234 bei Neuer Name http://localhost:5174/b/werkstatt-demo/a/ABC234 Keine Nachricht mehr? Abbestellen: http://localhost:5174/b/werkstatt-demo/a/ABC234?abmelden=1");
  });
});

describe("quick categories", () => {
  it("starts with the two demo entries, is owner defined, validated, trimmed, unique and visible to all staff", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const staff = await env.token("mitarbeiter");
    const demo = ["Wartung Paket 1", "Reifenwechsel (Sommer) mit Einlagerung"];
    expect((await env.api(owner, "GET", "/api/betrieb/settings")).json.quickCategories).toEqual(demo);
    expect((await env.api(staff, "GET", "/api/betrieb/business")).json.quickCategories).toEqual(demo);
    const cur = (await env.api(owner, "GET", "/api/betrieb/settings")).json;
    const put = (quickCategories: unknown) => env.api(owner, "PUT", "/api/betrieb/settings", { ...cur, quickCategories });
    const ok = await put(["  Ölwechsel ", "Reifenwechsel", "Schlauch   wechseln"]);
    expect(ok.status).toBe(200);
    expect(ok.json.quickCategories).toEqual(["Ölwechsel", "Reifenwechsel", "Schlauch wechseln"]);
    expect((await env.api(staff, "GET", "/api/betrieb/business")).json.quickCategories).toEqual(["Ölwechsel", "Reifenwechsel", "Schlauch wechseln"]);
    expect((await put(["Ölwechsel", "ölwechsel"])).status).toBe(400);
    expect((await put([""])).status).toBe(400);
    expect((await put(["x".repeat(41)])).status).toBe(400);
    expect((await put(Array.from({ length: 21 }, (_, i) => `Eintrag ${i}`))).status).toBe(400);
    expect((await put("Ölwechsel")).status).toBe(400);
    // Omitting the field keeps the current list
    const { quickCategories: _omit, ...withoutList } = cur;
    const keep = await env.api(owner, "PUT", "/api/betrieb/settings", withoutList);
    expect(keep.json.quickCategories).toEqual(["Ölwechsel", "Reifenwechsel", "Schlauch wechseln"]);
    expect((await env.api(staff, "PUT", "/api/betrieb/settings", cur)).status).toBe(403);
  });
});

describe("demo reset", () => {
  it("restores the seed, resets the clock and keeps seed user tokens", async () => {
    const env = makeEnv();
    const owner = await env.token();
    await createOrder(env, owner);
    await env.api(owner, "POST", "/api/demo/advance", { days: 20 });
    await env.api(owner, "POST", "/api/betrieb/staff", { username: "zeitweise", displayName: "Z", role: "MITARBEITER", password: "123456" });
    const r = await env.api(owner, "POST", "/api/demo/reset");
    expect(r.status).toBe(200);
    expect(r.json.offsetDays).toBe(0);
    expect(r.json.now).toBe(new Date(env.time.value).toISOString());
    const list = await env.api(owner, "GET", "/api/betrieb/orders");
    expect(list.status).toBe(200);
    expect(list.json).toHaveLength(10);
    expect(list.json.filter((o: any) => o.status === "UEBERFAELLIG")).toHaveLength(1);
    expect((await env.api(owner, "GET", "/api/betrieb/staff")).json).toHaveLength(2);
  });
});
