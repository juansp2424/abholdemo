import { useState } from "react";
import { ORDER_FILTER_LABELS } from "@abholdemo/shared";
import type { OrderFilter, OrderSummary } from "@abholdemo/shared";
import { api } from "../api";
import { formatSlot } from "../format";
import { Alert, PageHeader, StatusBadge, useDebounced, useLoad } from "../ui";

const FILTERS = Object.keys(ORDER_FILTER_LABELS) as OrderFilter[];

export function OrderList() {
  const [filter, setFilter] = useState<OrderFilter>("alle");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 250);
  const { data, error, loading } = useLoad(
    () => api<OrderSummary[]>("GET", `/api/betrieb/orders?filter=${filter}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`),
    [filter, dq]
  );

  return (
    <>
      <PageHeader title="Aufträge">
        <a className="btn btn-primary" href="#/neu">
          Neuer Auftrag
        </a>
      </PageHeader>

      <div className="chips" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f} className={`chip${filter === f ? " chip-on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {ORDER_FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Suche nach Nummer oder Name</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="zum Beispiel H7RT3K oder Beispiel" />
        <small className="muted">Das hilft Kunden, die ihre Nummer verloren haben: einfach nach dem Namen suchen.</small>
      </label>

      <Alert message={error} />
      {loading && !data ? <p className="muted">Aufträge werden geladen.</p> : null}
      {data && data.length === 0 ? <p className="empty">Keine Aufträge gefunden.</p> : null}

      <ul className="order-list">
        {data?.map((o) => (
          <li key={o.id}>
            <a className="order-row" href={`#/auftrag/${o.id}`}>
              <span className="order-code">{o.code}</span>
              <span className="order-main">
                <span className="order-item">{o.item}</span>
                <span className="muted">{o.customerName ?? "Kein Name erfasst"}</span>
                {o.slot ? <span className="order-slot">Abholzeit: {formatSlot(o.slot.start, o.slot.end)}</span> : null}
              </span>
              <span className="order-side">
                <StatusBadge status={o.status} />
                <span className="muted">{o.ageDays === 1 ? "1 Tag alt" : `${o.ageDays} Tage alt`}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
