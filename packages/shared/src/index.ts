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
const env = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
export const KUNDE_BASE_URL: string = (viteEnv?.VITE_KUNDE_URL ?? env.process?.env.KUNDE_URL ?? `http://localhost:${PORTS.kunde}`).replace(/\/$/, "");

/** Central customer page for an order. One address for all businesses: the code alone identifies the business. Used in messages and QR codes. */
export function orderUrl(code: string): string {
  return `${KUNDE_BASE_URL}/a/${code}`;
}

/** Central start page of the customer site (one printed stand for every business). */
export function centralUrl(): string {
  return KUNDE_BASE_URL;
}

/** Business scoped status page URL for an order (kept for old links). */
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

export const CHANNELS_ALL: Channel[] = ["MAIL", "SMS", "WHATSAPP"];

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
 * MITTEILUNG: free text from staff to the customer's intake contact, e.g. when a repair is delayed because parts must be ordered.
 */
export type MessageType =
  | "STATUSLINK"
  | "ABHOLBEREIT"
  | "ERINNERUNG"
  | "MITTEILUNG"
  | "KOSTENVORANSCHLAG"
  | "KV_ERINNERUNG"
  | "KV_ENTSCHEIDUNG"
  | "NEUES_DATUM"
  | "TERMIN_BESTAETIGUNG"
  | "TERMIN_ERINNERUNG"
  | "TERMIN_GEAENDERT"
  | "TERMIN_ABSAGE"
  | "ABHOLZEIT_ERINNERUNG";

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  STATUSLINK: "Statuslink",
  ABHOLBEREIT: "Abholbereit",
  ERINNERUNG: "Erinnerung",
  MITTEILUNG: "Mitteilung",
  KOSTENVORANSCHLAG: "Kostenvoranschlag",
  KV_ERINNERUNG: "Erinnerung Kostenvoranschlag",
  KV_ENTSCHEIDUNG: "Bestätigung Entscheidung",
  NEUES_DATUM: "Neues Fertigstellungsdatum",
  TERMIN_BESTAETIGUNG: "Terminbestätigung",
  TERMIN_ERINNERUNG: "Terminerinnerung",
  TERMIN_GEAENDERT: "Termin geändert",
  TERMIN_ABSAGE: "Terminabsage",
  ABHOLZEIT_ERINNERUNG: "Erinnerung Abholzeit",
};

/** Channel for a staff message to the intake contact: mail if an email was captured, otherwise SMS to the phone number. */
export function contactChannel(email: string | null, phone: string | null): Channel | null {
  return email ? "MAIL" : phone ? "SMS" : null;
}

export const NOTIFY_MAX_LENGTH = 500;

export interface NotifyRequest {
  text: string; // 1..500 chars, plain text
}

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
  dropOffEnabled: boolean; // customers can book a drop-off appointment online
  dropOffCapacity: number; // 1..10 drop-offs per time window, separate from pickups
}

/** Response of PUT /api/betrieb/settings: the saved settings plus the number of upcoming pickup bookings that no longer fit the opening hours and were removed. */
export type SaveSettingsResponse = BusinessSettings & { releasedBookings: number };

/** Basic business info for every logged in staff member. */
export interface BusinessInfo {
  name: string;
  webname: string;
  logoDataUrl: string | null;
  customerUrl: string; // centralUrl(), QR target of the stand
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
  reminderSent?: boolean; // reminder on the day before was created (ABHOLZEIT_ERINNERUNG)
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
  estimateState: EstimateState | null; // state of the newest cost estimate, null if none
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
  estimates: EstimateView[]; // oldest first
  canEstimate: boolean; // status in ESTIMATE_STATUSES
  completionLog: CompletionChange[]; // changes of estimatedCompletion after intake, oldest first
  canChangeCompletion: boolean; // status in ESTIMATE_STATUSES (still in the workshop)
}

/** A change of the expected completion date. */
export interface CompletionChange {
  at: string;
  from: string | null; // YYYY-MM-DD
  to: string | null;
  note: string | null; // reason for the customer
  notified: boolean;
  actorName: string;
}

export const COMPLETION_NOTE_MAX = 200;

export interface SetCompletionRequest {
  date: string | null; // YYYY-MM-DD, not in the past; null removes the date
  note?: string | null; // reason for the customer, max COMPLETION_NOTE_MAX
  notify: boolean; // message to the intake contact (only when a new date is set and it changed)
}

export interface CreateOrderRequest {
  item: string; // required, 1..120 chars
  category?: string | null;
  photoDataUrl?: string | null; // data:image/jpeg;base64,... client resizes, max ~1.5 MB
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone: string; // required, so the business can always reach the customer
  plannedPickupDate?: string | null;
  estimatedCompletion?: string | null;
}

export interface ChangeStatusRequest {
  status: OrderStatus;
}

export type OrderFilter = "alle" | "offen" | "freigabe" | "abholbereit" | "ueberfaellig" | "heute_abgeholt";

export const ORDER_FILTER_LABELS: Record<OrderFilter, string> = {
  alle: "Alle",
  offen: "Offen",
  freigabe: "Wartet auf Freigabe",
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
  dropOffs: AppointmentView[]; // drop-off appointments of the day (not cancelled), sorted by start
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
  dropOffEnabled: boolean;
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
  estimateState: EstimateState | null; // newest cost estimate; amount and text only after the phone digits (see PublicEstimate)
  completionPostponed: boolean; // the current expected completion is later than the previous one
  completionNote: string | null; // reason given with the current date
}

export interface SubscribeRequest {
  channel: Channel;
  contact: string; // email for MAIL, phone for SMS and WHATSAPP
  consent: boolean; // must be true
}

