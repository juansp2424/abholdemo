const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "YYYY-MM-DD" to a local Date at noon (no time zone shifts). */
export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day, 12);
}

export const formatDate = (d: string) => dayFmt.format(parseDate(d));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

/** "Montag, 16. November, 10:00 bis 10:15 Uhr" */
export function formatRange(s: { start: string; end: string }): string {
  return `${dayFmt.format(new Date(s.start))}, ${formatTime(s.start)} bis ${formatTime(s.end)} Uhr`;
}

/** Heading for a slot day. No "Heute"/"Morgen": days[0] is not reliably today (closed days are omitted). */
export const dayHeading = (date: string) => formatDate(date);

const euroFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const formatEuro = (cents: number) => euroFmt.format(cents / 100);
