import type { ErrorCode } from "@abholdemo/shared";
import { isDateString } from "./clock.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function fail(status: number, code: ErrorCode, message: string): never {
  throw new HttpError(status, code, message);
}

export function invalid(message: string): never {
  return fail(400, "VALIDATION", message);
}

export function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("Die Angaben fehlen oder sind nicht lesbar.");
  }
  return body as Record<string, unknown>;
}

/** Optional trimmed text. Empty becomes null. */
export function optText(value: unknown, label: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return invalid(`${label} ist nicht lesbar.`);
  const t = value.trim();
  if (!t) return null;
  if (t.length > max) return invalid(`${label} ist zu lang. Bitte höchstens ${max} Zeichen.`);
  return t;
}

export function isEmail(v: string): boolean {
  return v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isPhone(v: string): boolean {
  const digits = v.replace(/\D/g, "").length;
  return /^\+?[0-9 ]+$/.test(v) && digits >= 6 && digits <= 20;
}

export const EMAIL_ERROR = "Die Mailadresse sieht nicht richtig aus. Bitte prüfen Sie sie.";
export const PHONE_ERROR =
  "Die Telefonnummer sieht nicht richtig aus. Bitte nur Ziffern und Leerzeichen, am Anfang darf ein Plus stehen.";

export function optDate(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (!isDateString(value)) return invalid(`${label} ist kein gültiges Datum.`);
  return value;
}
