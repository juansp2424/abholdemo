import { useState } from "react";
import type { FormEvent } from "react";
import { CHANNEL_LABELS, NOTIFY_MAX_LENGTH, STATUS_LABELS, contactChannel } from "@abholdemo/shared";
import type { MessageView, OrderDetail, OrderStatus } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { formatDayShort, formatDateTime, formatSlot } from "../format";
import { Alert, PageHeader, StatusBadge, useLoad } from "../ui";

export function OrderDetailScreen({ id }: { id: string }) {
  const { data, error, setData } = useLoad(() => api<OrderDetail>("GET", `/api/betrieb/orders/${encodeURIComponent(id)}`), [id]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function change(status: OrderStatus) {
    setBusy(true);
    setActionError(null);
    try {
      setData(await api<OrderDetail>("POST", `/api/betrieb/orders/${encodeURIComponent(id)}/status`, { status }));
      setConfirmCancel(false);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const refresh = async () => setData(await api<OrderDetail>("GET", `/api/betrieb/orders/${encodeURIComponent(id)}`));

  return (
    <>
      <PageHeader title="Auftrag">
        <a className="btn btn-secondary" href="#/auftraege">
          Zur Liste
        </a>
      </PageHeader>
      <Alert message={error} />
      {!data && !error ? <p className="muted">Auftrag wird geladen.</p> : null}
      {data ? <Body o={data} refresh={refresh} busy={busy} change={change} confirmCancel={confirmCancel} setConfirmCancel={setConfirmCancel} actionError={actionError} /> : null}
    </>
  );
}

function Body(props: {
  o: OrderDetail;
  refresh: () => Promise<void>;
  busy: boolean;
  change: (s: OrderStatus) => void;
  confirmCancel: boolean;
  setConfirmCancel: (v: boolean) => void;
  actionError: string | null;
}) {
  const { o, refresh, busy, change, confirmCancel, setConfirmCancel, actionError } = props;
  const canReady = o.allowedTransitions.includes("ABHOLBEREIT");
  const others = o.allowedTransitions.filter((s) => s !== "ABHOLBEREIT");
  const sub = o.subscription;

  return (
    <div className="detail">
      <section className="card detail-head">
        <div className="detail-code">{o.code}</div>
        <div>
          <p className="detail-item">{o.item}</p>
          <StatusBadge status={o.status} /> <span className="muted">{o.ageDays === 1 ? "1 Tag alt" : `${o.ageDays} Tage alt`}</span>
        </div>
        <a className="btn btn-secondary" href={`#/anhaenger/${o.id}`}>
          Anhänger drucken
        </a>
      </section>

      <Alert message={actionError} />

      {o.allowedTransitions.length > 0 ? (
        <section className="card actions" aria-label="Status ändern">
          {canReady ? (
            <button className="btn btn-primary btn-xl" disabled={busy} onClick={() => change("ABHOLBEREIT")}>
              {STATUS_LABELS.ABHOLBEREIT}
            </button>
          ) : null}
          <div className="btn-row">
            {others.map((s) =>
              s === "STORNIERT" ? (
                <button key={s} className="btn btn-danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  {STATUS_LABELS[s]}
                </button>
              ) : (
                <button key={s} className="btn btn-secondary" disabled={busy} onClick={() => change(s)}>
                  {STATUS_LABELS[s]}
                </button>
              )
            )}
          </div>
          {confirmCancel ? (
            <div className="confirm" role="alertdialog" aria-label="Stornieren bestätigen">
              <p>Soll dieser Auftrag wirklich storniert werden? Das lässt sich nicht rückgängig machen.</p>
              <div className="btn-row">
                <button className="btn btn-danger" disabled={busy} onClick={() => change("STORNIERT")} autoFocus>
                  Ja, stornieren
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirmCancel(false)}>
                  Nein, behalten
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="muted">Dieser Auftrag ist abgeschlossen. Der Status kann nicht mehr geändert werden.</p>
      )}

      {o.photoDataUrl ? (
        <section className="card">
          <h2>Foto</h2>
          <img className="order-photo" src={o.photoDataUrl} alt={`Foto zu Auftrag ${o.code}`} />
        </section>
      ) : null}

      <section className="card">
        <h2>Kunde</h2>
        <dl className="kv">
          <dt>Name</dt>
          <dd>{o.customerName ?? "Nicht erfasst"}</dd>
          <dt>Mail</dt>
          <dd>{o.customerEmail ?? "Nicht erfasst"}</dd>
          <dt>Telefon</dt>
          <dd>{o.customerPhone ?? "Nicht erfasst"}</dd>
          <dt>Geplantes Abholdatum</dt>
          <dd>{o.plannedPickupDate ? formatDayShort(o.plannedPickupDate) : "Nicht erfasst"}</dd>
          <dt>Voraussichtlich fertig</dt>
          <dd>{o.estimatedCompletion ? formatDayShort(o.estimatedCompletion) : "Nicht erfasst"}</dd>
          {o.pickupDeadline ? (
            <>
              <dt>Abholfrist</dt>
              <dd>{formatDayShort(o.pickupDeadline)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="card">
        <h2>Abholzeit</h2>
        {o.slot ? <p className="slot-big">{formatSlot(o.slot.start, o.slot.end)}</p> : <p className="muted">Noch keine Abholzeit gebucht.</p>}
      </section>

      <section className="card">
        <h2>Benachrichtigung</h2>
        {sub ? (
          <>
            <p>
              <strong>{sub.active ? "Aktiv" : "Abbestellt"}</strong> über {CHANNEL_LABELS[sub.channel]} an {sub.contact}
            </p>
            <p className="muted">Zustimmung am {formatDateTime(sub.consentAt)}</p>
            <p className="quote">{sub.consentText}</p>
            {sub.revokedAt ? <p className="muted">Abbestellt am {formatDateTime(sub.revokedAt)}</p> : null}
          </>
        ) : (
          <p className="muted">Der Kunde hat sich nicht eintragen lassen. Es wird keine Nachricht verschickt.</p>
        )}
        {o.consentLog.length > 0 ? (
          <>
            <h3>Zustimmungsprotokoll</h3>
            <ul className="log">
              {o.consentLog.map((c, i) => (
                <li key={i}>
                  <span className="log-time">{formatDateTime(c.at)}</span>
                  <span>
                    <strong>{c.type === "ZUSTIMMUNG" ? "Zustimmung" : "Widerruf"}</strong> ({CHANNEL_LABELS[c.channel]}, {sourceLabel(c.source)})
                    <br />
                    <span className="muted">{c.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <NotifyForm o={o} onSent={refresh} />
      </section>

      <section className="card">
        <h2>Statusprotokoll</h2>
        <ul className="log">
          {o.log.map((l, i) => (
            <li key={i}>
              <span className="log-time">{formatDateTime(l.at)}</span>
              <span>
                {l.from ? `${STATUS_LABELS[l.from]} → ` : "Neu: "}
                <strong>{STATUS_LABELS[l.to]}</strong> <span className="muted">von {l.actorName}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Nachrichten und Link</h2>
        <p>
          Für diesen Auftrag gibt es {o.messageCount === 1 ? "1 Nachricht" : `${o.messageCount} Nachrichten`}. <a href="#/nachrichten">Zu den Nachrichten</a>
        </p>
        <p>
          Statusseite für den Kunden:{" "}
          <a href={o.statusUrl} target="_blank" rel="noreferrer">
            {o.statusUrl}
          </a>
        </p>
      </section>
    </div>
  );
}

function sourceLabel(s: string): string {
  if (s === "KUNDENSEITE") return "Kundenseite";
  if (s === "LINK") return "Link";
  if (s === "STOP") return "STOP Antwort";
  return s;
}

/** Free text message to the customer's intake contact: mail if an address was captured, otherwise SMS. */
function NotifyForm({ o, onSent }: { o: OrderDetail; onSent: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  if (o.status === "ABGEHOLT" || o.status === "STORNIERT") return null;
  const channel = contactChannel(o.customerEmail, o.customerPhone);
  if (!channel) return <p className="muted">Für diesen Auftrag ist weder eine Mailadresse noch eine Telefonnummer gespeichert.</p>;
  const to = channel === "MAIL" ? o.customerEmail : o.customerPhone;

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api<MessageView>("POST", `/api/betrieb/orders/${encodeURIComponent(o.id)}/notify`, { text });
      setText("");
      setMsg({ kind: "success", text: "Die Mitteilung wurde gesendet. Sie steht unter Nachrichten." });
      await onSent();
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="notify-form" onSubmit={send}>
      <h3>Mitteilung an den Kunden</h3>
      <p className="muted">
        Geht per {CHANNEL_LABELS[channel]} an {to}.{channel === "SMS" ? " Es liegt keine Mailadresse vor, deshalb per SMS." : ""} Zum Beispiel, wenn ein Teil noch bestellt werden muss. <span className="demo-tag">Demo</span> Es wird nichts wirklich gesendet.
      </p>
      <label className="field">
        <span>Ihre Mitteilung</span>
        <textarea
          rows={3}
          value={text}
          maxLength={NOTIFY_MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          placeholder="zum Beispiel: Das Ersatzteil ist bestellt. Die Reparatur dauert zwei Tage länger."
          required
        />
        <small className="muted">{text.length} von {NOTIFY_MAX_LENGTH} Zeichen</small>
      </label>
      <Alert message={msg?.text} kind={msg?.kind} />
      <button className="btn btn-primary" disabled={busy || !text.trim()}>
        {busy ? "Wird gesendet" : "Mitteilung senden"}
      </button>
    </form>
  );
}
