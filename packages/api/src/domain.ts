import {
  CONSENT_TEXT,
  MANUAL_TRANSITIONS,
  SLOT_STATUSES,
  STATUS_CUSTOMER_TEXT,
  STATUS_LABELS,
  SUBSCRIBE_STATUSES,
  orderUrl,
  type Channel,
  type AppointmentView,
  type EstimateState,
  type PublicAppointment,
  KUNDE_BASE_URL,
  contactChannel,
  type EstimateView,
  type MessageType,
  type MessageView,
  type OrderDetail,
  type OrderStatus,
  type OrderSummary,
  type PublicOrderView,
  type RevokeSource,
} from "@abholdemo/shared";
import { DAY_MS, iso, toDateString } from "./clock.js";
import { ESTIMATE_STATUSES } from "@abholdemo/shared";
import { appointmentText, buildMessageText, costFor, maskContact, whenText } from "./messages.js";
import type { PhotoStore } from "./store.js";
import type { AppointmentRec, Db, EstimateRec, MessageRec, OrderRec, UserRec } from "./types.js";

export interface Actor {
  id: string | null;
  name: string;
}
export const SYSTEM_ACTOR: Actor = { id: null, name: "System" };
export const actorOf = (u: UserRec): Actor => ({ id: u.id, name: u.displayName });

export function logStatus(order: OrderRec, atMs: number, from: OrderStatus | null, to: OrderStatus, actor: Actor) {
  order.log.push({ at: iso(atMs), from, to, actorId: actor.id, actorName: actor.name });
}

export function activeSlot(o: OrderRec) {
  return o.booking && !o.booking.released ? { start: o.booking.start, end: o.booking.end } : null;
}

/** Creates a simulated message. Nothing is ever sent. */
export function addMessage(
  db: Db,
  order: OrderRec,
  type: MessageType,
  channel: Channel,
  recipient: string,
  atMs: number,
  freeText?: string,
): MessageRec {
  const msg: MessageRec = {
    id: `m${++db.counters.message}`,
    orderId: order.id,
    type,
    channel,
    recipient,
    text: buildMessageText(type, order.code, channel, db.settings, freeText),
    link: orderUrl(order.code),
    deliveryStatus: "ZUGESTELLT_SIMULIERT",
    costEur: costFor(channel),
    createdAt: iso(atMs),
    stopSimulated: false,
  };
  db.messages.push(msg);
  return msg;
}

/** Marks overdue orders and creates at most one reminder per order (R28). */
export function sweepOverdue(db: Db, nowMs: number): { newlyOverdue: string[]; remindersCreated: number } {
  const newlyOverdue: string[] = [];
  let remindersCreated = 0;
  const limit = db.settings.pickupDeadlineDays * DAY_MS;
  for (const o of db.orders) {
    if (o.status !== "ABHOLBEREIT" || !o.readyAt) continue;
    if (Date.parse(o.readyAt) + limit >= nowMs) continue;
    o.status = "UEBERFAELLIG";
    logStatus(o, nowMs, "ABHOLBEREIT", "UEBERFAELLIG", SYSTEM_ACTOR);
    newlyOverdue.push(o.code);
    if (o.subscription?.active && !o.reminderSent) {
      addMessage(db, o, "ERINNERUNG", o.subscription.channel, o.subscription.contact, nowMs);
      o.reminderSent = true;
      remindersCreated++;
    }
  }
  return { newlyOverdue, remindersCreated };
}

// ---------------------------------------------------------------------------
// Cost estimates
// ---------------------------------------------------------------------------

export const openEstimate = (o: OrderRec): EstimateRec | undefined => o.estimates.find((e) => e.state === "OFFEN");

/** "2026-11-30" to "30.11.2026" for message texts. */
export const germanDate = (day: string) => day.split("-").reverse().join(".");

export function closeEstimate(e: EstimateRec, state: EstimateState, nowMs: number) {
  e.state = state;
  e.decidedAt = iso(nowMs);
}

