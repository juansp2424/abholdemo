import { useCallback, useEffect, useState } from "react";
import type { PublicOrderView, PublicSlotsResponse } from "@abholdemo/shared";
import { ApiFailure, bookSlot, cancelSlot, getSlots } from "../api";
import { dayHeading, formatRange, formatTime } from "../format";

export function SlotSection(props: {
  web: string;
  code: string;
  order: PublicOrderView;
  onChange: (o: PublicOrderView) => void;
}) {
  const { web, code, order, onChange } = props;
  const [slots, setSlots] = useState<PublicSlotsResponse | null>(null);
  const [picking, setPicking] = useState(!order.slot);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSlots(await getSlots(web, code));
    } catch (e) {
      setError((e as ApiFailure).message);
    }
  }, [web, code]);

  useEffect(() => {
    if (picking) void load();
  }, [picking, load]);

  async function book(start: string) {
    setBusy(true);
    setError(null);
    try {
      onChange(await bookSlot(web, code, start));
      setPicking(false);
    } catch (e) {
      setError((e as ApiFailure).message);
      await load();
    }
    setBusy(false);
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      onChange(await cancelSlot(web, code));
      setPicking(true);
    } catch (e) {
      setError((e as ApiFailure).message);
    }
    setBusy(false);
  }

  const hasSlots = !!slots && slots.days.some((d) => d.slots.length > 0);

  return (
    <section className="box" aria-labelledby="abholzeit">
      <h2 id="abholzeit">Abholzeit wählen</h2>
      {order.slot && !picking && (
        <div className="confirm" role="status">
          <p className="big">Ihre Abholzeit: {formatRange(order.slot)}</p>
          <div className="row">
            <button className="btn secondary" onClick={() => setPicking(true)} disabled={busy}>Andere Zeit wählen</button>
            <button className="btn secondary" onClick={cancel} disabled={busy}>Abholzeit absagen</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="alert">{error}</p>}
      {picking && (
        <div>
          {order.slot && <p>Ihre jetzige Abholzeit: {formatRange(order.slot)}. Wenn Sie eine neue Zeit wählen, ersetzt sie die alte.</p>}
          {!slots && !error && <p>Einen Moment bitte.</p>}
          {slots && !hasSlots && (
            <p>Gerade sind keine Abholzeiten frei. Sie können trotzdem während der Öffnungszeiten vorbeikommen.</p>
          )}
          {slots?.days.filter((d) => d.slots.length > 0).map((d) => (
            <div key={d.date}>
              <h3>{dayHeading(d.date)}</h3>
              <div className="slots">
                {d.slots.map((s) => (
                  <button
                    key={s.start}
                    className="slot"
                    disabled={busy}
                    aria-label={`${dayHeading(d.date)}, ${formatTime(s.start)} bis ${formatTime(s.end)}`}
                    onClick={() => book(s.start)}
                  >
                    {formatTime(s.start)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {order.slot && (
            <button className="btn secondary" onClick={() => { setPicking(false); setError(null); }}>Abbrechen</button>
          )}
        </div>
      )}
    </section>
  );
}
