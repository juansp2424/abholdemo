import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { businessUrl } from "@abholdemo/shared";
import { PageHeader, useApp } from "../ui";

const STEPS = ["Nummer vom Anhänger eingeben", "Status sehen", "Bescheid sagen lassen"];

export function Poster() {
  const { business } = useApp();
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const url = business ? businessUrl(business.webname) : null;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    QRCode.toDataURL(url, { width: 900, margin: 1, errorCorrectionLevel: "M" }).then(
      (d) => alive && setQr(d),
      () => alive && setQrError("Der QR Code konnte nicht erstellt werden.")
    );
    return () => {
      alive = false;
    };
  }, [url]);

  if (!business || !url) return <p className="muted">Wird geladen.</p>;

  return (
    <>
      <PageHeader title="Aufsteller">
        <button className="btn btn-primary" onClick={() => window.print()}>
          Drucken
        </button>
      </PageHeader>
      <p className="muted no-print">
        Diese Vorlage im Format A5 aufstellen oder an die Theke hängen. Kunden scannen den Code und geben ihre Nummer ein. Webname: <strong>{business.webname}</strong>
      </p>
      {qrError ? (
        <div className="alert alert-error" role="alert">
          {qrError}
        </div>
      ) : null}

      <div className="poster-wrap">
        <section className="poster" aria-label="Druckvorlage A5">
          {business.logoDataUrl ? <img className="poster-logo" src={business.logoDataUrl} alt="" /> : null}
          <h2 className="poster-name">{business.name}</h2>
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
          <p className="poster-web">{business.webname}</p>
        </section>
      </div>
    </>
  );
}
