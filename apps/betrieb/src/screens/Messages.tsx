import { useState } from "react";
import { CHANNEL_LABELS, DELIVERY_STATUS_LABELS, MESSAGE_TYPE_LABELS } from "@abholdemo/shared";
import type { MessagesOverview, MessageView } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { formatDateTime, formatEuro } from "../format";
import { Alert, PageHeader, useLoad } from "../ui";

export function Messages() {
  // empty string means: server default (current demo month)
  const [month, setMonth] = useState("");
  const { data, error, setData } = useLoad(() => api<MessagesOverview>("GET", `/api/betrieb/messages${month ? `?month=${month}` : ""}`), [month]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function stop(m: MessageView) {
    setBusyId(m.id);
    setActionError(null);
    try {
      const updated = await api<MessageView>("POST", `/api/betrieb/messages/${encodeURIComponent(m.id)}/simulate-stop`);
      setData((cur) => (cur ? { ...cur, messages: cur.messages.map((x) => (x.id === updated.id ? updated : x)) } : cur));
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Nachrichten" />
      <p className="muted">Alle Nachrichten sind simuliert. Es wird nichts wirklich versendet.</p>
      <label className="field field-inline">
        <span>Monat</span>
        <input type="month" value={month || data?.month || ""} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </label>
      <Alert message={error} />
      <Alert message={actionError} />

      {data ? (
        <>
          <div className="summary">
            <div className="summary-box">
              <span className="summary-label">Monatssumme Kosten</span>
              <span className="summary-value">{formatEuro(data.monthTotalEur)}</span>
            </div>
            <div className="summary-box">
              <span className="summary-label">Nachrichten im Monat</span>
              <span className="summary-value">{data.monthCount}</span>
            </div>
          </div>

          {data.messages.length === 0 ? <p className="empty">In diesem Monat gibt es keine Nachrichten.</p> : null}
          <ul className="msg-list">
            {data.messages.map((m) => (
              <li key={m.id} className="card msg">
                <div className="msg-head">
                  <span className="msg-time">{formatDateTime(m.createdAt)}</span>
                  <a className="order-code order-code-sm" href={`#/auftrag/${m.orderId}`}>
                    {m.orderCode}
                  </a>
                  <span className="tag">{CHANNEL_LABELS[m.channel]}</span>
                  <span className="tag tag-soft">{MESSAGE_TYPE_LABELS[m.type]}</span>
                  <span className="msg-cost">{formatEuro(m.costEur)}</span>
                </div>
                <p className="msg-text">{m.text}</p>
                <dl className="kv kv-tight">
                  <dt>Empfänger</dt>
                  <dd>{m.recipientMasked}</dd>
                  <dt>Link</dt>
                  <dd>
                    <a href={m.link} target="_blank" rel="noreferrer">
                      {m.link}
                    </a>
                  </dd>
                  <dt>Zustellstatus</dt>
                  <dd>{DELIVERY_STATUS_LABELS[m.deliveryStatus]}</dd>
                </dl>
                {m.channel !== "MAIL" ? (
                  <div className="msg-demo">
                    {m.stopSimulated ? (
                      <span className="muted">STOP Antwort wurde simuliert. Der Kunde ist abgemeldet.</span>
                    ) : (
                      <button className="btn btn-secondary" disabled={busyId === m.id} onClick={() => stop(m)}>
                        STOP Antwort simulieren
                      </button>
                    )}
                    <span className="demo-tag">Demo</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {data.perOrder.length > 0 ? (
            <section className="card">
              <h2>Nachrichten pro Auftrag</h2>
              <ul className="per-order">
                {data.perOrder.map((p) => (
                  <li key={p.orderId}>
                    <a className="order-code order-code-sm" href={`#/auftrag/${p.orderId}`}>
                      {p.orderCode}
                    </a>
                    <span>{p.count === 1 ? "1 Nachricht" : `${p.count} Nachrichten`}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
