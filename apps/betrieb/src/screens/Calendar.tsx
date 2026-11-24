import { useMemo, useState } from "react";
import { APPOINTMENT_STATE_LABELS, ATTENDANCE_LABELS, CHANNEL_LABELS, MANUAL_TRANSITIONS, STATUS_LABELS } from "@abholdemo/shared";
import type { AppointmentView, DaySlotEntry, DaySlotList, OrderDetail, OrderStatus } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { addDays, formatDay, formatTime, toDayString } from "../format";
import { Alert, PageHeader, StatusBadge, useApp, useLoad } from "../ui";

/** Pixels per hour on the time axis. A 15 minute pickup is 24px high. */
const HOUR_PX = 96;
/** Minimum width of one lane. Parallel pickups in the same slot get their own lane, so the calendar grows wider. */
const LANE_MIN_PX = 150;
const DONE_STATUSES: OrderStatus[] = ["ABHOLBEREIT", "UEBERFAELLIG", "ABGEHOLT"];

const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const minutesOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const pad = (n: number) => String(n).padStart(2, "0");
const px = (min: number) => (min * HOUR_PX) / 60;

/** A bar in the calendar: a pickup (order) or a drop-off appointment. */
type Bar = { key: string; start: string; end: string } & ({ kind: "pickup"; entry: DaySlotEntry } | { kind: "dropoff"; appt: AppointmentView });

interface Placed {
  bar: Bar;
  lane: number;
  top: number;
  height: number;
}

