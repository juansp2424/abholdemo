import { useState } from "react";
import { PHONE_END_LENGTH, type EstimateState, type PublicEstimate } from "@abholdemo/shared";
import { ApiFailure, decideEstimate, getEstimate } from "../api";
import { formatDate, formatEuro } from "../format";

const DONE: Partial<Record<EstimateState, string>> = {
  FREIGEGEBEN: "Sie haben den Kostenvoranschlag freigegeben. Wir beginnen mit der Reparatur.",
  ABGELEHNT: "Sie haben den Kostenvoranschlag abgelehnt. Der Betrieb meldet sich bei Ihnen.",
  ZURUECKGEZOGEN: "Der Betrieb hat den Kostenvoranschlag zurückgezogen. Bitte fragen Sie im Betrieb nach.",
  ABGELAUFEN: "Der Kostenvoranschlag ist abgelaufen. Bitte melden Sie sich beim Betrieb.",
};

/** Cost estimate (Kostenvoranschlag): amount and text only after the last phone digits; then approve or decline. */
export function EstimateSection({ code, state, onDecided }: { code: string; state: EstimateState; onDecided: () => void }) {
  const [digits, setDigits] = useState("");
  const [est, setEst] = useState<PublicEstimate | null>(null);
  const [confirm, setConfirm] = useState<"FREIGEGEBEN" | "ABGELEHNT" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = est?.state ?? state;

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (digits.replace(/\D/g, "").length !== PHONE_END_LENGTH) {
      setError(`Bitte geben Sie die letzten ${PHONE_END_LENGTH} Ziffern Ihrer Telefonnummer ein.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setEst(await getEstimate(code, digits));
    } catch (err) {
      setError((err as ApiFailure).message);
    }
    setBusy(false);
  }

  async function decide(decision: "FREIGEGEBEN" | "ABGELEHNT") {
    if (!est) return;
    setBusy(true);
    setError(null);
    try {
      setEst(await decideEstimate(code, digits, est.version, decision));
      setConfirm(null);
      onDecided();
    } catch (err) {
      setError((err as ApiFailure).message);
    }
    setBusy(false);
  }

  return (
    <section className="box" aria-labelledby="kv">
      <h2 id="kv">Kostenvoranschlag</h2>
      {shown !== "OFFEN" ? (
        <p role="status">{DONE[shown]}</p>
      ) : !est ? (
        <form onSubmit={unlock} noValidate>
          <p>Zu Ihrem Auftrag liegt ein Kostenvoranschlag vor. Zum Ansehen geben Sie bitte die letzten {PHONE_END_LENGTH} Ziffern Ihrer Telefonnummer ein.</p>
          <label htmlFor="kv-digits" className="label">Letzte {PHONE_END_LENGTH} Ziffern Ihrer Telefonnummer</label>
          <input id="kv-digits" className="field" type="text" inputMode="numeric" autoComplete="off" maxLength={PHONE_END_LENGTH + 2} value={digits} onChange={(e) => setDigits(e.target.value)} />
          {error && <p role="alert" className="alert">{error}</p>}
          <button type="submit" className="btn" disabled={busy}>Kostenvoranschlag ansehen</button>
        </form>
      ) : (
        <>
          <p className="big" aria-label={`Betrag ${formatEuro(est.amountCents)}`}>{formatEuro(est.amountCents)}</p>
          <p>{est.description}</p>
          <p className="small">Gültig bis {formatDate(est.validUntil)}. Bitte geben Sie Ihre Entscheidung bis dahin an.</p>
          {confirm ? (
            <div role="alertdialog" aria-label="Entscheidung bestätigen">
              <p className="big">{confirm === "FREIGEGEBEN" ? "Wirklich freigeben?" : "Wirklich ablehnen?"}</p>
              <p>{confirm === "FREIGEGEBEN" ? "Wir beginnen dann mit der Reparatur zu diesem Preis." : "Wir führen die Reparatur dann nicht aus. Der Betrieb meldet sich bei Ihnen."} Das lässt sich hier nicht rückgängig machen.</p>
              <div className="row">
                <button className="btn" disabled={busy} onClick={() => decide(confirm)} autoFocus>{confirm === "FREIGEGEBEN" ? "Ja, freigeben" : "Ja, ablehnen"}</button>
                <button className="btn secondary" disabled={busy} onClick={() => setConfirm(null)}>Zurück</button>
              </div>
            </div>
          ) : (
            <div className="row">
              <button className="btn" onClick={() => setConfirm("FREIGEGEBEN")}>Freigeben</button>
              <button className="btn secondary" onClick={() => setConfirm("ABGELEHNT")}>Ablehnen</button>
            </div>
          )}
          {error && <p role="alert" className="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
