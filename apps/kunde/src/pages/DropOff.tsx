import { useEffect, useState } from "react";
import { CHANNEL_LABELS, CHANNELS_ALL, type Channel, type PublicAppointment, type PublicBusiness, type PublicDropOffInfo, type PublicSlotDay } from "@abholdemo/shared";
import { ApiFailure, bookDropOff, cancelAppointment, getAppointment, getAppointmentSlots, getBusiness, getDropOff, rebookAppointment } from "../api";
import { Link, navigate } from "../App";
import { dayHeading, formatRange, formatTime } from "../format";

const OTHER = "__other__";
const DROPOFF_PRIVACY =
  "Dies ist eine Demo. Wir speichern Name, Telefonnummer und, wenn angegeben, Ihre Mailadresse nur für diesen Termin. Kommt kein Auftrag zustande, werden die Angaben später gelöscht. Keine Werbung, keine Weitergabe.";

/** Free windows: first a day, then a time of that day (keeps the page short over 14 days). */
export function WindowPicker({ days, value, onPick }: { days: PublicSlotDay[]; value: string | null; onPick: (start: string) => void }) {
  const [day, setDay] = useState<string | null>(null);
  if (days.length === 0) return <p>Gerade ist kein Termin frei. Bitte rufen Sie den Betrieb an.</p>;
  const current = days.find((d) => d.date === day) ?? days[0];
  return (
    <>
      <div className="days" role="group" aria-label="Tag wählen">
        {days.map((d) => (
          <button type="button" key={d.date} className={`day${d.date === current.date ? " on" : ""}`} aria-pressed={d.date === current.date} onClick={() => setDay(d.date)}>
            {shortDay(d.date)}
          </button>
        ))}
      </div>
      <h3>{dayHeading(current.date)}</h3>
      <div className="slots">
        {current.slots.map((s) => (
          <button
            type="button"
            key={s.start}
            className={`slot${value === s.start ? " on" : ""}`}
            aria-pressed={value === s.start}
            aria-label={`${dayHeading(current.date)}, ${formatTime(s.start)} bis ${formatTime(s.end)}`}
            onClick={() => onPick(s.start)}
          >
            {formatTime(s.start)}
          </button>
        ))}
      </div>
    </>
  );
}

const shortFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
const shortDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return shortFmt.format(new Date(y, m - 1, d, 12));
};