/** Greedy lane assignment: an entry takes the first lane that is free at its start. */
function layout(bars: Bar[], from: number): { placed: Placed[]; lanes: number } {
  const sorted = [...bars].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const laneEnds: number[] = [];
  const placed: Placed[] = sorted.map((entry) => {
    const start = Date.parse(entry.start);
    const end = Date.parse(entry.end);
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    const startMin = minutesOf(entry.start);
    const endMin = startMin + Math.max(1, Math.round((end - start) / 60_000));
    return { bar: entry, lane, top: px(startMin - from), height: Math.max(24, px(endMin - startMin) - 2) };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

export function Calendar() {
  const { clock } = useApp();
  // null means "today" on the demo clock, decided by the server.
  const [day, setDay] = useState<string | null>(null);
  const { data, error, reload } = useLoad(() => api<DaySlotList>("GET", `/api/betrieb/day-slots${day ? `?date=${day}` : ""}`), [day]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmApptCancel, setConfirmApptCancel] = useState(false);

  async function pickedUp(orderId: string) {
    setBusy(true);
    setActionError(null);
    try {
      await api("POST", `/api/betrieb/orders/${encodeURIComponent(orderId)}/status`, { status: "ABGEHOLT" });
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function apptAction(a: AppointmentView, action: "convert" | "no-show" | "cancel") {
    setBusy(true);
    setActionError(null);
    try {
      const r = await api<OrderDetail | AppointmentView>("POST", `/api/betrieb/appointments/${encodeURIComponent(a.id)}/${action}`);
      if (action === "convert") window.location.hash = `#/auftrag/${(r as OrderDetail).id}`;
      else reload();
      setConfirmApptCancel(false);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const bars = useMemo<Bar[]>(
    () =>
      data
        ? [
            ...data.entries.map((entry) => ({ key: `${entry.orderId}-${entry.start}`, start: entry.start, end: entry.end, kind: "pickup" as const, entry })),
            ...data.dropOffs.map((appt) => ({ key: `appt-${appt.id}`, start: appt.start, end: appt.end, kind: "dropoff" as const, appt })),
          ]
        : [],
    [data],
  );

  const view = useMemo(() => {
    if (!data) return null;
    const marks: number[] = [];
    for (const iv of data.openingHours) marks.push(hm(iv.open), hm(iv.close));
    for (const e of bars) marks.push(minutesOf(e.start), minutesOf(e.end) || 24 * 60);
    const from = marks.length ? Math.floor(Math.min(...marks) / 60) * 60 : 8 * 60;
    const to = marks.length ? Math.max(from + 60, Math.ceil(Math.max(...marks) / 60) * 60) : 18 * 60;
    const { placed, lanes } = layout(bars, from);
    const hours: number[] = [];
    for (let m = from; m <= to; m += 60) hours.push(m);
    return { from, to, placed, lanes, hours };
  }, [data, bars]);

  const todayStr = clock ? toDayString(new Date(clock.now)) : null;
  const nowMin = clock ? minutesOf(clock.now) : 0;
  const showNow = !!(data && view && data.date === todayStr && nowMin >= view.from && nowMin <= view.to);
  const selBar = bars.find((b) => b.key === selected) ?? null;
  const sel = selBar?.kind === "pickup" ? selBar.entry : null;
  const selAppt = selBar?.kind === "dropoff" ? selBar.appt : null;
  const gridHeight = view ? px(view.to - view.from) : 0;

  return (
    <>
      <PageHeader title="Kalender" />
      <div className="day-nav">
        <button className="btn btn-secondary" disabled={!data} onClick={() => data && setDay(addDays(data.date, -1))}>
          ← Vorheriger Tag
        </button>
        <button className="btn btn-secondary" onClick={() => setDay(null)}>
          Heute
        </button>
        <button className="btn btn-secondary" disabled={!data} onClick={() => data && setDay(addDays(data.date, 1))}>
          Nächster Tag →
        </button>
        <input className="day-pick" type="date" aria-label="Datum wählen" value={data?.date ?? ""} onChange={(e) => e.target.value && setDay(e.target.value)} />
      </div>
      {data ? <h2 className="day-title">{formatDay(data.date)}</h2> : null}
      <Alert message={error} />
      <Alert message={actionError} />

      {data && view ? (
        <>
          {data.completions.length > 0 ? (
            <section className="card cal-completions" aria-label="Voraussichtlich fertig">
              <h3>Voraussichtlich fertig</h3>
              <div className="cal-chips">
                {data.completions.map((c) => (
                  <a key={c.orderId} href={`#/auftrag/${c.orderId}`} className={`cal-chip${DONE_STATUSES.includes(c.status) ? " cal-chip-done" : ""}`}>
                    <span className="order-code order-code-sm">{c.code}</span>
                    <span>{DONE_STATUSES.includes(c.status) ? `Fertig, ${STATUS_LABELS[c.status]}` : STATUS_LABELS[c.status]}</span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {data.openingHours.length === 0 ? <p className="muted cal-note">Der Betrieb ist an diesem Tag geschlossen.</p> : null}
          {bars.length === 0 && data.completions.length === 0 ? <p className="muted cal-note">An diesem Tag ist nichts geplant. Es sind keine Abholzeiten oder Abgaben gebucht.</p> : null}

          <div className="cal-legend" aria-hidden="true">
            <span><i className="cal-dot cal-erwartet" /> Abholung erwartet</span>
            <span><i className="cal-dot cal-nicht" /> Noch nicht erschienen</span>
            <span><i className="cal-dot cal-erschienen" /> Abgeholt</span>
            <span><i className="cal-dot cal-abgabe" /> Abgabe (Termin)</span>
          </div>

          <div className="cal-scroll" tabIndex={0} aria-label="Tageskalender, bei vielen Abholungen nebeneinander nach rechts scrollen">
            <div className="cal" style={{ ["--lanes" as string]: view.lanes, ["--lane-min" as string]: `${LANE_MIN_PX}px`, ["--hp" as string]: `${HOUR_PX}px` }}>
              <div className="cal-axis" style={{ height: gridHeight }}>
                {view.hours.map((m) => (
                  <span key={m} className="cal-hour" style={{ top: px(m - view.from) }}>
                    {pad(Math.floor(m / 60) % 24)}:00
                  </span>
                ))}
              </div>
              <div className="cal-lanes" style={{ height: gridHeight }}>
                {showNow ? <div className="cal-now" style={{ top: px(nowMin - view.from) }} aria-hidden="true" /> : null}
                {view.placed.map(({ bar, lane, top, height }) => {
                  if (bar.kind === "dropoff") {
                    const a = bar.appt;
                    const cls = a.state === "ERSCHIENEN" ? "cal-abgabe-done" : a.state === "NICHT_ERSCHIENEN" ? "cal-nicht" : "cal-abgabe";
                    const label = `Abgabe ${formatTime(a.start)}: ${a.service}, ${a.customerName}, ${APPOINTMENT_STATE_LABELS[a.state]}`;
                    return (
                      <button
                        type="button"
                        key={bar.key}
                        className={`cal-bar ${cls}${selected === bar.key ? " cal-selected" : ""}`}
                        style={{ top, height, ["--lane" as string]: lane }}
                        aria-pressed={selected === bar.key}
                        aria-label={label}
                        title={label}
                        onClick={() => (setSelected(selected === bar.key ? null : bar.key), setConfirmApptCancel(false))}
                      >
                        <span className="cal-code cal-service">Abgabe: {a.service}</span>
                        {height >= 44 ? <span className="cal-time">{a.customerName}</span> : null}
                      </button>
                    );
                  }
                  const entry = bar.entry;
                  const key = bar.key;
                  const cls = entry.attendance === "ERSCHIENEN" ? "cal-erschienen" : entry.attendance === "NICHT_ERSCHIENEN" ? "cal-nicht" : "cal-erwartet";
                  const time = `${formatTime(entry.start)} bis ${formatTime(entry.end)}`;
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`cal-bar ${cls}${selected === key ? " cal-selected" : ""}`}
                      style={{ top, height, ["--lane" as string]: lane }}
                      aria-pressed={selected === key}
                      aria-label={`${entry.code}, ${time}, ${ATTENDANCE_LABELS[entry.attendance]}`}
                      title={`${entry.code}, ${time}, ${ATTENDANCE_LABELS[entry.attendance]}`}
                      onClick={() => setSelected(selected === key ? null : key)}
                    >
                      <span className="cal-code">{entry.code}</span>
                      {height >= 44 ? <span className="cal-time">{time}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selAppt ? (
            <section className="card cal-detail" aria-live="polite">
              <div className="cal-detail-head">
                <strong>Abgabe: {selAppt.service}</strong>
                <span className="muted">{APPOINTMENT_STATE_LABELS[selAppt.state]}</span>
              </div>
              <dl className="kv kv-tight">
                <dt>Zeit</dt>
                <dd>{formatTime(selAppt.start)} bis {formatTime(selAppt.end)}</dd>
                <dt>Gegenstand</dt>
                <dd>{selAppt.item}</dd>
                <dt>Kunde</dt>
                <dd>{selAppt.customerName}</dd>
                <dt>Telefon</dt>
                <dd>{selAppt.customerPhone}</dd>
                {selAppt.customerEmail ? (<><dt>Mail</dt><dd>{selAppt.customerEmail}</dd></>) : null}
                <dt>Bestätigung</dt>
                <dd>per {CHANNEL_LABELS[selAppt.channel]}</dd>
              </dl>
              <div className="btn-row">
                {selAppt.orderId ? (
                  <a className="btn btn-secondary" href={`#/auftrag/${selAppt.orderId}`}>Zum Auftrag {selAppt.orderCode}</a>
                ) : null}
                {selAppt.state === "GEBUCHT" || selAppt.state === "NICHT_ERSCHIENEN" ? (
                  <button className="btn btn-primary" disabled={busy} onClick={() => apptAction(selAppt, "convert")}>Kunde ist da: Auftrag anlegen</button>
                ) : null}
                {selAppt.state === "GEBUCHT" ? (
                  <>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => apptAction(selAppt, "no-show")}>Nicht erschienen</button>
                    <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmApptCancel(true)}>Absagen</button>
                  </>
                ) : null}
              </div>
              {confirmApptCancel ? (
                <div className="confirm" role="alertdialog" aria-label="Absage bestätigen">
                  <p>Termin absagen? Der Kunde bekommt eine Nachricht mit einem Link, um einen neuen Termin zu buchen.</p>
                  <div className="btn-row">
                    <button className="btn btn-danger" disabled={busy} onClick={() => apptAction(selAppt, "cancel")} autoFocus>Ja, absagen</button>
                    <button className="btn btn-secondary" onClick={() => setConfirmApptCancel(false)}>Nein</button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {sel ? (
            <section className="card cal-detail" aria-live="polite">
              <div className="cal-detail-head">
                <a className="order-code order-code-sm" href={`#/auftrag/${sel.orderId}`}>
                  {sel.code}
                </a>
                <StatusBadge status={sel.status} />
                <span className={`attendance attendance-${sel.attendance}`}>{ATTENDANCE_LABELS[sel.attendance]}</span>
              </div>
              <p>
                Abholzeit: {formatTime(sel.start)} bis {formatTime(sel.end)}
              </p>
              <div className="btn-row">
                <a className="btn btn-secondary" href={`#/auftrag/${sel.orderId}`}>
                  Zum Auftrag
                </a>
                {MANUAL_TRANSITIONS[sel.status].includes("ABGEHOLT") ? (
                  <button className="btn btn-primary" disabled={busy} onClick={() => pickedUp(sel.orderId)}>
                    Abgeholt
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
