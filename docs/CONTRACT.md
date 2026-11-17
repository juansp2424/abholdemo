# Vertrag (Contract)

Single source of truth for types and constants: `packages/shared/src/index.ts` (package `@abholdemo/shared`).
This document describes endpoints, behaviour and examples. Only the orchestrator changes the contract.
Agents that find a contract problem report it back and do not change it.

## 1. Basics

| Part | Port | Notes |
|---|---|---|
| `packages/api` | 4000 | Fastify, JSON file DB `packages/api/data/db.json` |
| `apps/betrieb` | 5173 | Vite + React PWA, proxies `/api` to 4000 |
| `apps/kunde` | 5174 | Vite + React, proxies `/api` to 4000 (with `xfwd`) |

* All bodies are JSON. Timestamps are ISO 8601 UTC strings. Dates are `YYYY-MM-DD` (server local time zone).
* All visible texts are German. Avoid dashes (no "–", "—", no " - " as a dash). Time ranges are written as `10:00 bis 10:15`.
* Error body for every non 2xx response: `{ "error": { "code": ErrorCode, "message": "German text" } }`.
* Demo clock: the server has `now() = Date.now() + offsetDays * 86400000`. Every time based rule (age, overdue, slots, today) uses this clock.
* Overdue sweep: before every list, detail, lookup, slots and day list request, and right after `POST /api/demo/advance`, the server runs `sweepOverdue()`: every order in `ABHOLBEREIT` whose `readyAt + pickupDeadlineDays` days is before `now()` becomes `UEBERFAELLIG` (log entry by `System`). If the order has an active subscription, exactly one `ERINNERUNG` message is created (never twice per order).
* No external network calls anywhere. No cookies anywhere on the customer side.

## 2. Status model

```
ANGENOMMEN ──► IN_ARBEIT ──► ABHOLBEREIT ──► ABGEHOLT
     │             │             │  ▲
     │             │             │  └ (system only) ──► UEBERFAELLIG ──► ABGEHOLT
     └─────────────┴─────────────┴──────────────► STORNIERT  (from any non final state)
```

Manual transitions: `MANUAL_TRANSITIONS` in shared. `ANGENOMMEN` may go directly to `ABHOLBEREIT` (quick jobs).
`UEBERFAELLIG` is set only by the sweep. Invalid transition: `409 INVALID_TRANSITION`.

Side effects:

| Transition to | Effect |
|---|---|
| `ABHOLBEREIT` | sets `readyAt = now()`. Slot booking opens. If an active subscription exists, create one `ABHOLBEREIT` message on the subscription channel (only once per order, ever). |
| `ABGEHOLT` | sets `pickedUpAt = now()`. Active slot booking gets `released = true` (capacity freed, booking still visible in the day list). |
| `STORNIERT` | active slot booking gets `released = true`. |
| every change | append `StatusLogEntry { at, from, to, actorId, actorName }`. Creation appends `{from: null, to: "ANGENOMMEN"}`. |

## 3. Order code

6 chars from `CODE_ALPHABET` using `crypto.randomInt`. Regenerate on collision with any existing code. Never sequential.
Customer input is normalized with `normalizeCode` (strip whitespace, uppercase) on client and server.

## 4. Messages (simulated, never sent)

| Type | When | Recipient | Channel | Cost |
|---|---|---|---|---|
| `STATUSLINK` | order created with `customerEmail` | intake email | `MAIL` | 0 |
| `ABHOLBEREIT` | status set to `ABHOLBEREIT`, active subscription | subscription contact | subscription channel | per channel |
| `ERINNERUNG` | sweep marks `UEBERFAELLIG`, active subscription | subscription contact | subscription channel | per channel |

Texts (server builds them, `{link}` = `statusUrl(webname, code)`):

* `STATUSLINK`: `Guten Tag, Ihr Auftrag {nummer} bei {betrieb} ist angenommen. Den Stand sehen Sie hier: {link}`
* `ABHOLBEREIT`: `settings.messageTemplate` with placeholders replaced.
* `ERINNERUNG`: `Guten Tag, Ihr Auftrag {nummer} bei {betrieb} liegt zur Abholung bereit. Bitte holen Sie ihn bald ab. Abholzeit wählen: {link}`
* Suffix for `MAIL`: ` Keine Nachricht mehr? Abbestellen: {link}?abmelden=1`. Suffix for `SMS`/`WHATSAPP`: ` Antworten Sie STOP, dann bekommen Sie keine Nachricht mehr.` (STATUSLINK has no suffix because it is not a subscription.)
* Texts contain no advertising and never the item, name or photo.

