import { useMemo, useState } from "react";
import { ATTENDANCE_LABELS, MANUAL_TRANSITIONS, STATUS_LABELS } from "@abholdemo/shared";
import type { DaySlotEntry, DaySlotList, OrderStatus } from "@abholdemo/shared";
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

interface Placed {
  entry: DaySlotEntry;
  lane: number;
  top: number;
  height: number;
}

/** Greedy lane assignment: an entry takes the first lane that is free at its start. */
function layout(entries: DaySlotEntry[], from: number): { placed: Placed[]; lanes: number } {
  const sorted = [...entries].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const laneEnds: number[] = [];
  const placed: Placed[] = sorted.map((entry) => {
    const start = Date.parse(entry.start);
    const end = Date.parse(entry.end);
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    const startMin = minutesOf(entry.start);
    const endMin = startMin + Math.max(1, Math.round((end - start) / 60_000));
    return { entry, lane, top: px(startMin - from), height: Math.max(24, px(endMin - startMin) - 2) };
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

  const view = useMemo(() => {
    if (!data) return null;
    const marks: number[] = [];
    for (const iv of data.openingHours) marks.push(hm(iv.open), hm(iv.close));
    for (const e of data.entries) marks.push(minutesOf(e.start), minutesOf(e.end) || 24 * 60);
    const from = marks.length ? Math.floor(Math.min(...marks) / 60) * 60 : 8 * 60;
    const to = marks.length ? Math.max(from + 60, Math.ceil(Math.max(...marks) / 60) * 60) : 18 * 60;
    // Shade the times when the business is closed
    const closed: { from: number; to: number }[] = [];
    let cursor = from;
    for (const iv of [...data.openingHours].sort((a, b) => hm(a.open) - hm(b.open))) {
      if (hm(iv.open) > cursor) closed.push({ from: cursor, to: hm(iv.open) });
      cursor = Math.max(cursor, hm(iv.close));
    }
    if (cursor < to) closed.push({ from: cursor, to });
    const { placed, lanes } = layout(data.entries, from);
    const hours: number[] = [];
    for (let m = from; m <= to; m += 60) hours.push(m);
    return { from, to, closed, placed, lanes, hours };
  }, [data]);

  const todayStr = clock ? toDayString(new Date(clock.now)) : null;
  const nowMin = clock ? minutesOf(clock.now) : 0;
  const showNow = !!(data && view && data.date === todayStr && nowMin >= view.from && nowMin <= view.to);
  const sel = data?.entries.find((e) => `${e.orderId}-${e.start}` === selected) ?? null;
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
          {data.entries.length === 0 && data.completions.length === 0 ? <p className="muted cal-note">An diesem Tag ist nichts geplant. Es sind keine Abholzeiten gebucht.</p> : null}

          <div className="cal-legend" aria-hidden="true">
            <span><i className="cal-dot cal-erwartet" /> Abholung erwartet</span>
            <span><i className="cal-dot cal-nicht" /> Noch nicht erschienen</span>
            <span><i className="cal-dot cal-erschienen" /> Abgeholt</span>
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
                {view.closed.map((c) => (
                  <div key={`${c.from}-${c.to}`} className="cal-closed" style={{ top: px(c.from - view.from), height: px(c.to - c.from) }} aria-hidden="true" />
                ))}
                {showNow ? <div className="cal-now" style={{ top: px(nowMin - view.from) }} aria-hidden="true" /> : null}
                {view.placed.map(({ entry, lane, top, height }) => {
                  const key = `${entry.orderId}-${entry.start}`;
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
