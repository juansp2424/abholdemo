import { useState } from "react";
import type { FormEvent } from "react";
import { CHANNEL_LABELS, COMPLETION_NOTE_MAX, contactChannel, type OrderDetail } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { formatDateTime, formatDayShort, toDayString } from "../format";
import { Alert, useApp } from "../ui";

/** Change the expected completion date, optionally with a message to the customer. Shows the history of changes. */
export function CompletionForm({ o, onChange }: { o: OrderDetail; onChange: (o: OrderDetail) => void }) {
  const { clock } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(o.estimatedCompletion ?? "");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const today = clock ? toDayString(new Date(clock.now)) : toDayString(new Date());
  const channel = contactChannel(o.customerEmail, o.customerPhone);
  const to = channel === "MAIL" ? o.customerEmail : o.customerPhone;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<OrderDetail>("POST", `/api/betrieb/orders/${encodeURIComponent(o.id)}/completion`, { date: date || null, note: note || null, notify });
      onChange(d);
      setOpen(false);
      setNote("");
      setMsg({ kind: "success", text: notify && date ? "Das Datum ist geändert, der Kunde hat eine Nachricht bekommen." : "Das Datum ist geändert." });
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {o.canChangeCompletion && !open ? (
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={() => (setOpen(true), setMsg(null), setDate(o.estimatedCompletion ?? ""))}>
            Fertigstellungsdatum ändern
          </button>
        </div>
      ) : null}
      {open ? (
        <form className="notify-form" onSubmit={save}>
          <h3>Fertigstellungsdatum ändern</h3>
          <label className="field">
            <span>Neues Datum</span>
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
            <small className="muted">Leer lassen, um das Datum zu entfernen.</small>
          </label>
          <label className="field">
            <span>Grund für den Kunden (freiwillig)</span>
            <input value={note} maxLength={COMPLETION_NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="zum Beispiel: Das Ersatzteil kommt erst am Donnerstag." />
          </label>
          <label className="check">
            <input type="checkbox" checked={notify && !!date} disabled={!date} onChange={(e) => setNotify(e.target.checked)} />
            <span>Kunden benachrichtigen{channel && to ? ` (per ${CHANNEL_LABELS[channel]} an ${to})` : ""}</span>
          </label>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={busy || date === (o.estimatedCompletion ?? "")}>
              {busy ? "Wird gespeichert" : "Speichern"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : null}
      <Alert message={msg?.text} kind={msg?.kind} />
      {o.completionLog.length > 0 ? (
        <>
          <h3>Änderungen am Fertigstellungsdatum</h3>
          <ul className="log">
            {[...o.completionLog].reverse().map((c, i) => (
              <li key={i}>
                <span className="log-time">{formatDateTime(c.at)}</span>
                <span>
                  {c.from ? formatDayShort(c.from) : "kein Datum"} → <strong>{c.to ? formatDayShort(c.to) : "kein Datum"}</strong> <span className="muted">von {c.actorName}{c.notified ? ", Kunde benachrichtigt" : ""}</span>
                  {c.note ? <><br /><span className="muted">{c.note}</span></> : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
