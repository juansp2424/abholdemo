import { DEFAULT_MESSAGE_TEMPLATE, type BusinessSettings, type Channel, type OrderStatus } from "@abholdemo/shared";
import { DAY_MS, iso } from "./clock.js";
import { addAppointmentMessage, addMessage, addSubscription, germanDate, logStatus, SYSTEM_ACTOR, type Actor } from "./domain.js";
import { hashPassword } from "./password.js";
import { dropOffDays, firstFreeSlot, generateSlotDays, lastPastSlot } from "./slots.js";
import type { AppointmentRec, Db, OrderRec } from "./types.js";

const HOUR = 3_600_000;
const DEMO_PASSWORD = "demo1234";

export function defaultSettings(): BusinessSettings {
  const weekday = [
    { open: "09:00", close: "13:00" },
    { open: "14:00", close: "18:00" },
  ];
  return {
    name: "Werkstatt Demo",
    webname: "werkstatt-demo",
    logoDataUrl: null,
    openingHours: {
      mo: weekday.map((i) => ({ ...i })),
      di: weekday.map((i) => ({ ...i })),
      mi: weekday.map((i) => ({ ...i })),
      do: weekday.map((i) => ({ ...i })),
      fr: weekday.map((i) => ({ ...i })),
      sa: [{ open: "09:00", close: "13:00" }],
      so: [],
    },
    slotLengthMinutes: 15,
    slotCapacity: 2,
    pickupDeadlineDays: 14,
    defaultChannel: "MAIL",
    messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
    quickCategories: ["Wartung Paket 1", "Reifenwechsel (Sommer) mit Einlagerung"],
    dropOffEnabled: true,
    dropOffCapacity: 2,
  };
}