Masking: email `petra@beispiel.de` → `p***@beispiel.de`; phone `+49 151 23456712` → `+49 *** ****12` (keep a leading `+NN` if present, then the last 2 digits).

Channel rule (R26): the customer picks the channel in "Sag mir Bescheid". The form preselects `MAIL` (shown first, recommended). `settings.defaultChannel` is the preselected value; seed value is `MAIL`. Mail costs nothing, so the UI recommends it.

## 5. Rate limit and neutral responses (R10, R11)

* Device key: client IP. When the socket address is loopback (request came through our own Vite proxy), use the LAST `X-Forwarded-For` entry, which our proxy appends itself; client supplied earlier entries are ignored. Otherwise use the socket address.
* Every request to `/api/public/b/:webname/orders/:code*` counts as failed if the code is unknown, malformed or belongs to another business.
* After `RATE_LIMIT_MAX_FAILS` (10) failures within 60 s the key is locked for 60 s: every public order request returns `429 RATE_LIMITED` with `RATE_LIMIT_MESSAGE`, also for valid codes.
* Unknown, malformed and wrong business codes all return `404 { error: { code: "NOT_FOUND", message: NEUTRAL_NOT_FOUND_MESSAGE } }`. Byte identical body.
* `GET /api/public/b/:webname/orders/:code` always takes at least `PUBLIC_LOOKUP_MIN_MS` (300 ms), found or not (pad with a delay).
* The limiter takes an injectable clock for tests.

## 6. Endpoints

### 6.1 Auth (staff)

`POST /api/auth/login` body `LoginRequest` → `200 LoginResponse`; wrong credentials or inactive user → `401 UNAUTHORIZED` "Benutzername oder Passwort stimmt nicht."

```json
{ "token": "9f2c...", "user": { "id": "u1", "username": "inhaber", "displayName": "Maria Leisten", "role": "INHABER", "active": true } }
```

All `/api/betrieb/*` and `/api/demo/*` need `Authorization: Bearer <token>`, else `401`. Tokens are random, kept in the DB, revoked when the user is deactivated.
`GET /api/auth/me` → `StaffUser`. `POST /api/auth/logout` → `204`.

Owner only (`INHABER`), else `403 FORBIDDEN` "Nur für Inhaber.": settings and staff endpoints.

### 6.2 Orders (staff)

`GET /api/betrieb/business` → `BusinessInfo` (all roles).

`GET /api/betrieb/orders?filter=alle|offen|abholbereit|ueberfaellig|heute_abgeholt&q=text` → `OrderSummary[]` sorted newest first.

* `alle`: all orders. `offen`: `ANGENOMMEN` and `IN_ARBEIT`. `abholbereit`: `ABHOLBEREIT`. `ueberfaellig`: `UEBERFAELLIG`. `heute_abgeholt`: `ABGEHOLT` with `pickedUpAt` on today's date (demo clock).
* `q`: case insensitive; matches if `normalizeCode(q)` is contained in the code, or `q` is contained in `customerName`.

```json
[{ "id": "o5", "code": "7KP4QX", "item": "Auto, Ölwechsel", "customerName": "Jonas Probe", "status": "ABHOLBEREIT", "ageDays": 6, "createdAt": "2026-11-09T10:00:00.000Z", "slot": { "start": "2026-11-15T14:30:00.000Z", "end": "2026-11-15T14:45:00.000Z" }, "hasPhoto": false, "notify": true }]
```

`POST /api/betrieb/orders` body `CreateOrderRequest` → `201 OrderDetail`. Only `item` is required. Validation errors → `400 VALIDATION` with a German message naming the field. Email: simple `x@y.z` check. Phone: digits, spaces, leading `+`, 6 to 20 digits. Photo saved as a file in `packages/api/data/photos/<orderId>.<ext>`.

