import { useEffect, useState } from "react";
import { CHANNEL_LABELS, type PublicBusiness, type PublicOrderView } from "@abholdemo/shared";
import { ApiFailure, getBusiness, getOrder, unsubscribe } from "../api";
import { Link } from "../App";
import { formatDate, formatRange } from "../format";
import { FALLBACK_HINT, PRIVACY_TEXT } from "../texts";
import { SlotSection } from "./SlotSection";
import { SubscribeSection } from "./SubscribeSection";

export function StatusPage({ web, code, abmelden }: { web: string; code: string; abmelden: boolean }) {
  const [biz, setBiz] = useState<PublicBusiness | null>(null);
  const [order, setOrder] = useState<PublicOrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAbmelden, setShowAbmelden] = useState(abmelden);
  const [unsubDone, setUnsubDone] = useState(false);
  const [unsubError, setUnsubError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startLink = `/b/${encodeURIComponent(web)}`;

  useEffect(() => {
    getBusiness(web).then(setBiz, () => undefined);
    getOrder(web, code).then(setOrder, (e: ApiFailure) => setError(e.message));
  }, [web, code]);

  async function doUnsubscribe() {
    setBusy(true);
    setUnsubError(null);
    try {
      setOrder(await unsubscribe(web, code));
      setUnsubDone(true);
      setShowAbmelden(false);
    } catch (e) {
      setUnsubError((e as ApiFailure).message);
    }
    setBusy(false);
  }

  if (error) {
    return (
      <main className="page">
        <p role="alert" className="alert">{error}</p>
        <Link to={startLink} className="btn">Zurück zur Startseite</Link>
      </main>
    );
  }
  if (!order) return <main className="page"><p>Einen Moment bitte.</p></main>;

  const pickup = order.slot ? formatRange(order.slot) : order.plannedPickupDate ? formatDate(order.plannedPickupDate) : null;
  const via = order.notifyChannel ? ` per ${CHANNEL_LABELS[order.notifyChannel]}` : "";
  const isFinal = order.status === "ABGEHOLT" || order.status === "STORNIERT";

  return (
    <main className="page">
      {biz && <p className="biz">{biz.name}</p>}
      {showAbmelden && order.notifyActive && (
        <section className="box warn" aria-labelledby="abm">
          <h2 id="abm">Möchten Sie keine Nachricht mehr bekommen?</h2>
          <button className="btn" onClick={doUnsubscribe} disabled={busy}>Ja, keine Nachricht mehr</button>
          {unsubError && <p role="alert" className="alert">{unsubError}</p>}
        </section>
      )}
      {showAbmelden && !order.notifyActive && !unsubDone && (
        <section className="box" role="status">
          <p>Für diesen Auftrag ist keine Nachricht eingerichtet.</p>
        </section>
      )}
      {unsubDone && (
        <section className="box ok" role="status">
          <p>Erledigt. Sie bekommen keine Nachricht mehr zu diesem Auftrag.</p>
        </section>
      )}

      <section aria-labelledby="st" className="status">
        <p className="small">Auftrag {order.code}</p>
        <h1 id="st" className="status-label">{order.statusLabel}</h1>
        <p className="status-text">{order.statusText}</p>
        <dl className="facts">
          {pickup && (
            <>
              <dt>{order.slot ? "Ihre Abholzeit" : "Geplante Abholung"}</dt>
              <dd>{pickup}</dd>
            </>
          )}
          {order.estimatedCompletion && (
            <>
              <dt>Voraussichtlich fertig</dt>
              <dd>{formatDate(order.estimatedCompletion)}</dd>
            </>
          )}
        </dl>
        {!isFinal && (
          <p>
            {order.slotBookingOpen || order.pickupDeadline
              ? `Bitte holen Sie Ihren Auftrag innerhalb von ${order.pickupDeadlineDays} Tagen ab${
                  order.pickupDeadline ? `, bis ${formatDate(order.pickupDeadline)}` : ""
                }.`
              : `Nach der Fertigstellung haben Sie ${order.pickupDeadlineDays} Tage Zeit zum Abholen.`}
          </p>
        )}
      </section>

      {order.canSubscribe && <SubscribeSection web={web} code={code} business={biz} onChange={setOrder} />}

      {order.notifyActive && !isFinal && (
        <section className="box" aria-labelledby="notif">
          <h2 id="notif">Nachricht eingerichtet</h2>
          <p>
            {order.slotBookingOpen
              ? `Wir haben Ihnen${via} Bescheid gesagt.`
              : `Wir sagen Ihnen Bescheid${via}.`}
          </p>
          <button className="btn secondary" onClick={doUnsubscribe} disabled={busy}>Benachrichtigung abbestellen</button>
          {unsubError && !showAbmelden && <p role="alert" className="alert">{unsubError}</p>}
        </section>
      )}

      {order.slotBookingOpen && <SlotSection web={web} code={code} order={order} onChange={setOrder} />}

      <p className="hint">{FALLBACK_HINT}</p>
      <section className="privacy" aria-labelledby="dsh">
        <h2 id="dsh">Datenschutz (Demo)</h2>
        <p>{PRIVACY_TEXT}</p>
      </section>
      <p><Link to={startLink}>Andere Auftragsnummer eingeben</Link></p>
    </main>
  );
}
