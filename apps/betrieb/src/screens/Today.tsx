import { useState } from "react";
import { ATTENDANCE_LABELS, MANUAL_TRANSITIONS } from "@abholdemo/shared";
import type { DaySlotList } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { addDays, formatDay, formatTime } from "../format";
import { Alert, PageHeader, StatusBadge, useLoad } from "../ui";

export function Today() {
  // null means "today" on the demo clock, decided by the server.
  const [day, setDay] = useState<string | null>(null);
  const { data, error, reload } = useLoad(() => api<DaySlotList>("GET", `/api/betrieb/day-slots${day ? `?date=${day}` : ""}`), [day]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function pickedUp(orderId: string) {
    setBusyId(orderId);
    setActionError(null);
    try {
      await api("POST", `/api/betrieb/orders/${encodeURIComponent(orderId)}/status`, { status: "ABGEHOLT" });
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Heute" />
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
      </div>
      {data ? <h2 className="day-title">{formatDay(data.date)}</h2> : null}
      <Alert message={error} />
      <Alert message={actionError} />
      {data && data.entries.length === 0 ? <p className="empty">An diesem Tag sind keine Abholzeiten gebucht.</p> : null}
      <ul className="order-list">
        {data?.entries.map((e) => (
          <li key={`${e.orderId}-${e.start}`} className="slot-row">
            <span className="slot-time">
              {formatTime(e.start)} bis {formatTime(e.end)}
            </span>
            <a className="order-code order-code-sm" href={`#/auftrag/${e.orderId}`}>
              {e.code}
            </a>
            <StatusBadge status={e.status} />
            <span className={`attendance attendance-${e.attendance}`}>{ATTENDANCE_LABELS[e.attendance]}</span>
            {MANUAL_TRANSITIONS[e.status].includes("ABGEHOLT") ? (
              <button className="btn btn-primary" disabled={busyId === e.orderId} onClick={() => pickedUp(e.orderId)}>
                Abgeholt
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