`GET /api/betrieb/orders/:id` → `OrderDetail` (includes `photoDataUrl`, `log`, `subscription`, `consentLog`). Unknown → `404 NOT_FOUND` "Auftrag nicht gefunden."

`POST /api/betrieb/orders/:id/status` body `ChangeStatusRequest` → `200 OrderDetail` or `409 INVALID_TRANSITION` "Dieser Statuswechsel ist nicht möglich."

### 6.3 Day list (staff)

`GET /api/betrieb/day-slots?date=YYYY-MM-DD` (default: today, demo clock) → `DaySlotList`. Includes released bookings of orders that were picked up (attendance `ERSCHIENEN`). Attendance: `ERSCHIENEN` if status `ABGEHOLT`; else `NICHT_ERSCHIENEN` if `end < now()`; else `ERWARTET`. Cancelled by the customer or `STORNIERT` bookings are not listed.

### 6.4 Messages (staff)

`GET /api/betrieb/messages?month=YYYY-MM` (default current demo month) → `MessagesOverview`. `monthTotalEur` rounded to 4 decimals.

```json
{ "month": "2026-11", "monthCount": 3, "monthTotalEur": 0.1206,
  "messages": [{ "id": "m3", "orderId": "o7", "orderCode": "RT8WMZ", "type": "ERINNERUNG", "channel": "SMS", "recipientMasked": "+49 *** ****34", "text": "Guten Tag, ...", "link": "http://localhost:5174/b/werkstatt-demo/a/RT8WMZ", "deliveryStatus": "ZUGESTELLT_SIMULIERT", "costEur": 0.075, "createdAt": "...", "stopSimulated": false }],
  "perOrder": [{ "orderId": "o7", "orderCode": "RT8WMZ", "count": 2 }] }
```

`POST /api/betrieb/messages/:id/simulate-stop` (demo, SMS or WhatsApp only, else `409 NOT_ALLOWED`) → `200 MessageView`. Revokes the order's subscription with source `STOP`, appends a `WIDERRUF` consent event.

### 6.5 Settings and staff (owner only)

`BusinessSettings.quickCategories` (string[]): the quick selection chips for new orders. Empty by default, nothing is predefined. Owner defined, max 20 entries of 1 to 40 chars, trimmed, duplicates (case insensitive) rejected with 400. If the field is missing in a PUT the current list is kept. `GET /api/betrieb/business` returns the same list (`BusinessInfo.quickCategories`) so every staff member sees the chips.


`GET /api/betrieb/settings` → `BusinessSettings`. `PUT /api/betrieb/settings` body `BusinessSettings` (webname ignored) → `200 BusinessSettings` or `400 VALIDATION`.
`POST /api/betrieb/settings/preview` body `{ "template": string }` → `{ "text": string }` (rendered with sample code `ABC234` and the business name, plus the MAIL suffix).

`GET /api/betrieb/staff` → `StaffUser[]`. `POST /api/betrieb/staff` body `CreateStaffRequest` → `201 StaffUser` (`400` if username taken). `PATCH /api/betrieb/staff/:id` body `UpdateStaffRequest` → `StaffUser`. An owner cannot deactivate themselves or remove the last active owner (`409 NOT_ALLOWED`).

### 6.6 Demo tools (any logged in staff)

`GET /api/demo/clock` → `DemoClock`. `POST /api/demo/advance` body `AdvanceTimeRequest` → `AdvanceTimeResponse`. `POST /api/demo/reset` → `DemoClock` (restores seed, offset 0, deletes uploaded photos, keeps nothing else; all tokens stay valid only if the user still exists in the seed, seed user ids are stable).

### 6.7 Public (customer website, no auth, no cookies)

`GET /api/public/b/:webname` → `PublicBusiness` or `404 NOT_FOUND` "Diesen Betrieb gibt es nicht."

`GET /api/public/b/:webname/orders/:code` → `PublicOrderView`, neutral 404, rate limited, min 300 ms.

