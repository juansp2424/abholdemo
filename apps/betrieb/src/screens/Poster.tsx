import { useState } from "react";
import { PageHeader, useApp } from "../ui";
import { useQr } from "../useQr";

const STEPS = ["Nummer vom Anhänger eingeben", "Status sehen", "Bescheid sagen lassen"];

export function Poster() {
  const { business } = useApp();
  // One central address for all businesses: the same stand can be printed once for every business.
  const [general, setGeneral] = useState(true);
  const url = business?.customerUrl ?? null;
  const { qr, qrError } = useQr(url);

  if (!business || !url) return <p className="muted">Wird geladen.</p>;

  return (
    <>
      <PageHeader title="Aufsteller">
        <button className="btn btn-primary" onClick={() => window.print()}>
          Drucken
        </button>
      </PageHeader>
      <p className="muted no-print">
        Diese Vorlage im Format A5 aufstellen oder an die Theke hängen. Kunden scannen den Code und kommen auf die zentrale Seite, dort geben sie ihre Nummer ein. Der QR Code ist für alle Betriebe derselbe.
      </p>
      <label className="check no-print">
        <input type="checkbox" checked={general} onChange={(e) => setGeneral(e.target.checked)} />
        <span>Allgemeine Version, ohne Betriebsname (gleicher Aufsteller für alle Betriebe)</span>
      </label>
      {qrError ? (
        <div className="alert alert-error" role="alert">
          {qrError}
        </div>
      ) : null}

      <div className="poster-wrap">
        <section className="poster" aria-label="Druckvorlage A5">
          {!general && business.logoDataUrl ? <img className="poster-logo" src={business.logoDataUrl} alt="" /> : null}
          <h2 className="poster-name">{general ? "Abholstatus" : business.name}</h2>
          <p className="poster-lead">Wo ist mein Auftrag?</p>
          {qr ? <img className="poster-qr" src={qr} alt={`QR Code zu ${url}`} /> : <div className="poster-qr" />}
          <ol className="poster-steps">
            {STEPS.map((s, i) => (
              <li key={s}>
                <span className="poster-num">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="poster-url">{url}</p>
        </section>
      </div>
    </>
  );
}
