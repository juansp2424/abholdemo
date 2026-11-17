/**
 * Shared contract between packages/api, apps/betrieb and apps/kunde.
 * Owned by the orchestrator. Agents must not change this file; report contract
 * problems back instead. See docs/CONTRACT.md for endpoints and examples.
 *
 * All timestamps on the wire are ISO 8601 strings in UTC (e.g. "2026-11-16T09:15:00.000Z").
 * All calendar dates are "YYYY-MM-DD" strings in the server's local time zone.
 */

// ---------------------------------------------------------------------------
// Ports and URLs (local demo only)
// ---------------------------------------------------------------------------

export const PORTS = { api: 4000, betrieb: 5173, kunde: 5174 } as const;

/** Base URL of the customer website. Used for status links, QR code and messages. */
export const KUNDE_BASE_URL = `http://localhost:${PORTS.kunde}`;

/** Customer status page URL for an order. */
export function statusUrl(webname: string, code: string): string {
  return `${KUNDE_BASE_URL}/b/${webname}/a/${code}`;
}

/** Customer start page URL of a business (QR code target). */
export function businessUrl(webname: string): string {
  return `${KUNDE_BASE_URL}/b/${webname}`;
}

// ---------------------------------------------------------------------------
// Order code
// ---------------------------------------------------------------------------

/** Allowed characters: digits 2 to 9 and A to Z without O, I, L (no 0, 1). 31 chars. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;
export const CODE_REGEX = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/** Normalize customer input: remove all whitespace, uppercase. Validation happens on the server. */
export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

// ---------------------------------------------------------------------------
// Status model
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "ANGENOMMEN"
  | "IN_ARBEIT"
  | "ABHOLBEREIT"
  | "ABGEHOLT"
  | "UEBERFAELLIG"
  | "STORNIERT";

export const ORDER_STATUSES: OrderStatus[] = [
  "ANGENOMMEN",
  "IN_ARBEIT",
  "ABHOLBEREIT",
  "UEBERFAELLIG",
  "ABGEHOLT",
  "STORNIERT",
];

/** Short labels, identical in both apps. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  ANGENOMMEN: "Angenommen",
  IN_ARBEIT: "In Arbeit",
  ABHOLBEREIT: "Abholbereit",
  ABGEHOLT: "Abgeholt",
  UEBERFAELLIG: "Überfällig",
  STORNIERT: "Storniert",
};

/** Plain language explanation for the customer status page. */
export const STATUS_CUSTOMER_TEXT: Record<OrderStatus, string> = {
  ANGENOMMEN: "Wir haben Ihren Auftrag angenommen. Wir fangen bald damit an.",
  IN_ARBEIT: "Wir arbeiten gerade an Ihrem Auftrag.",
  ABHOLBEREIT: "Ihr Auftrag ist fertig. Sie können ihn abholen.",
  UEBERFAELLIG: "Ihr Auftrag ist fertig und wartet schon länger auf Sie. Bitte holen Sie ihn bald ab.",
  ABGEHOLT: "Ihr Auftrag wurde abgeholt. Vielen Dank!",
  STORNIERT: "Dieser Auftrag wurde storniert. Bei Fragen sprechen Sie bitte mit dem Betrieb.",
};

/**
 * Allowed manual transitions (by staff). UEBERFAELLIG is set only by the system
 * (overdue sweep), never manually. ABGEHOLT and STORNIERT are final.
 */
export const MANUAL_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ANGENOMMEN: ["IN_ARBEIT", "ABHOLBEREIT", "STORNIERT"],
  IN_ARBEIT: ["ABHOLBEREIT", "STORNIERT"],
  ABHOLBEREIT: ["ABGEHOLT", "STORNIERT"],
  UEBERFAELLIG: ["ABGEHOLT", "STORNIERT"],
  ABGEHOLT: [],
  STORNIERT: [],
};

/** Statuses in which the customer can see and book pickup slots. */
export const SLOT_STATUSES: OrderStatus[] = ["ABHOLBEREIT", "UEBERFAELLIG"];

/** Statuses in which the customer can subscribe ("Sag mir Bescheid"). */
export const SUBSCRIBE_STATUSES: OrderStatus[] = ["ANGENOMMEN", "IN_ARBEIT"];

