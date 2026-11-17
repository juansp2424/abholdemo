import { WEEKDAYS, type BusinessSettings } from "@abholdemo/shared";
import { toDateString } from "./clock.js";
import type { OrderRec } from "./types.js";

export interface RawSlot {
  start: number;
  end: number;
}
export interface RawSlotDay {
  date: string;
  slots: RawSlot[];
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Slots of the next `days` calendar days (including today) from opening hours and slot length.
 * Only slots that start after `nowMs`. Closed days (and days without remaining slots) are omitted.
 * Capacity is not applied here.
 */
/** All slots of one calendar day (no time filter, no capacity). */
function slotsOfDay(settings: Pick<BusinessSettings, "openingHours" | "slotLengthMinutes">, y: number, m: number, d: number): RawSlot[] {
  const weekday = WEEKDAYS[(new Date(y, m, d).getDay() + 6) % 7];
  const len = settings.slotLengthMinutes;
  const slots: RawSlot[] = [];
  for (const iv of settings.openingHours[weekday]) {
    const close = minutes(iv.close);
    for (let t = minutes(iv.open); t + len <= close; t += len) {
      slots.push({ start: new Date(y, m, d, 0, t).getTime(), end: new Date(y, m, d, 0, t + len).getTime() });
    }
  }
  return slots;
}

/** True when [startIso, endIso] is exactly one slot generated from the opening hours and slot length. */
export function fitsOpeningHours(settings: Pick<BusinessSettings, "openingHours" | "slotLengthMinutes">, startIso: string, endIso: string): boolean {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  const d = new Date(start);
  return slotsOfDay(settings, d.getFullYear(), d.getMonth(), d.getDate()).some((s) => s.start === start && s.end === end);
}

/** Most recent slot that is already over (end <= now): today first, then back up to 14 days. */
export function lastPastSlot(settings: Pick<BusinessSettings, "openingHours" | "slotLengthMinutes">, nowMs: number): RawSlot | null {
  const t = new Date(nowMs);
  for (let i = 0; i <= 14; i++) {
    const past = slotsOfDay(settings, t.getFullYear(), t.getMonth(), t.getDate() - i).filter((s) => s.end <= nowMs);
    if (past.length) return past[past.length - 1];
  }
  return null;
}

export function generateSlotDays(
  settings: Pick<BusinessSettings, "openingHours" | "slotLengthMinutes">,
  nowMs: number,
  days = 7,
): RawSlotDay[] {
  const today = new Date(nowMs);
  const result: RawSlotDay[] = [];
  for (let i = 0; i < days; i++) {
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate() + i;
    const slots = slotsOfDay(settings, y, m, d).filter((s) => s.start > nowMs);
    if (slots.length) result.push({ date: toDateString(new Date(y, m, d).getTime()), slots });
  }
  return result;
}

/** Active (not released) bookings starting at `startMs`, optionally ignoring one order. */
export function activeBookings(orders: OrderRec[], startMs: number, excludeOrderId?: string): number {
  return orders.filter(
    (o) => o.id !== excludeOrderId && o.booking && !o.booking.released && Date.parse(o.booking.start) === startMs,
  ).length;
}

/** First slot with free capacity (used by the seed). */
export function firstFreeSlot(settings: BusinessSettings, nowMs: number, orders: OrderRec[]): RawSlot | null {
  for (const day of generateSlotDays(settings, nowMs, 14)) {
    for (const s of day.slots) {
      if (settings.slotCapacity - activeBookings(orders, s.start) > 0) return s;
    }
  }
  return null;
}