/** /b/{webname}/termin: book a drop-off appointment. */
export function DropOffPage({ web }: { web: string }) {
  const [biz, setBiz] = useState<PublicBusiness | null>(null);
  const [info, setInfo] = useState<PublicDropOffInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [otherService, setOtherService] = useState("");
  const [item, setItem] = useState("");
  const [start, setStart] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<Channel>("SMS");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBusiness(web).then(setBiz, (e: ApiFailure) => setLoadError(e.message));
    getDropOff(web).then(setInfo, (e: ApiFailure) => setLoadError(e.message));
  }, [web]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = service === OTHER ? otherService.trim() : service;
    if (!chosen) return setError("Bitte wählen Sie, was gemacht werden soll.");
    if (!start) return setError("Bitte wählen Sie einen Termin.");
    setBusy(true);
    setError(null);
    try {
      const a = await bookDropOff(web, { start, service: chosen, item, customerName: name, customerPhone: phone, customerEmail: email || null, channel, website });
      navigate(`/termin/${encodeURIComponent(a.token)}?neu=1`);
    } catch (err) {
      setError((err as ApiFailure).message);
      setBusy(false);
    }
  }

  if (loadError) return <main className="page"><p role="alert" className="alert">{loadError}</p></main>;
  if (!info || !biz) return <main className="page"><p>Einen Moment bitte.</p></main>;
  if (!info.enabled) {
    return (
      <main className="page">
        <p className="biz">{biz.name}</p>
        <h1>Termin zum Abgeben</h1>
        <p>Dieser Betrieb bietet gerade keine Termine online an. Bitte rufen Sie an oder kommen Sie vorbei.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <p className="biz">{biz.name}</p>
      <h1>Termin zum Abgeben</h1>
      <p>Buchen Sie hier, wann Sie Ihr Fahrzeug oder Fahrrad bringen. Sie brauchen kein Konto.</p>
      <form onSubmit={submit} noValidate className="dropoff">
        <section className="box" aria-labelledby="dl-what">
          <h2 id="dl-what">1. Was soll gemacht werden?</h2>
          <fieldset>
            <legend className="sr-only">Leistung</legend>
            {[...info.services, OTHER].map((s) => (
              <label key={s} className="choice">
                <input type="radio" name="service" checked={service === s} onChange={() => setService(s)} />
                <span>{s === OTHER ? "Etwas anderes" : s}</span>
              </label>
            ))}
          </fieldset>
          {service === OTHER && (
            <>
              <label htmlFor="dl-other" className="label">Was genau?</label>
              <input id="dl-other" className="field" value={otherService} maxLength={60} onChange={(e) => setOtherService(e.target.value)} placeholder="zum Beispiel Bremsen prüfen" />
            </>
          )}
          <label htmlFor="dl-item" className="label">Was bringen Sie?</label>
          <input id="dl-item" className="field" value={item} maxLength={120} onChange={(e) => setItem(e.target.value)} placeholder="zum Beispiel Auto, VW Golf" />
        </section>

        <section className="box" aria-labelledby="dl-when">
          <h2 id="dl-when">2. Wann bringen Sie es?</h2>
          <WindowPicker days={info.days} value={start} onPick={setStart} />
        </section>

        <section className="box" aria-labelledby="dl-who">
          <h2 id="dl-who">3. Ihre Angaben</h2>
          <label htmlFor="dl-name" className="label">Ihr Name</label>
          <input id="dl-name" className="field" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="dl-phone" className="label">Ihre Handynummer</label>
          <input id="dl-phone" className="field" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label htmlFor="dl-mail" className="label">Ihre E-Mail Adresse (freiwillig)</label>
          <input id="dl-mail" className="field" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <fieldset>
            <legend>Wie bekommen Sie die Bestätigung?</legend>
            {CHANNELS_ALL.map((c) => (
              <label key={c} className="choice">
                <input type="radio" name="dl-channel" checked={channel === c} onChange={() => setChannel(c)} />
                <span>{CHANNEL_LABELS[c]}{c === "MAIL" && !email ? " (bitte oben die Mailadresse eintragen)" : ""}</span>
              </label>
            ))}
          </fieldset>
          <div className="trap" aria-hidden="true">
            <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>
          <p className="small">{DROPOFF_PRIVACY}</p>
        </section>

        {error && <p role="alert" className="alert">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Einen Moment bitte" : "Termin buchen"}</button>
      </form>
    </main>
  );
}

/** /termin/{token}: see, cancel or move the appointment. */
export function AppointmentPage({ token, fresh }: { token: string; fresh: boolean }) {
  const [a, setA] = useState<PublicAppointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [days, setDays] = useState<PublicSlotDay[] | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(fresh ? "Ihr Termin ist gebucht. Sie bekommen gleich eine Bestätigung." : null);

  useEffect(() => {
    getAppointment(token).then(setA, (e: ApiFailure) => setError(e.message));
  }, [token]);

  async function run(fn: () => Promise<PublicAppointment>, done: string) {
    setBusy(true);
    setActionError(null);
    try {
      setA(await fn());
      setNote(done);
      setDays(null);
      setConfirmCancel(false);
    } catch (e) {
      setActionError((e as ApiFailure).message);
    }
    setBusy(false);
  }

  if (error) return <main className="page"><p role="alert" className="alert">{error}</p><Link to="/" className="btn">Zur Startseite</Link></main>;
  if (!a) return <main className="page"><p>Einen Moment bitte.</p></main>;
  const cancelled = a.state === "ABGESAGT_KUNDE" || a.state === "ABGESAGT_BETRIEB";

  return (
    <main className="page">
      <p className="biz">{a.businessName}</p>
      <section className="status" aria-labelledby="tm">
        <p className="small">Termin zum Abgeben</p>
        <h1 id="tm" className="status-label">{cancelled ? "Abgesagt" : a.state === "ERSCHIENEN" ? "Abgegeben" : a.state === "NICHT_ERSCHIENEN" ? "Verpasst" : "Gebucht"}</h1>
        <dl className="facts">
          <dt>Wann</dt>
          <dd>{formatRange(a)}</dd>
          <dt>Was</dt>
          <dd>{a.service}</dd>
          <dd className="small">{a.item}</dd>
        </dl>
      </section>
      {note && <p role="status" className="box ok">{note}</p>}
      {a.state === "ABGESAGT_BETRIEB" && <p className="box warn">Der Betrieb musste den Termin absagen. Bitte buchen Sie einen neuen.</p>}
      {a.orderCode && (
        <section className="box">
          <p>Ihr Auftrag hat die Nummer <strong>{a.orderCode}</strong>.</p>
          <Link to={`/a/${encodeURIComponent(a.orderCode)}`} className="btn">Stand des Auftrags ansehen</Link>
        </section>
      )}
      {(cancelled || a.state === "NICHT_ERSCHIENEN") && <Link to={`/b/${encodeURIComponent(a.webname)}/termin`} className="btn">Neuen Termin buchen</Link>}

      {a.changeable && !days && !confirmCancel && (
        <div className="row">
          <button className="btn secondary" disabled={busy} onClick={() => getAppointmentSlots(token).then((r) => setDays(r.days), (e: ApiFailure) => setActionError(e.message))}>Termin ändern</button>
          <button className="btn secondary" disabled={busy} onClick={() => setConfirmCancel(true)}>Termin absagen</button>
        </div>
      )}
      {confirmCancel && (
        <section className="box warn" role="alertdialog" aria-label="Absage bestätigen">
          <p className="big">Termin wirklich absagen?</p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => run(() => cancelAppointment(token), "Ihr Termin ist abgesagt.")} autoFocus>Ja, absagen</button>
            <button className="btn secondary" onClick={() => setConfirmCancel(false)}>Zurück</button>
          </div>
        </section>
      )}
      {days && (
        <section className="box" aria-labelledby="neu">
          <h2 id="neu">Neuen Termin wählen</h2>
          <WindowPicker days={days} value={null} onPick={(s) => run(() => rebookAppointment(token, s), "Ihr Termin ist geändert. Sie bekommen eine Bestätigung.")} />
          <button className="btn secondary" onClick={() => setDays(null)}>Abbrechen</button>
        </section>
      )}
      {actionError && <p role="alert" className="alert">{actionError}</p>}
    </main>
  );
}