// ---------------------------------------------------------------------------
// Messages (simulated)
// ---------------------------------------------------------------------------

export type Channel = "MAIL" | "SMS" | "WHATSAPP";

export const CHANNEL_LABELS: Record<Channel, string> = {
  MAIL: "Mail",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

/** Cost per simulated message in Euro. */
export const CHANNEL_COST_EUR: Record<Channel, number> = {
  MAIL: 0,
  SMS: 0.075,
  WHATSAPP: 0.0456,
};

/**
 * STATUSLINK: mail at intake when staff captured an email (R27, free).
 * ABHOLBEREIT: the one ready message to subscribed customers (R25).
 * ERINNERUNG: one reminder after the pickup deadline, subscribed customers only (R28).
 */
export type MessageType = "STATUSLINK" | "ABHOLBEREIT" | "ERINNERUNG";

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  STATUSLINK: "Statuslink",
  ABHOLBEREIT: "Abholbereit",
  ERINNERUNG: "Erinnerung",
};

export type DeliveryStatus = "ZUGESTELLT_SIMULIERT";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  ZUGESTELLT_SIMULIERT: "Zugestellt (simuliert)",
};

/**
 * Exact consent wording shown next to the unchecked checkbox and stored with each
 * subscription. The server stores this server side constant, not client text.
 */
export const CONSENT_TEXT =
  "Ja, ich möchte eine Nachricht bekommen, wenn mein Auftrag abholbereit ist. " +
  "Hole ich ihn nicht rechtzeitig ab, bekomme ich höchstens eine Erinnerung. " +
  "Ich kann das jederzeit abbestellen.";

/** Placeholders usable in the message template: {betrieb}, {nummer}, {link}. */
export const DEFAULT_MESSAGE_TEMPLATE =
  "Guten Tag, Ihr Auftrag {nummer} bei {betrieb} ist abholbereit. " +
  "Hier sehen Sie den Stand und können eine Abholzeit wählen: {link}";

// ---------------------------------------------------------------------------
// Business, settings, staff
// ---------------------------------------------------------------------------

export type Weekday = "mo" | "di" | "mi" | "do" | "fr" | "sa" | "so";
export const WEEKDAYS: Weekday[] = ["mo", "di", "mi", "do", "fr", "sa", "so"];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mo: "Montag",
  di: "Dienstag",
  mi: "Mittwoch",
  do: "Donnerstag",
  fr: "Freitag",
  sa: "Samstag",
  so: "Sonntag",
};

/** "HH:MM" 24h. open < close. Up to two intervals per day (e.g. lunch break). */
export interface TimeInterval {
  open: string;
  close: string;
}

/** Empty array means closed on that day. */
export type OpeningHours = Record<Weekday, TimeInterval[]>;

export const SLOT_LENGTH_OPTIONS = [15, 30, 45, 60] as const;
export type SlotLengthMinutes = (typeof SLOT_LENGTH_OPTIONS)[number];

export interface BusinessSettings {
  name: string;
  webname: string; // read only
  logoDataUrl: string | null; // data:image/...;base64,... max ~300 KB
  openingHours: OpeningHours;
  slotLengthMinutes: SlotLengthMinutes;
  slotCapacity: number; // 1..10 bookings per slot
  pickupDeadlineDays: number; // 1..60
  defaultChannel: Channel; // preselected channel in the customer form
  messageTemplate: string; // 10..500 chars
  quickCategories: string[]; // quick selection for new orders, owner defined, empty by default, max 20 entries of 1..40 chars
}

/** Response of PUT /api/betrieb/settings: the saved settings plus the number of upcoming pickup bookings that no longer fit the opening hours and were removed. */
export type SaveSettingsResponse = BusinessSettings & { releasedBookings: number };

/** Basic business info for every logged in staff member. */
export interface BusinessInfo {
  name: string;
  webname: string;
  logoDataUrl: string | null;
  customerUrl: string; // businessUrl(webname), QR target
  quickCategories: string[]; // same list as in settings, so every staff member sees the chips
}

export type Role = "INHABER" | "MITARBEITER";
export const ROLE_LABELS: Record<Role, string> = {
  INHABER: "Inhaber",
  MITARBEITER: "Mitarbeiter",
};