```json
{ "code": "7KP4QX", "status": "ABHOLBEREIT", "statusLabel": "Abholbereit", "statusText": "Ihr Auftrag ist fertig. Sie können ihn abholen.",
  "estimatedCompletion": null, "plannedPickupDate": null,
  "slot": { "start": "2026-11-15T14:30:00.000Z", "end": "2026-11-15T14:45:00.000Z" },
  "pickupDeadlineDays": 14, "pickupDeadline": "2026-11-28",
  "canSubscribe": false, "notifyActive": true, "notifyChannel": "MAIL", "slotBookingOpen": true }
```

`POST /api/public/b/:webname/orders/:code/subscribe` body `SubscribeRequest` → `PublicOrderView`.
`consent !== true` → `400 VALIDATION` "Bitte setzen Sie den Haken, damit wir Ihnen schreiben dürfen." Invalid contact → `400 VALIDATION`. Status not in `SUBSCRIBE_STATUSES` → `409 NOT_ALLOWED`. An existing active subscription is replaced (new consent event). Stores `consentAt` and `CONSENT_TEXT`.

`POST /api/public/b/:webname/orders/:code/unsubscribe` body `UnsubscribeRequest` → `PublicOrderView`. Logs a `WIDERRUF` event. Idempotent.

`GET /api/public/b/:webname/orders/:code/slots` → `PublicSlotsResponse`; status not in `SLOT_STATUSES` → `409 NOT_ALLOWED` "Abholzeiten gibt es, sobald Ihr Auftrag fertig ist."

Slot generation: for each of the next 7 calendar days including today (demo clock), for each opening interval, slots of `slotLengthMinutes` from `open` while `slotStart + length <= close`. Only slots with `start > now()` and `free = slotCapacity - activeBookingsAt(start) > 0`. The order's own current booking counts as taken but its own slot is still listed (with its `free` value) so the customer can see it.

`PUT /api/public/b/:webname/orders/:code/slot` body `BookSlotRequest` → `PublicOrderView`. `start` not a generated slot start → `400 SLOT_INVALID` "Diese Abholzeit gibt es nicht. Bitte wählen Sie eine andere." Full → `409 SLOT_FULL` "Diese Abholzeit ist leider schon voll. Bitte wählen Sie eine andere." Replaces an existing booking of this order (old one removed). Check and write happen synchronously, so no double booking.

`DELETE /api/public/b/:webname/orders/:code/slot` → `PublicOrderView` (booking removed).

## 7. Seed (R4)

Business `Werkstatt Demo`, webname `werkstatt-demo`, hours Mo to Fr 09:00 to 13:00 and 14:00 to 18:00, Sa 09:00 to 13:00, So closed. Slot length 15, capacity 2, deadline 14 days, default channel MAIL, default template.

Staff (password for both `demo1234`): `inhaber` Maria Leisten (INHABER), `mitarbeiter` Tom Werner (MITARBEITER). Stable ids `u1`, `u2`.

Orders relative to seed time (all names and contacts invented, domains `beispiel.de`, phone numbers `+49 151 000000xx`):

| Code | Status | Notes |
|---|---|---|
| `H7RT3K` | ANGENOMMEN | today, Auto Winterreifen aufziehen, Petra Beispiel, intake email, STATUSLINK message |
| `N4WZ8P` | ANGENOMMEN | 1 day, Tasche Naht, no name |
| `Q9XB2M` | IN_ARBEIT | 2 days, Fahrrad Bremsen einstellen, estimatedCompletion = tomorrow, subscription MAIL |
| `C6VJ5T` | IN_ARBEIT | 4 days, Auto Klimaanlage prüfen, Klaus Muster |
| `7KP4QX` | ABHOLBEREIT | ready 1 day ago, subscription MAIL, ABHOLBEREIT message, slot booked today at the next free slot of today (or next opening day) |
| `D3FY6W` | ABHOLBEREIT | ready 2 days ago, no subscription |
| `G8UE4R` | ABHOLBEREIT | ready 12 days ago, subscription WHATSAPP, ABHOLBEREIT message (advance 3 days makes it overdue + reminder) |
| `RT8WMZ` | UEBERFAELLIG | ready 18 days ago, subscription SMS, ABHOLBEREIT + ERINNERUNG messages |
| `Z5MA9H` | ABGEHOLT | picked up today, booking released |
| `X2SP7N` | STORNIERT | 5 days |

Every seed order has a consistent status log with actors `u1`/`u2`/System.
