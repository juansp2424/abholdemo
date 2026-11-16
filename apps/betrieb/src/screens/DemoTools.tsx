import { useState } from "react";
import type { AdvanceTimeResponse, DemoClock } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { formatDateTime } from "../format";
import { Alert, PageHeader, useApp } from "../ui";

// Survives the remount that follows a reset (screens reload their data).
let pendingNotice: string | null = null;

export function DemoTools() {
  const { clock, refreshClock, reloadAll } = useApp();
  const [days, setDays] = useState(3);
  const [result, setResult] = useState<AdvanceTimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(() => {
    const n = pendingNotice;
    pendingNotice = null;
    return n;
  });
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function advance() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      setResult(await api<AdvanceTimeResponse>("POST", "/api/demo/advance", { days }));
      refreshClock();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await api<DemoClock>("POST", "/api/demo/reset");
      setResult(null);
      setConfirmReset(false);
      pendingNotice = "Die Demodaten wurden zurückgesetzt.";
      reloadAll();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Demo Werkzeuge" />
      <div className="demo-banner" role="note">
        DEMO: Diese Werkzeuge gibt es nur in der Demo
      </div>

      <section className="card">
        <h2>Aktuelle Demozeit</h2>
        <p className="slot-big">{clock ? formatDateTime(clock.now) : "Wird geladen"}</p>
        {clock ? <p className="muted">{clock.offsetDays === 1 ? "1 Tag vorgespult" : `${clock.offsetDays} Tage vorgespult`}</p> : null}
      </section>

      <Alert message={error} />
      <Alert message={ok} kind="success" />

      <section className="card">
        <h2>Zeit vorspulen</h2>
        <p className="muted">So sehen Sie, was nach Ablauf der Abholfrist passiert: Aufträge werden überfällig und Erinnerungen entstehen.</p>
        <div className="inline-form">
          <label className="field field-inline">
            <span>Tage</span>
            <input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </label>
          <button className="btn btn-primary" disabled={busy} onClick={advance}>
            Zeit vorspulen
          </button>
        </div>
        {result ? (
          <div className="alert alert-success" role="status">
            <p>
              Neu überfällig: {result.newlyOverdue.length > 0 ? result.newlyOverdue.join(", ") : "keine Aufträge"} ({result.newlyOverdue.length})
            </p>
            <p>Erinnerungen erstellt: {result.remindersCreated}</p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>Demodaten zurücksetzen</h2>
        <p className="muted">Alle Aufträge, Nachrichten und Einstellungen gehen auf den Anfangszustand zurück.</p>
        {confirmReset ? (
          <div className="confirm" role="alertdialog" aria-label="Zurücksetzen bestätigen">
            <p>Wirklich alles zurücksetzen? Eigene Aufträge gehen dabei verloren.</p>
            <div className="btn-row">
              <button className="btn btn-danger" disabled={busy} onClick={reset} autoFocus>
                Ja, zurücksetzen
              </button>
              <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            Demodaten zurücksetzen
          </button>
        )}
      </section>
    </>
  );
}