export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: StaffUser;
}

export interface CreateStaffRequest {
  username: string; // 3..30, [a-z0-9.]
  displayName: string;
  role: Role;
  password: string; // min 6
}

export interface UpdateStaffRequest {
  active?: boolean;
  role?: Role;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Orders (staff view)
// ---------------------------------------------------------------------------

/** Quick selection chips are configured per business (BusinessSettings.quickCategories). Nothing is predefined. */
export const QUICK_CATEGORY_MAX_COUNT = 20;
export const QUICK_CATEGORY_MAX_LENGTH = 40;

export interface StatusLogEntry {
  at: string; // ISO
  from: OrderStatus | null; // null for creation
  to: OrderStatus;
  actorId: string | null; // null = system
  actorName: string; // staff displayName or "System"
}

export type ConsentEventType = "ZUSTIMMUNG" | "WIDERRUF";
export type RevokeSource = "LINK" | "STOP";

export interface ConsentEvent {
  at: string; // ISO
  type: ConsentEventType;
  channel: Channel;
  text: string; // consent wording for ZUSTIMMUNG, description for WIDERRUF
  source: "KUNDENSEITE" | RevokeSource;
}

export interface Subscription {
  channel: Channel;
  contact: string; // full contact, staff only
  consentAt: string;
  consentText: string;
  active: boolean;
  revokedAt: string | null;
  revokeSource: RevokeSource | null;
}

export interface SlotBooking {
  start: string; // ISO
  end: string; // ISO
  bookedAt: string;
  released: boolean; // true after ABGEHOLT or STORNIERT or customer cancel
}

export interface OrderSummary {
  id: string;
  code: string;
  item: string;
  customerName: string | null;
  status: OrderStatus;
  ageDays: number; // whole days since createdAt (demo clock)
  createdAt: string;
  slot: { start: string; end: string } | null; // active booking only
  hasPhoto: boolean;
  notify: boolean; // active subscription
}

export interface OrderDetail extends OrderSummary {
  category: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  plannedPickupDate: string | null; // YYYY-MM-DD
  estimatedCompletion: string | null; // YYYY-MM-DD
  readyAt: string | null;
  pickedUpAt: string | null;
  pickupDeadline: string | null; // YYYY-MM-DD, readyAt + pickupDeadlineDays
  photoDataUrl: string | null; // staff only, never in public API
  log: StatusLogEntry[];
  subscription: Subscription | null;
  consentLog: ConsentEvent[];
  messageCount: number;
  allowedTransitions: OrderStatus[]; // MANUAL_TRANSITIONS[status]
  statusUrl: string;
}

export interface CreateOrderRequest {
  item: string; // required, 1..120 chars
  category?: string | null;
  photoDataUrl?: string | null; // data:image/jpeg;base64,... client resizes, max ~1.5 MB
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  plannedPickupDate?: string | null;
  estimatedCompletion?: string | null;
}

export interface ChangeStatusRequest {
  status: OrderStatus;
}

export type OrderFilter = "alle" | "offen" | "abholbereit" | "ueberfaellig" | "heute_abgeholt";

export const ORDER_FILTER_LABELS: Record<OrderFilter, string> = {
  alle: "Alle",
  offen: "Offen",
  abholbereit: "Abholbereit",
  ueberfaellig: "Überfällig",
  heute_abgeholt: "Heute abgeholt",
};

// ---------------------------------------------------------------------------
// Day list of booked slots (staff)
// ---------------------------------------------------------------------------

export type Attendance = "ERSCHIENEN" | "ERWARTET" | "NICHT_ERSCHIENEN";
export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  ERSCHIENEN: "Erschienen",
  ERWARTET: "Erwartet",
  NICHT_ERSCHIENEN: "Noch nicht erschienen",
};

export interface DaySlotEntry {
  orderId: string;
  code: string;
  start: string;
  end: string;
  status: OrderStatus;
  attendance: Attendance;
}

/** Order whose expected completion (a date, no time) falls on the day. Cancelled orders are not listed. */
export interface DayCompletionEntry {
  orderId: string;
  code: string;
  status: OrderStatus;
}

