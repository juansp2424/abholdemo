import type { OrderDetail } from "@abholdemo/shared";
import { centralUrl } from "@abholdemo/shared";
import { api } from "../api";
import { Alert, PageHeader, useApp, useLoad } from "../ui";
import { useQr } from "../useQr";

/** Printable tag for one order: QR code to the central page with the code, plus the code itself. */
export function Tag({ id }: { id: string }) {
  const { business } = useApp();
  const { data, error } = useLoad(() => api<OrderDetail>("GET", `/api/betrieb/orders/${encodeURIComponent(id)}`), [id]);
  const { qr, qrError } = useQr(data?.statusUrl ?? null);
  const host = centralUrl().replace(/^https?:\/\//, "");

  return (
    <>
      <PageHeader title="Anhänger">
        <button className="btn btn-primary" disabled={!data || !qr} onClick={() => window.print()}>
          Drucken
        </button>
      </PageHeader>
      <p className="muted no-print">Ausdrucken, ausschneiden und an das Fahrzeug oder Fahrrad hängen. Der Kunde scannt den Code und ist sofort bei seinem Auftrag, ohne Nummer einzutippen.</p>
      <Alert message={error ?? qrError} />
      {data ? (
        <div className="tag-card" aria-label="Druckvorlage Anhänger">
          {qr ? <img className="tag-qr" src={qr} alt={`QR Code zu ${data.statusUrl}`} /> : <div className="tag-qr" />}
          <div className="tag-text">
            {business ? <p className="tag-biz">{business.name}</p> : null}
            <p className="tag-label">Auftragsnummer</p>
            <p className="tag-code">{data.code}</p>
            <p className="tag-hint">Stand ansehen und Abholzeit wählen: Code scannen oder {host} öffnen und die Nummer eingeben.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
