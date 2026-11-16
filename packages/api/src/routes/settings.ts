import type { FastifyInstance } from "fastify";
import {
  SLOT_LENGTH_OPTIONS,
  WEEKDAYS,
  type BusinessSettings,
  type Channel,
  type OpeningHours,
  type Role,
  type StaffUser,
  type TimeInterval,
} from "@abholdemo/shared";
import type { Ctx } from "../context.js";
import { renderTemplate, unsubscribeSuffix } from "../messages.js";
import { statusUrl } from "@abholdemo/shared";
import { ownerOnly } from "../guards.js";
import { hashPassword } from "../password.js";
import type { UserRec } from "../types.js";
import { asObject, fail, invalid, optText } from "../validation.js";
import { toStaffUser } from "./auth.js";

const CHANNELS: Channel[] = ["MAIL", "SMS", "WHATSAPP"];
const ROLES: Role[] = ["INHABER", "MITARBEITER"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOGO_RE = /^data:image\/(png|jpeg|webp|svg\+xml|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

function parseOpeningHours(value: unknown): OpeningHours {
  const src = asObject(value);
  const result = {} as OpeningHours;
  for (const day of WEEKDAYS) {
    const list = src[day];
    if (!Array.isArray(list) || list.length > 2) invalid("Die Öffnungszeiten sind nicht gültig. Höchstens zwei Zeitfenster pro Tag.");
    const intervals: TimeInterval[] = (list as unknown[]).map((raw) => {
      const iv = asObject(raw);
      if (typeof iv.open !== "string" || typeof iv.close !== "string" || !HHMM.test(iv.open) || !HHMM.test(iv.close)) {
        return invalid("Die Uhrzeiten müssen die Form 09:00 haben.");
      }
      if (iv.open >= iv.close) return invalid("Die Öffnungszeit muss vor der Schließzeit liegen.");
      return { open: iv.open, close: iv.close };
    });
    intervals.sort((a, b) => a.open.localeCompare(b.open));
    if (intervals.length === 2 && intervals[1].open < intervals[0].close) {
      invalid("Die zwei Zeitfenster eines Tages dürfen sich nicht überschneiden.");
    }
    result[day] = intervals;
  }
  return result;
}

function parseSettings(body: unknown, webname: string): BusinessSettings {
  const b = asObject(body);
  const name = optText(b.name, "Der Name des Betriebs", 60);
  if (!name) invalid("Bitte geben Sie den Namen des Betriebs an.");
  let logoDataUrl: string | null = null;
  if (b.logoDataUrl !== null && b.logoDataUrl !== undefined && b.logoDataUrl !== "") {
    if (typeof b.logoDataUrl !== "string" || b.logoDataUrl.length > 420_000 || !LOGO_RE.test(b.logoDataUrl)) {
      invalid("Das Logo kann nicht gespeichert werden. Es darf höchstens 300 KB groß sein.");
    }
    logoDataUrl = b.logoDataUrl as string;
  }
  const slotLength = b.slotLengthMinutes;
  if (typeof slotLength !== "number" || !(SLOT_LENGTH_OPTIONS as readonly number[]).includes(slotLength)) {
    invalid("Die Länge der Abholzeiten muss 15, 30, 45 oder 60 Minuten sein.");
  }
  const cap = b.slotCapacity;
  if (typeof cap !== "number" || !Number.isInteger(cap) || cap < 1 || cap > 10) {
    invalid("Die Anzahl pro Abholzeit muss eine ganze Zahl von 1 bis 10 sein.");
  }
  const days = b.pickupDeadlineDays;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 60) {
    invalid("Die Abholfrist muss eine ganze Zahl von 1 bis 60 Tagen sein.");
  }
  if (typeof b.defaultChannel !== "string" || !CHANNELS.includes(b.defaultChannel as Channel)) {
    invalid("Der Standardkanal muss Mail, SMS oder WhatsApp sein.");
  }
  const template = typeof b.messageTemplate === "string" ? b.messageTemplate.trim() : "";
  if (template.length < 10 || template.length > 500) invalid("Der Nachrichtentext muss 10 bis 500 Zeichen lang sein.");
  if (!template.includes("{link}")) {
    invalid("Der Nachrichtentext muss {link} enthalten, damit der Kunde eine Abholzeit wählen kann.");
  }
  return {
    name,
    webname,
    logoDataUrl,
    openingHours: parseOpeningHours(b.openingHours),
    slotLengthMinutes: slotLength as BusinessSettings["slotLengthMinutes"],
    slotCapacity: cap as number,
    pickupDeadlineDays: days as number,
    defaultChannel: b.defaultChannel as Channel,
    messageTemplate: template,
  };
}

export function settingsRoutes(app: FastifyInstance, ctx: Ctx) {
  const db = () => ctx.store.db;
  const guard = { preHandler: ownerOnly };

  app.get("/api/betrieb/settings", guard, async () => db().settings);

  app.put("/api/betrieb/settings", guard, async (req) => {
    db().settings = parseSettings(req.body, db().settings.webname);
    return db().settings;
  });

  app.post("/api/betrieb/settings/preview", guard, async (req) => {
    const template = asObject(req.body).template;
    if (typeof template !== "string") return invalid("Bitte geben Sie einen Nachrichtentext an.");
    const s = db().settings;
    const link = statusUrl(s.webname, "ABC234");
    return { text: renderTemplate(template, { betrieb: s.name, nummer: "ABC234", link }) + unsubscribeSuffix("MAIL", link) };
  });

  // ---- staff ----

  app.get("/api/betrieb/staff", guard, async (): Promise<StaffUser[]> => db().users.map(toStaffUser));

  app.post("/api/betrieb/staff", guard, async (req, reply): Promise<StaffUser> => {
    const b = asObject(req.body);
    const username = typeof b.username === "string" ? b.username.trim() : "";
    if (!/^[a-z0-9.]{3,30}$/.test(username)) {
      invalid("Der Benutzername muss 3 bis 30 Zeichen haben. Erlaubt sind kleine Buchstaben, Ziffern und Punkte.");
    }
    const displayName = optText(b.displayName, "Der Name", 60);
    if (!displayName) invalid("Bitte geben Sie einen Namen an.");
    if (typeof b.role !== "string" || !ROLES.includes(b.role as Role)) invalid("Bitte wählen Sie eine Rolle.");
    if (typeof b.password !== "string" || b.password.length < 6 || b.password.length > 100) {
      invalid("Das Passwort muss mindestens 6 Zeichen haben.");
    }
    if (db().users.some((u) => u.username === username)) invalid("Dieser Benutzername ist schon vergeben.");
    const user: UserRec = {
      id: `u${++db().counters.user}`,
      username,
      displayName: displayName as string,
      role: b.role as Role,
      active: true,
      passwordHash: hashPassword(b.password as string),
    };
    db().users.push(user);
    reply.code(201);
    return toStaffUser(user);
  });

  app.patch("/api/betrieb/staff/:id", guard, async (req): Promise<StaffUser> => {
    const d = db();
    const user = d.users.find((u) => u.id === (req.params as { id: string }).id);
    if (!user) return fail(404, "NOT_FOUND", "Mitarbeiter nicht gefunden.");
    const b = asObject(req.body);
    const self = (req.user as UserRec).id === user.id;

    let active = user.active;
    let role = user.role;
    let displayName = user.displayName;
    if (b.active !== undefined) {
      if (typeof b.active !== "boolean") invalid("Die Angabe zum Zugang ist nicht gültig.");
      active = b.active as boolean;
    }
    if (b.role !== undefined) {
      if (typeof b.role !== "string" || !ROLES.includes(b.role as Role)) invalid("Diese Rolle gibt es nicht.");
      role = b.role as Role;
    }
    if (b.displayName !== undefined) {
      const n = optText(b.displayName, "Der Name", 60);
      if (!n) invalid("Bitte geben Sie einen Namen an.");
      displayName = n as string;
    }

    if (self && !active && user.active) fail(409, "NOT_ALLOWED", "Sie können sich nicht selbst deaktivieren.");
    const loosesOwner = user.active && user.role === "INHABER" && (!active || role !== "INHABER");
    if (loosesOwner && d.users.filter((u) => u.active && u.role === "INHABER").length <= 1) {
      fail(409, "NOT_ALLOWED", "Es muss mindestens ein Inhaber aktiv bleiben.");
    }

    user.active = active;
    user.role = role;
    user.displayName = displayName;
    if (!active) d.tokens = d.tokens.filter((t) => t.userId !== user.id); // revoke sessions
    return toStaffUser(user);
  });
}