export interface DaySlotList {
  date: string; // YYYY-MM-DD
  entries: DaySlotEntry[]; // booked pickups, sorted by start
  completions: DayCompletionEntry[]; // expected completions on this date, sorted by code
  openingHours: TimeInterval[]; // opening hours of this weekday, for the time axis of the calendar (empty = closed)
}

// ---------------------------------------------------------------------------
// Messages overview (staff)
// ---------------------------------------------------------------------------

export interface MessageView {
  id: string;
  orderId: string;
  orderCode: string;
  type: MessageType;
  channel: Channel;
  recipientMasked: string; // e.g. "p***@beispiel.de", "+49 *** ****12"
  text: string;
  link: string;
  deliveryStatus: DeliveryStatus;
  costEur: number;
  createdAt: string;
  stopSimulated: boolean; // true after demo "STOP" reply on this message
}

export interface MessagesOverview {
  month: string; // YYYY-MM
  messages: MessageView[]; // newest first, only this month
  monthTotalEur: number;
  monthCount: number;
  perOrder: { orderId: string; orderCode: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Demo tools
// ---------------------------------------------------------------------------

export interface DemoClock {
  now: string; // ISO, demo clock
  offsetDays: number;
}

export interface AdvanceTimeRequest {
  days: number; // 1..60
}

export interface AdvanceTimeResponse extends DemoClock {
  newlyOverdue: string[]; // order codes
  remindersCreated: number;
}

// ---------------------------------------------------------------------------
// Public API (customer website). Never contains personal data.
// ---------------------------------------------------------------------------

export interface PublicBusiness {
  name: string;
  webname: string;
  logoDataUrl: string | null;
  pickupDeadlineDays: number;
  defaultChannel: Channel;
}

export interface PublicOrderView {
  code: string;
  status: OrderStatus;
  statusLabel: string; // STATUS_LABELS[status]
  statusText: string; // STATUS_CUSTOMER_TEXT[status]
  estimatedCompletion: string | null; // YYYY-MM-DD
  plannedPickupDate: string | null; // YYYY-MM-DD
  slot: { start: string; end: string } | null; // active booking
  pickupDeadlineDays: number;
  pickupDeadline: string | null; // YYYY-MM-DD, only when ready or overdue
  canSubscribe: boolean; // status in SUBSCRIBE_STATUSES and no active subscription
  notifyActive: boolean;
  notifyChannel: Channel | null; // channel only, never the contact
  slotBookingOpen: boolean; // status in SLOT_STATUSES
}

export interface SubscribeRequest {
  channel: Channel;
  contact: string; // email for MAIL, phone for SMS and WHATSAPP
  consent: boolean; // must be true
}

export interface UnsubscribeRequest {
  source: RevokeSource;
}

export interface PublicSlot {
  start: string;
  end: string;
  free: number; // remaining capacity; > 0, except the order's own booked slot which may show 0
}

export interface PublicSlotDay {
  date: string; // YYYY-MM-DD
  slots: PublicSlot[]; // only free slots, starting after demo now
}

export interface PublicSlotsResponse {
  days: PublicSlotDay[]; // next 7 calendar days including today, closed days omitted
}

export interface BookSlotRequest {
  start: string; // ISO, must equal a generated slot start
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "NOT_ALLOWED"
  | "SLOT_FULL"
  | "SLOT_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL";

/** Every non 2xx response has this body. message is plain German, ready to show. */
export interface ApiError {
  error: { code: ErrorCode; message: string };
}

/** Neutral text for unknown, wrong or malformed order codes (identical in every case). */
export const NEUTRAL_NOT_FOUND_MESSAGE =
  "Zu dieser Nummer haben wir nichts gefunden. Bitte prüfen Sie die Nummer auf Ihrem Anhänger.";

export const RATE_LIMIT_MESSAGE =
  "Zu viele Versuche. Bitte warten Sie eine Minute und versuchen Sie es dann noch einmal.";

/** Fixed minimum response time for public order lookups in ms (R10). */
export const PUBLIC_LOOKUP_MIN_MS = 300;

/** Failed lookups per device per 60 s before the lock (R11). */
export const RATE_LIMIT_MAX_FAILS = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_LOCK_MS = 60_000;