/** Expires open estimates after their last day and sends at most one reminder, from one day before the end. Returns true if anything changed. */
export function sweepEstimates(db: Db, nowMs: number): boolean {
  let changed = false;
  const today = toDateString(nowMs);
  const dayBefore = (day: string) => toDateString(Date.parse(`${day}T12:00:00`) - DAY_MS);
  for (const o of db.orders) {
    const e = openEstimate(o);
    if (!e) continue;
    if (today > e.validUntil) {
      closeEstimate(e, "ABGELAUFEN", nowMs);
      changed = true;
    } else if (!e.reminderSent && today >= dayBefore(e.validUntil)) {
      const to = e.channel === "MAIL" ? o.customerEmail : o.customerPhone;
      if (to) addMessage(db, o, "KV_ERINNERUNG", e.channel, to, nowMs, germanDate(e.validUntil));
      e.reminderSent = true;
      changed = true;
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Drop-off appointments
// ---------------------------------------------------------------------------

export const appointmentUrl = (token: string) => `${KUNDE_BASE_URL}/termin/${token}`;

/** Simulated message about an appointment (no order yet). */
export function addAppointmentMessage(db: Db, a: AppointmentRec, type: MessageType, atMs: number): MessageRec {
  const link = type === "TERMIN_ABSAGE" ? `${KUNDE_BASE_URL}/b/${db.settings.webname}/termin` : appointmentUrl(a.token);
  const recipient = a.channel === "MAIL" ? a.customerEmail ?? a.customerPhone : a.customerPhone;
  const msg: MessageRec = {
    id: `m${++db.counters.message}`,
    orderId: "",
    appointmentId: a.id,
    type,
    channel: a.channel,
    recipient,
    text: appointmentText(type, db.settings.name, whenText(a.start), link),
    link,
    deliveryStatus: "ZUGESTELLT_SIMULIERT",
    costEur: costFor(a.channel),
    createdAt: iso(atMs),
    stopSimulated: false,
  };
  db.messages.push(msg);
  return msg;
}

/**
 * One reminder on the day before a booked pickup, to the subscription contact if active, else the intake contact.
 * Not when the pickup was booked on that same day (the customer just chose it).
 */
export function sweepPickupReminders(db: Db, nowMs: number): boolean {
  let changed = false;
  const today = toDateString(nowMs);
  for (const o of db.orders) {
    const b = o.booking;
    if (!b || b.released || b.reminderSent || !SLOT_STATUSES.includes(o.status)) continue;
    const start = Date.parse(b.start);
    if (start <= nowMs || toDateString(start - DAY_MS) !== today || toDateString(Date.parse(b.bookedAt)) >= today) continue;
    const sub = o.subscription?.active ? o.subscription : null;
    const channel = sub ? sub.channel : contactChannel(o.customerEmail, o.customerPhone);
    const to = sub ? sub.contact : channel === "MAIL" ? o.customerEmail : o.customerPhone;
    if (channel && to) addMessage(db, o, "ABHOLZEIT_ERINNERUNG", channel, to, nowMs, whenText(b.start));
    b.reminderSent = true;
    changed = true;
  }
  return changed;
}

/** One reminder on the day before; after the appointment's day an appointment that is still booked counts as no-show. */
export function sweepAppointments(db: Db, nowMs: number): boolean {
  let changed = false;
  const today = toDateString(nowMs);
  for (const a of db.appointments) {
    if (a.state !== "GEBUCHT") continue;
    const day = toDateString(Date.parse(a.start));
    if (day < today) {
      a.state = "NICHT_ERSCHIENEN";
      changed = true;
    } else if (!a.reminderSent && toDateString(Date.parse(a.start) - DAY_MS) === today && toDateString(Date.parse(a.createdAt)) < today) {
      addAppointmentMessage(db, a, "TERMIN_ERINNERUNG", nowMs);
      a.reminderSent = true;
      changed = true;
    }
  }
  return changed;
}

export function toAppointmentView(db: Db, a: AppointmentRec): AppointmentView {
  const order = a.orderId ? db.orders.find((o) => o.id === a.orderId) : undefined;
  return {
    id: a.id, start: a.start, end: a.end, service: a.service, item: a.item, customerName: a.customerName,
    customerPhone: a.customerPhone, customerEmail: a.customerEmail, channel: a.channel, state: a.state,
    createdAt: a.createdAt, orderId: a.orderId, orderCode: order?.code ?? null,
  };
}

export function toPublicAppointment(db: Db, a: AppointmentRec, nowMs: number): PublicAppointment {
  const order = a.orderId ? db.orders.find((o) => o.id === a.orderId) : undefined;
  return {
    token: a.token, businessName: db.settings.name, webname: db.settings.webname, start: a.start, end: a.end,
    service: a.service, item: a.item, state: a.state, changeable: a.state === "GEBUCHT" && Date.parse(a.start) > nowMs,
    orderCode: order?.code ?? null,
  };
}

/** Applies a validated manual transition with all side effects. */
export function applyStatus(db: Db, order: OrderRec, to: OrderStatus, actor: Actor, nowMs: number) {
  const from = order.status;
  order.status = to;
  logStatus(order, nowMs, from, to, actor);
  // Once the work is finished or the order ends, an open estimate has no meaning any more.
  if (!ESTIMATE_STATUSES.includes(to)) {
    const e = openEstimate(order);
    if (e) closeEstimate(e, "ZURUECKGEZOGEN", nowMs);
  }
  if (to === "ABHOLBEREIT") {
    order.readyAt = iso(nowMs);
    if (order.subscription?.active && !order.readyMessageSent) {
      addMessage(db, order, "ABHOLBEREIT", order.subscription.channel, order.subscription.contact, nowMs);
      order.readyMessageSent = true;
    }
  }
  if (to === "ABGEHOLT") order.pickedUpAt = iso(nowMs);
  if ((to === "ABGEHOLT" || to === "STORNIERT") && order.booking) order.booking.released = true;
}

export function revokeSubscription(order: OrderRec, source: RevokeSource, nowMs: number) {
  const sub = order.subscription;
  if (!sub || !sub.active) return;
  sub.active = false;
  sub.revokedAt = iso(nowMs);
  sub.revokeSource = source;
  order.consentLog.push({
    at: iso(nowMs),
    type: "WIDERRUF",
    channel: sub.channel,
    text: source === "STOP" ? "Abbestellt per STOP Antwort." : "Abbestellt über den Link.",
    source,
  });
}

export function addSubscription(order: OrderRec, channel: Channel, contact: string, nowMs: number) {
  order.subscription = {
    channel,
    contact,
    consentAt: iso(nowMs),
    consentText: CONSENT_TEXT,
    active: true,
    revokedAt: null,
    revokeSource: null,
  };
  order.consentLog.push({ at: iso(nowMs), type: "ZUSTIMMUNG", channel, text: CONSENT_TEXT, source: "KUNDENSEITE" });
}

// ---------------------------------------------------------------------------
// Views. Public views pick fields explicitly (whitelist).
// ---------------------------------------------------------------------------

const deadlineDate = (db: Db, o: OrderRec) =>
  o.readyAt ? toDateString(Date.parse(o.readyAt) + db.settings.pickupDeadlineDays * DAY_MS) : null;

export function toSummary(db: Db, o: OrderRec, nowMs: number): OrderSummary {
  return {
    id: o.id,
    code: o.code,
    item: o.item,
    customerName: o.customerName,
    status: o.status,
    ageDays: Math.max(0, Math.floor((nowMs - Date.parse(o.createdAt)) / DAY_MS)),
    createdAt: o.createdAt,
    slot: activeSlot(o),
    hasPhoto: !!o.photoMime,
    notify: !!o.subscription?.active,
    estimateState: o.estimates.at(-1)?.state ?? null,
  };
}

export function toDetail(db: Db, photos: PhotoStore, o: OrderRec, nowMs: number): OrderDetail {
  return {
    ...toSummary(db, o, nowMs),
    category: o.category,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    plannedPickupDate: o.plannedPickupDate,
    estimatedCompletion: o.estimatedCompletion,
    readyAt: o.readyAt,
    pickedUpAt: o.pickedUpAt,
    pickupDeadline: deadlineDate(db, o),
    photoDataUrl: photos.readDataUrl(o),
    log: o.log,
    subscription: o.subscription,
    consentLog: o.consentLog,
    messageCount: db.messages.filter((m) => m.orderId === o.id).length,
    allowedTransitions: MANUAL_TRANSITIONS[o.status],
    statusUrl: orderUrl(o.code),
    estimates: o.estimates.map(toEstimateView),
    canEstimate: ESTIMATE_STATUSES.includes(o.status),
    completionLog: o.completionLog,
    canChangeCompletion: ESTIMATE_STATUSES.includes(o.status),
  };
}

export function toEstimateView(e: EstimateRec): EstimateView {
  const { reminderSent: _r, ...view } = e;
  return view;
}

export function toPublicView(db: Db, o: OrderRec): PublicOrderView {
  const ready = SLOT_STATUSES.includes(o.status);
  const sub = o.subscription?.active ? o.subscription : null;
  return {
    code: o.code,
    status: o.status,
    statusLabel: STATUS_LABELS[o.status],
    statusText: STATUS_CUSTOMER_TEXT[o.status],
    estimatedCompletion: o.estimatedCompletion,
    plannedPickupDate: o.plannedPickupDate,
    slot: activeSlot(o),
    pickupDeadlineDays: db.settings.pickupDeadlineDays,
    pickupDeadline: ready ? deadlineDate(db, o) : null,
    canSubscribe: SUBSCRIBE_STATUSES.includes(o.status) && !sub,
    notifyActive: !!sub,
    notifyChannel: sub ? sub.channel : null,
    slotBookingOpen: ready,
    estimateState: o.estimates.at(-1)?.state ?? null,
    ...completionInfo(o),
  };
}

/** Postponed: the latest change moved an existing date to a later one. The note belongs to the current date only. */
function completionInfo(o: OrderRec): { completionPostponed: boolean; completionNote: string | null } {
  const last = o.completionLog.at(-1);
  if (!last || last.to !== o.estimatedCompletion || !last.to) return { completionPostponed: false, completionNote: null };
  return { completionPostponed: !!last.from && last.to > last.from, completionNote: last.note };
}

export function toMessageView(db: Db, m: MessageRec): MessageView {
  const order = db.orders.find((o) => o.id === m.orderId);
  return {
    id: m.id,
    orderId: m.orderId,
    orderCode: order?.code ?? "", // "" for appointment messages
    type: m.type,
    channel: m.channel,
    recipientMasked: maskContact(m.channel, m.recipient),
    text: m.text,
    link: m.link,
    deliveryStatus: m.deliveryStatus,
    costEur: m.costEur,
    createdAt: m.createdAt,
    stopSimulated: m.stopSimulated,
  };
}
