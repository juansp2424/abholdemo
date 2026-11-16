import type { Channel } from "@abholdemo/shared";

const dateTime = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeOnly = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const shortDay = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
const longDay = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateOnly = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatTime = (iso: string) => timeOnly.format(new Date(iso));
export const formatEuro = (n: number) => euro.format(n);

/** "Mo 16.11., 10:00 bis 10:15" */
export function formatSlot(start: string, end: string): string {
  return `${shortDay.format(new Date(start))}, ${formatTime(start)} bis ${formatTime(end)}`;
}

/** "YYYY-MM-DD" to a Date at local noon (safe against DST edges). */
function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function toDayString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(day: string, delta: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + delta);
  return toDayString(d);
}

export const formatDay = (day: string) => longDay.format(parseDay(day));
export const formatDayShort = (day: string) => dateOnly.format(parseDay(day));

export function isChannel(v: string): v is Channel {
  return v === "MAIL" || v === "SMS" || v === "WHATSAPP";
}
