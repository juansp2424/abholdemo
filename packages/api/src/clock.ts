/** Base clock (real time in production, fake in tests). The demo offset is added on top by the app. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date "YYYY-MM-DD" (server time zone). */
export function toDateString(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local month "YYYY-MM". */
export function toMonthString(ms: number): string {
  return toDateString(ms).slice(0, 7);
}

export function isDateString(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export const iso = (ms: number) => new Date(ms).toISOString();
