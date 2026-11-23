import type {
  ApiError,
  BookSlotRequest,
  CentralOrderView,
  Channel,
  ErrorCode,
  LookupRequest,
  LookupResponse,
  PublicBusiness,
  PublicOrderView,
  PublicSlotsResponse,
  SubscribeRequest,
  UnsubscribeRequest,
} from "@abholdemo/shared";

export class ApiFailure extends Error {
  code: ErrorCode | "NETWORK";
  status: number;
  constructor(status: number, code: ErrorCode | "NETWORK", message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const API_BASE: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? ""; // empty locally (Vite proxy), Render URL when hosted

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      credentials: "omit",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure(0, "NETWORK", "Keine Verbindung. Bitte versuchen Sie es gleich noch einmal.");
  }
  if (!res.ok) {
    let err: ApiError | null = null;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      /* ignore */
    }
    throw new ApiFailure(
      res.status,
      err?.error.code ?? "INTERNAL",
      err?.error.message ?? "Etwas ist schiefgelaufen. Bitte versuchen Sie es noch einmal.",
    );
  }
  return (await res.json()) as T;
}

const biz = (web: string) => `/api/public/b/${encodeURIComponent(web)}`;
const ord = (web: string, code: string) => `${biz(web)}/orders/${encodeURIComponent(code)}`;

export const getBusiness = (web: string) => call<PublicBusiness>("GET", biz(web));
export const getOrder = (web: string, code: string) => call<PublicOrderView>("GET", ord(web, code));
export const getSlots = (web: string, code: string) =>
  call<PublicSlotsResponse>("GET", `${ord(web, code)}/slots`);
export const subscribe = (web: string, code: string, channel: Channel, contact: string, consent: boolean) =>
  call<PublicOrderView>("POST", `${ord(web, code)}/subscribe`, { channel, contact, consent } satisfies SubscribeRequest);
export const unsubscribe = (web: string, code: string) =>
  call<PublicOrderView>("POST", `${ord(web, code)}/unsubscribe`, { source: "LINK" } satisfies UnsubscribeRequest);
export const bookSlot = (web: string, code: string, start: string) =>
  call<PublicOrderView>("PUT", `${ord(web, code)}/slot`, { start } satisfies BookSlotRequest);
export const cancelSlot = (web: string, code: string) =>
  call<PublicOrderView>("DELETE", `${ord(web, code)}/slot`);

/** Central page: the code alone finds the business. */
export const getCentral = (code: string) => call<CentralOrderView>("GET", `/api/public/orders/${encodeURIComponent(code)}`);
/** Central entry by hand: code plus the last digits of the phone number (sent in the body, never in the URL). */
export const lookupOrder = (code: string, phoneEnd: string) =>
  call<LookupResponse>("POST", "/api/public/lookup", { code, phoneEnd } satisfies LookupRequest);