/** Central entry: the code plus the last digits of the phone number given at intake (guards against guessing by hand). */
export const PHONE_END_LENGTH = 4;

export interface LookupRequest {
  code: string;
  phoneEnd: string; // last 4 digits of the phone number
}

export interface LookupResponse {
  code: string; // normalized, open /a/{code}
}

/** Response of GET /api/public/orders/{code}: the business branding and the order view in one call. */
export interface CentralOrderView {
  business: PublicBusiness;
  order: PublicOrderView;
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
// Cost estimates (Kostenvoranschlag)
// ---------------------------------------------------------------------------

export type EstimateState = "OFFEN" | "FREIGEGEBEN" | "ABGELEHNT" | "ZURUECKGEZOGEN" | "ABGELAUFEN";

export const ESTIMATE_STATE_LABELS: Record<EstimateState, string> = {
  OFFEN: "Wartet auf Freigabe",
  FREIGEGEBEN: "Freigegeben",
  ABGELEHNT: "Abgelehnt",
  ZURUECKGEZOGEN: "Zurückgezogen",
  ABGELAUFEN: "Abgelaufen",
};

/** Channels for a cost estimate: mail to the intake email, WhatsApp to the intake phone number. */
export type EstimateChannel = "MAIL" | "WHATSAPP";
export const ESTIMATE_CHANNELS: EstimateChannel[] = ["MAIL", "WHATSAPP"];

export type EstimateDecisionSource = "KUNDENSEITE" | "BETRIEB";

/** Statuses in which an estimate can be sent. */
export const ESTIMATE_STATUSES: OrderStatus[] = ["ANGENOMMEN", "IN_ARBEIT"];

export const ESTIMATE_DESCRIPTION_MAX = 300;
export const ESTIMATE_MAX_CENTS = 10_000_000; // 100 000 Euro
export const ESTIMATE_DEFAULT_VALID_DAYS = 7;

export interface EstimateView {
  version: number; // 1, 2, ... a new estimate replaces an open one
  amountCents: number;
  description: string;
  validUntil: string; // YYYY-MM-DD
  state: EstimateState;
  channel: EstimateChannel;
  sentAt: string;
  decidedAt: string | null; // decision, withdrawal or expiry
  decidedVia: EstimateDecisionSource | null; // only for FREIGEGEBEN and ABGELEHNT
}

export interface CreateEstimateRequest {
  amountCents: number; // integer, 1..ESTIMATE_MAX_CENTS
  description: string; // 1..ESTIMATE_DESCRIPTION_MAX chars
  validUntil?: string | null; // YYYY-MM-DD, default today + ESTIMATE_DEFAULT_VALID_DAYS
  channel: EstimateChannel;
}

export interface DecideEstimateRequest {
  decision: "FREIGEGEBEN" | "ABGELEHNT";
}

/** Customer view of the newest estimate. Only after the last phone digits; never in a message. */
export interface PublicEstimate {
  version: number;
  amountCents: number;
  description: string;
  validUntil: string;
  state: EstimateState;
  decidedAt: string | null;
}

export interface PublicEstimateRequest {
  phoneEnd: string;
}

export interface PublicEstimateDecisionRequest {
  phoneEnd: string;
  version: number;
  decision: "FREIGEGEBEN" | "ABGELEHNT";
}

// ---------------------------------------------------------------------------
// Drop-off appointments (Abgabetermin online buchen)
// ---------------------------------------------------------------------------

export type AppointmentState = "GEBUCHT" | "ABGESAGT_KUNDE" | "ABGESAGT_BETRIEB" | "ERSCHIENEN" | "NICHT_ERSCHIENEN";

export const APPOINTMENT_STATE_LABELS: Record<AppointmentState, string> = {
  GEBUCHT: "Gebucht",
  ABGESAGT_KUNDE: "Vom Kunden abgesagt",
  ABGESAGT_BETRIEB: "Vom Betrieb abgesagt",
  ERSCHIENEN: "Erschienen, Auftrag angelegt",
  NICHT_ERSCHIENEN: "Nicht erschienen",
};

/** Customers book from the next calendar day on, up to this many days ahead. */
export const DROPOFF_DAYS_AHEAD = 14;
/** At most this many booked (open) appointments per phone number. */
export const DROPOFF_MAX_OPEN_PER_PHONE = 3;
export const DROPOFF_SERVICE_MAX = 60;
export const DROPOFF_ITEM_MAX = 120;

export interface AppointmentView {
  id: string;
  start: string; // ISO
  end: string;
  service: string;
  item: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  channel: Channel;
  state: AppointmentState;
  createdAt: string;
  orderId: string | null; // after "Auftrag anlegen"
  orderCode: string | null;
}

/** Customer view of an appointment (by its secret link). No name or contact. */
export interface PublicAppointment {
  token: string;
  businessName: string;
  webname: string;
  start: string;
  end: string;
  service: string;
  item: string;
  state: AppointmentState;
  changeable: boolean; // booked and still in the future
  orderCode: string | null; // after drop-off: status page /a/{code}
}

/** GET /api/public/b/{webname}/dropoff */
export interface PublicDropOffInfo {
  enabled: boolean;
  services: string[]; // the business quick selection
  days: PublicSlotDay[]; // free windows, from tomorrow, DROPOFF_DAYS_AHEAD days
}

export interface BookDropOffRequest {
  start: string; // ISO, must equal a generated window start
  service: string; // 1..60
  item: string; // 1..120, e.g. "Auto, VW Golf"
  customerName: string; // 1..80
  customerPhone: string;
  customerEmail?: string | null; // required for channel MAIL
  channel: Channel;
  website?: string; // must stay empty (simple bot trap)
}

export interface RebookRequest {
  start: string;
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
