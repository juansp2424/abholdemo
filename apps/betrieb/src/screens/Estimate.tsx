import { useState } from "react";
import type { FormEvent } from "react";
import {
  CHANNEL_LABELS,
  ESTIMATE_DESCRIPTION_MAX,
  ESTIMATE_STATE_LABELS,
  type EstimateChannel,
  type EstimateView,
  type OrderDetail,
} from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { addDays, formatDateTime, formatDayShort, formatEuro, toDayString } from "../format";
import { Alert, useApp } from "../ui";

const url = (o: OrderDetail, tail = "") => `/api/betrieb/orders/${encodeURIComponent(o.id)}/estimate${tail}`;
const money = (cents: number) => formatEuro(cents / 100);

export function EstimateBadge({ state }: { state: EstimateView["state"] }) {
  return <span className={`est-tag est-${state}`}>{ESTIMATE_STATE_LABELS[state]}</span>;
}

/** Cost estimate (Kostenvoranschlag): send by mail or WhatsApp, see the answer, record a phone answer. */
export function EstimateSection({ o, onChange }: { o: OrderDetail; onChange: (o: OrderDetail) => void }) {
  const { clock } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState(false);
  const latest = o.estimates.at(-1);
  const open = latest?.state === "OFFEN" ? latest : null;

  async function run(tail: string, body?: unknown, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      onChange(await api<OrderDetail>("POST", url(o, tail), body));
      if (ok) setMsg({ kind: "success", text: ok });
      return true;
    } catch (e) {
      setMsg({ kind: "error", text: errorMessage(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!o.canEstimate && o.estimates.length === 0) return null;
  const showForm = o.canEstimate && (!open || form);

  return (
    <section className="card" aria-labelledby="kv-h">
      <h2 id="kv-h">Kostenvoranschlag</h2>
      {open ? (
        <div className="est-open">
          <p className="est-amount">{money(open.amountCents)}</p>
          <p>{open.description}</p>
          <p className="muted">
            <EstimateBadge state={open.state} /> Version {open.version}, gesendet per {CHANNEL_LABELS[open.channel]} am {formatDateTime(open.sentAt)}, gültig bis {formatDayShort(open.validUntil)}
          </p>
          <div className="btn-row">
            <button className="btn btn-secondary" disabled={busy} onClick={() => run("/decide", { decision: "FREIGEGEBEN" }, "Als telefonisch freigegeben eingetragen.")}>
              Telefonisch freigegeben
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => run("/decide", { decision: "ABGELEHNT" }, "Als telefonisch abgelehnt eingetragen.")}>
              Telefonisch abgelehnt
            </button>
            <button className="btn btn-quiet" disabled={busy} onClick={() => setForm((v) => !v)}>
              {form ? "Neu senden abbrechen" : "Neu senden"}
            </button>
            <button className="btn btn-quiet" disabled={busy} onClick={() => run("/withdraw", undefined, "Der Kostenvoranschlag wurde zurückgezogen.")}>
              Zurückziehen
            </button>
          </div>
        </div>
      ) : latest ? (
        <p>
          <EstimateBadge state={latest.state} /> {money(latest.amountCents)}
          {latest.state === "FREIGEGEBEN" && latest.decidedVia ? ` (${latest.decidedVia === "KUNDENSEITE" ? "vom Kunden auf der Kundenseite" : "telefonisch erfasst"})` : ""}
          {latest.decidedAt ? <span className="muted"> am {formatDateTime(latest.decidedAt)}</span> : null}
        </p>
      ) : (
        <p className="muted">Noch kein Kostenvoranschlag gesendet.</p>
      )}
      {latest?.state === "ABGELEHNT" ? <p className="hint-box">Der Kunde hat abgelehnt. Bitte entscheiden Sie, wie es weitergeht: den Auftrag stornieren oder ohne Reparatur zurückgeben.</p> : null}
      {latest?.state === "FREIGEGEBEN" ? <p className="hint-box">Freigegeben. Sie können mit der Reparatur beginnen.</p> : null}

      <Alert message={msg?.text} kind={msg?.kind} />
      {showForm ? <EstimateForm o={o} now={clock ? toDayString(new Date(clock.now)) : toDayString(new Date())} busy={busy} replacing={!!open} onSend={(b) => run("", b, "Der Kostenvoranschlag wurde gesendet. Er steht unter Nachrichten.").then((ok) => ok && setForm(false))} /> : null}

      {o.estimates.length > 1 || (o.estimates.length === 1 && !open) ? (
        <>
          <h3>Verlauf</h3>
          <ul className="log">
            {[...o.estimates].reverse().map((e) => (
              <li key={e.version}>
                <span className="log-time">{formatDateTime(e.sentAt)}</span>
                <span>
                  Version {e.version}: <strong>{money(e.amountCents)}</strong> <EstimateBadge state={e.state} /> <span className="muted">{CHANNEL_LABELS[e.channel]}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function EstimateForm(props: { o: OrderDetail; now: string; busy: boolean; replacing: boolean; onSend: (b: unknown) => void }) {
  const { o } = props;
  const defaultChannel: EstimateChannel = o.customerEmail ? "MAIL" : "WHATSAPP";
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [valid, setValid] = useState(addDays(props.now, 7));
  const [channel, setChannel] = useState<EstimateChannel>(defaultChannel);
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  const okAmount = Number.isFinite(cents) && cents > 0;
  const to = channel === "MAIL" ? o.customerEmail : o.customerPhone;

  function submit(e: FormEvent) {
    e.preventDefault();
    props.onSend({ amountCents: cents, description: text, validUntil: valid, channel });
  }

  return (
    <form className="notify-form" onSubmit={submit}>
      <h3>{props.replacing ? "Neuen Kostenvoranschlag senden" : "Kostenvoranschlag senden"}</h3>
      <div className="inline-form">
        <label className="field">
          <span>Betrag in Euro</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="zum Beispiel 189,90" required />
        </label>
        <label className="field">
          <span>Gültig bis</span>
          <input type="date" value={valid} min={props.now} onChange={(e) => setValid(e.target.value)} required />
        </label>
      </div>
      <label className="field">
        <span>Wofür gilt der Betrag?</span>
        <textarea rows={3} value={text} maxLength={ESTIMATE_DESCRIPTION_MAX} onChange={(e) => setText(e.target.value)} placeholder="zum Beispiel: Bremsbeläge vorne ersetzen, Bremsflüssigkeit wechseln" required />
        <small className="muted">{text.length} von {ESTIMATE_DESCRIPTION_MAX} Zeichen</small>
      </label>
      <fieldset className="field">
        <legend>Wie soll der Kunde es erhalten?</legend>
        {(["MAIL", "WHATSAPP"] as const).map((c) => {
          const have = c === "MAIL" ? o.customerEmail : o.customerPhone;
          return (
            <label key={c} className="check">
              <input type="radio" name="kv-channel" checked={channel === c} disabled={!have} onChange={() => setChannel(c)} />
              <span>
                {CHANNEL_LABELS[c]} {have ? <span className="muted">an {have}</span> : <span className="muted">(nicht erfasst)</span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="muted">
        Die Nachricht enthält nur einen Link, keinen Betrag. Der Kunde sieht Betrag und Text nach Eingabe der letzten vier Ziffern seiner Telefonnummer und gibt dort frei oder lehnt ab. <span className="demo-tag">Demo</span> Es wird nichts wirklich gesendet.
      </p>
      <button className="btn btn-primary" disabled={props.busy || !okAmount || !text.trim() || !to}>
        {props.busy ? "Wird gesendet" : "Kostenvoranschlag senden"}
      </button>
    </form>
  );
}