/** Builds the full demo data set relative to `now` (ms). Used on first start and by demo reset. */
export function seed(now: number): Db {
  const ago = (days: number, hours = 0) => now - days * DAY_MS - hours * HOUR;
  const u1: Actor = { id: "u1", name: "Maria Leisten" };
  const u2: Actor = { id: "u2", name: "Tom Werner" };

  const db: Db = {
    offsetDays: 0,
    settings: defaultSettings(),
    users: [
      { id: "u1", username: "inhaber", displayName: u1.name, role: "INHABER", active: true, passwordHash: hashPassword(DEMO_PASSWORD) },
      { id: "u2", username: "mitarbeiter", displayName: u2.name, role: "MITARBEITER", active: true, passwordHash: hashPassword(DEMO_PASSWORD) },
    ],
    tokens: [],
    orders: [],
    appointments: [],
    messages: [],
    counters: { order: 0, message: 0, user: 2, appointment: 0 },
  };

  interface Spec {
    code: string;
    item: string;
    category?: string | null;
    name?: string;
    email?: string;
    phone?: string;
    createdAt: number;
    steps: [OrderStatus, number, Actor][]; // status changes after creation, chronological
    estimatedCompletion?: number;
    plannedPickup?: number;
    creator?: Actor;
  }

  const day = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function make(s: Spec): OrderRec {
    const o: OrderRec = {
      id: `o${++db.counters.order}`,
      code: s.code,
      item: s.item,
      category: s.category ?? null,
      customerName: s.name ?? null,
      customerEmail: s.email ?? null,
      customerPhone: s.phone ?? `+49 151 000000${String(10 + db.orders.length).padStart(2, "0")}`,
      plannedPickupDate: s.plannedPickup ? day(s.plannedPickup) : null,
      estimatedCompletion: s.estimatedCompletion ? day(s.estimatedCompletion) : null,
      status: "ANGENOMMEN",
      createdAt: iso(s.createdAt),
      readyAt: null,
      pickedUpAt: null,
      photoMime: null,
      log: [],
      subscription: null,
      consentLog: [],
      booking: null,
      readyMessageSent: false,
      reminderSent: false,
      estimates: [],
      completionLog: [],
    };
    logStatus(o, s.createdAt, null, "ANGENOMMEN", s.creator ?? u2);
    for (const [to, at, actor] of s.steps) {
      logStatus(o, at, o.status, to, actor);
      o.status = to;
      if (to === "ABHOLBEREIT") o.readyAt = iso(at);
      if (to === "ABGEHOLT") o.pickedUpAt = iso(at);
    }
    db.orders.push(o);
    return o;
  }

  function subscribe(o: OrderRec, channel: Channel, contact: string, at: number) {
    addSubscription(o, channel, contact, at);
  }

  // Chronological creation so ids follow age.
  const rt = make({
    code: "RT8WMZ", item: "Auto, Bremsen vorne wechseln", category: null, name: "Hanna Beispiel", phone: "+49 151 00000034",
    createdAt: ago(24, 2), creator: u1,
    steps: [["IN_ARBEIT", ago(22), u2], ["ABHOLBEREIT", ago(18), u1], ["UEBERFAELLIG", ago(18) + 14 * DAY_MS, SYSTEM_ACTOR]],
  });
  subscribe(rt, "SMS", "+49 151 00000034", ago(23));

  const ge = make({
    code: "G8UE4R", item: "Fahrrad, Schlauch wechseln", category: null, name: "Murat Demo", phone: "+49 151 00000056",
    createdAt: ago(14, 2), steps: [["IN_ARBEIT", ago(13), u2], ["ABHOLBEREIT", ago(12), u1]],
  });
  subscribe(ge, "WHATSAPP", "+49 151 00000056", ago(13, 1));

  const df = make({
    code: "D3FY6W", item: "Fahrrad, Inspektion", category: null, name: "Sabine Test",
    createdAt: ago(6, 2), steps: [["IN_ARBEIT", ago(4), u2], ["ABHOLBEREIT", ago(2), u1]],
  });
  void df;

  const kp = make({
    code: "7KP4QX", item: "Auto, Ölwechsel", category: null, name: "Jonas Probe", email: "jonas@beispiel.de",
    createdAt: ago(5, 2), steps: [["IN_ARBEIT", ago(4), u2], ["ABHOLBEREIT", ago(1), u1]],
  });
  subscribe(kp, "MAIL", "jonas@beispiel.de", ago(4, -1));

  make({
    code: "X2SP7N", item: "Auto, Reifenwechsel", category: null, name: "Eva Probe",
    createdAt: ago(5, 5), steps: [["STORNIERT", ago(4), u1]],
  });

  // Booking of the already picked up order: a real slot inside opening hours that is over.
  // Today's last finished slot if there is one, else the most recent past opening slot.
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const pastSlot = lastPastSlot(db.settings, now);
  const pastIsToday = !!pastSlot && pastSlot.start >= midnight;
  const pickedAt = pastSlot && pastIsToday ? pastSlot.end : Math.max(midnight, now - 30 * 60_000);
  const za = make({
    code: "Z5MA9H", item: "Fahrrad, Kette wechseln", category: null, name: "Otto Muster",
    createdAt: ago(3, 2), steps: [["IN_ARBEIT", ago(2, 12), u2], ["ABHOLBEREIT", ago(2), u1], ["ABGEHOLT", pickedAt, u2]],
  });
  if (pastSlot) za.booking = { start: iso(pastSlot.start), end: iso(pastSlot.end), bookedAt: iso(ago(1)), released: true };

  const kl = make({
    code: "C6VJ5T", item: "Auto, Klimaanlage prüfen", category: null, name: "Klaus Muster",
    createdAt: ago(4, 2), steps: [["IN_ARBEIT", ago(3), u2]],
  });

  const qx = make({
    code: "Q9XB2M", item: "Fahrrad, Bremsen einstellen", category: null, name: "Lena Beispiel", email: "lena@beispiel.de",
    createdAt: ago(2, 2), steps: [["IN_ARBEIT", ago(1), u1]], estimatedCompletion: now + DAY_MS,
  });
  subscribe(qx, "MAIL", "lena@beispiel.de", ago(2, 1));

  make({ code: "N4WZ8P", item: "Fahrrad, Licht reparieren", category: null, createdAt: ago(1, 2), steps: [] });

  const ht = make({
    code: "H7RT3K", item: "Auto, Winterreifen aufziehen", category: null, name: "Petra Beispiel", email: "petra@beispiel.de",
    createdAt: ago(0, 2), steps: [],
  });

  // Messages in chronological order so ids follow time.
  addMessage(db, rt, "ABHOLBEREIT", "SMS", "+49 151 00000034", Date.parse(rt.readyAt!));
  rt.readyMessageSent = true;
  addMessage(db, ge, "ABHOLBEREIT", "WHATSAPP", "+49 151 00000056", Date.parse(ge.readyAt!));
  ge.readyMessageSent = true;
  addMessage(db, rt, "ERINNERUNG", "SMS", "+49 151 00000034", Date.parse(rt.log[3].at));
  rt.reminderSent = true;
  addMessage(db, kp, "ABHOLBEREIT", "MAIL", "jonas@beispiel.de", Date.parse(kp.readyAt!));
  kp.readyMessageSent = true;
  addMessage(db, ht, "STATUSLINK", "MAIL", "petra@beispiel.de", Date.parse(ht.createdAt));

  // Cost estimates: one open by mail, one open by WhatsApp, one already approved by the customer.
  function estimate(
    o: OrderRec,
    e: { cents: number; text: string; channel: "MAIL" | "WHATSAPP"; sentAt: number; validDays: number; decided?: { state: "FREIGEGEBEN" | "ABGELEHNT"; at: number } },
  ) {
    const to = e.channel === "MAIL" ? o.customerEmail! : o.customerPhone!;
    const validUntil = day(now + e.validDays * DAY_MS);
    o.estimates.push({
      version: 1, amountCents: e.cents, description: e.text, validUntil, state: e.decided?.state ?? "OFFEN", channel: e.channel,
      sentAt: iso(e.sentAt), decidedAt: e.decided ? iso(e.decided.at) : null, decidedVia: e.decided ? "KUNDENSEITE" : null, reminderSent: false,
    });
    addMessage(db, o, "KOSTENVORANSCHLAG", e.channel, to, e.sentAt, germanDate(validUntil));
    if (e.decided) addMessage(db, o, "KV_ENTSCHEIDUNG", e.channel, to, e.decided.at, e.decided.state === "FREIGEGEBEN" ? "freigegeben" : "abgelehnt");
  }
  // Q9XB2M was postponed by one day (part arrives later), customer informed by mail.
  qx.completionLog.push({ at: iso(ago(0, 6)), from: day(now), to: qx.estimatedCompletion, note: "Das Ersatzteil kommt einen Tag später.", notified: true, actorName: u1.name });
  addMessage(db, qx, "NEUES_DATUM", "MAIL", "lena@beispiel.de", ago(0, 6), `${germanDate(qx.estimatedCompletion!)}\nDas Ersatzteil kommt einen Tag später.`);
  estimate(qx, { cents: 18990, text: "Bremsbeläge vorne und hinten ersetzen, Bremsflüssigkeit wechseln.", channel: "MAIL", sentAt: ago(0, 5), validDays: 6 });
  estimate(ht, { cents: 34900, text: "Neuer Reifensatz (4 Stück) inklusive Montage und Wuchten.", channel: "WHATSAPP", sentAt: ago(0, 1), validDays: 7 });
  estimate(kl, {
    cents: 12900, text: "Klimaservice mit Kältemittel auffüllen und neuem Innenraumfilter.", channel: "WHATSAPP", sentAt: ago(2, 2), validDays: 3,
    decided: { state: "FREIGEGEBEN", at: ago(1, 20) },
  });

  // 7KP4QX has a booked slot: next free slot of today, or the next opening day.
  const slot = firstFreeSlot(db.settings, now, db.orders);
  if (slot) kp.booking = { start: iso(slot.start), end: iso(slot.end), bookedAt: iso(now), released: false };

  // Drop-off appointments: one today that already became an order (H7RT3K), three booked for the coming days.
  function appointment(start: number, end: number, f: Omit<AppointmentRec, "id" | "token" | "start" | "end" | "createdAt" | "reminderSent" | "orderId" | "state">, createdAt: number, state: AppointmentRec["state"] = "GEBUCHT", orderId: string | null = null) {
    const a: AppointmentRec = {
      id: `a${++db.counters.appointment}`, token: `DEMO${String(db.counters.appointment).padStart(6, "0")}`, start: iso(start), end: iso(end),
      createdAt: iso(createdAt), reminderSent: false, orderId, state, ...f,
    };
    db.appointments.push(a);
    if (state === "GEBUCHT" || orderId) addAppointmentMessage(db, a, "TERMIN_BESTAETIGUNG", createdAt);
    return a;
  }
  // The window in which H7RT3K was handed over (only when that was during today's opening hours).
  const handover = lastPastSlot(db.settings, Date.parse(ht.createdAt) + db.settings.slotLengthMinutes * 60_000);
  if (handover && day(handover.start) === day(Date.parse(ht.createdAt))) {
    appointment(handover.start, handover.end, { service: "Reifenwechsel (Sommer) mit Einlagerung", item: "Auto, Winterreifen aufziehen", customerName: ht.customerName!, customerPhone: ht.customerPhone!, customerEmail: ht.customerEmail, channel: "MAIL" }, ago(3), "ERSCHIENEN", ht.id);
  }
  const todayLeft = generateSlotDays(db.settings, now, 1).flatMap((d) => d.slots).filter((s) => new Date(s.start).getDate() === new Date(now).getDate());
  const upcoming = dropOffDays(db.settings, now);
  const later = [todayLeft[2] ?? todayLeft[0], upcoming[0]?.slots[2], upcoming[1]?.slots[4]].filter(Boolean) as { start: number; end: number }[];
  const people = [
    { service: "Wartung Paket 1", item: "Fahrrad, Trekkingrad", customerName: "Felix Probe", customerPhone: "+49 151 00000041", customerEmail: null, channel: "WHATSAPP" as const },
    { service: "Reifenwechsel (Sommer) mit Einlagerung", item: "Auto, VW Golf", customerName: "Anna Muster", customerPhone: "+49 151 00000042", customerEmail: "anna@beispiel.de", channel: "MAIL" as const },
    { service: "Bremsen prüfen", item: "Auto, Opel Corsa", customerName: "Ben Beispiel", customerPhone: "+49 151 00000043", customerEmail: null, channel: "SMS" as const },
  ];
  later.forEach((s, i) => appointment(s.start, s.end, people[i], ago(2 - i * 0.5)));

  return db;
}
