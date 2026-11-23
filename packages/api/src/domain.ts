import {
  CONSENT_TEXT,
  MANUAL_TRANSITIONS,
  SLOT_STATUSES,
  STATUS_CUSTOMER_TEXT,
  STATUS_LABELS,
  SUBSCRIBE_STATUSES,
  orderUrl,
  type Channel,
  type EstimateState,
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
import { buildMessageText, costFor, maskContact } from "./messages.js";
import type { PhotoStore } from "./store.js";
import type { Db, EstimateRec, MessageRec, OrderRec, UserRec } from "./types.js";

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
  };
}

export function toMessageView(db: Db, m: MessageRec): MessageView {
  const order = db.orders.find((o) => o.id === m.orderId);
  return {
    id: m.id,
    orderId: m.orderId,
    orderCode: order?.code ?? "",
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
