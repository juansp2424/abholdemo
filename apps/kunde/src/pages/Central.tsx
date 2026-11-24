import { useEffect, useRef, useState } from "react";
import { PHONE_END_LENGTH, normalizeCode, type CentralOrderView } from "@abholdemo/shared";
import { ApiFailure, getCentral, getDropOffBusinesses, lookupOrder } from "../api";
import { Link, navigate } from "../App";
import { FALLBACK_HINT } from "../texts";
import { StatusPage } from "./StatusPage";

/** One address for every business: the code (and the end of the phone number) finds the right business. */
export function CentralStart() {
  const [code, setCode] = useState("");
  const [phoneEnd, setPhoneEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const [dropOff, setDropOff] = useState<{ name: string; webname: string }[]>([]);
  useEffect(() => {
    getDropOffBusinesses().then(setDropOff, () => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = normalizeCode(code);
    if (!c) {
      setError("Bitte geben Sie Ihre Auftragsnummer ein.");
      codeInput.current?.focus();
      return;
    }
    if (phoneEnd.replace(/\D/g, "").length !== PHONE_END_LENGTH) {
      setError(`Bitte geben Sie die letzten ${PHONE_END_LENGTH} Ziffern Ihrer Telefonnummer ein.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await lookupOrder(c, phoneEnd);
      navigate(`/a/${encodeURIComponent(r.code)}`);
    } catch (err) {
      setError((err as ApiFailure).message);
      setBusy(false);
      codeInput.current?.focus();
    }
  }

  return (
    <main className="page">
      <h1>Auftrag abholen</h1>
      <p>Hier sehen Sie den Stand Ihres Auftrags und wählen Ihre Abholzeit. Sie brauchen kein Konto.</p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="code" className="label">Auftragsnummer</label>
        <input
          id="code"
          ref={codeInput}
          className="code-input"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-describedby={error ? "lookup-error" : undefined}
        />
        <label htmlFor="phone-end" className="label">Letzte {PHONE_END_LENGTH} Ziffern Ihrer Telefonnummer</label>
        <input
          id="phone-end"
          className="field"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PHONE_END_LENGTH + 2}
          value={phoneEnd}
          onChange={(e) => setPhoneEnd(e.target.value)}
        />
        <p className="small">Das schützt Ihren Auftrag. Es ist die Telefonnummer, die Sie bei der Annahme genannt haben.</p>
        {error && <p id="lookup-error" role="alert" className="alert">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Einen Moment bitte" : "Status ansehen"}</button>
      </form>
      <section aria-labelledby="how">
        <h2 id="how">So geht es</h2>
        <ol className="steps">
          <li>Scannen Sie den Code auf Ihrem Anhänger. Dann sind Sie sofort bei Ihrem Auftrag.</li>
          <li>Oder geben Sie die Nummer vom Anhänger und die vier Ziffern hier ein.</li>
          <li>Tippen Sie auf "Status ansehen". Sie sehen den Betrieb und den Stand.</li>
        </ol>
      </section>
      {dropOff.length > 0 && (
        <section className="box" aria-labelledby="tb">
          <h2 id="tb">Noch nicht abgegeben?</h2>
          <p>Buchen Sie online einen Termin, an dem Sie Ihr Fahrzeug oder Fahrrad bringen.</p>
          {dropOff.map((b) => (
            <Link key={b.webname} to={`/b/${encodeURIComponent(b.webname)}/termin`} className="btn secondary">
              {dropOff.length === 1 ? "Termin zum Abgeben buchen" : `${b.name}: Termin buchen`}
            </Link>
          ))}
        </section>
      )}
      <p className="hint">{FALLBACK_HINT}</p>
    </main>
  );
}

/** /a/{code}: finds the business by the code alone (links from messages and the QR code on the tag), then shows its status page. */
export function CentralStatus({ code, abmelden }: { code: string; abmelden: boolean }) {
  const [view, setView] = useState<CentralOrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCentral(code).then(setView, (e: ApiFailure) => setError(e.message));
  }, [code]);

  if (error) {
    return (
      <main className="page">
        <p role="alert" className="alert">{error}</p>
        <Link to="/" className="btn">Zurück zur Startseite</Link>
      </main>
    );
  }
  if (!view) return <main className="page"><p>Einen Moment bitte.</p></main>;
  return <StatusPage web={view.business.webname} code={view.order.code} abmelden={abmelden} central />;
}
