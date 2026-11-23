import type { ApiError } from "@abholdemo/shared";

const TOKEN_KEY = "abholdemo.betrieb.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage problems */
  }
}

export class RequestError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let unauthorizedHandler: () => void = () => {};
export function onUnauthorized(fn: () => void): void {
  unauthorizedHandler = fn;
}

const API_BASE: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? ""; // empty locally (Vite proxy), Render URL when hosted

export async function api<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new RequestError("Der Server ist gerade nicht erreichbar. Bitte versuchen Sie es gleich noch einmal.", 0, "NETWORK");
  }

  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && auth) unauthorizedHandler();
    const err = (data as ApiError | null)?.error;
    throw new RequestError(err?.message ?? "Etwas ist schiefgelaufen. Bitte versuchen Sie es noch einmal.", res.status, err?.code ?? "INTERNAL");
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Etwas ist schiefgelaufen. Bitte versuchen Sie es noch einmal.";
}
