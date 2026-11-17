import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CHANNEL_LABELS, QUICK_CATEGORY_MAX_COUNT, QUICK_CATEGORY_MAX_LENGTH, SLOT_LENGTH_OPTIONS, WEEKDAYS, WEEKDAY_LABELS } from "@abholdemo/shared";
import type { BusinessSettings, Channel, SlotLengthMinutes, TimeInterval, Weekday } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { resizeImage } from "../image";
import { Alert, PageHeader, useApp, useDebounced, useLoad } from "../ui";

const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];

export function Settings() {
  const { data, error } = useLoad(() => api<BusinessSettings>("GET", "/api/betrieb/settings"), []);
  return (
    <>
      <PageHeader title="Einstellungen" />
      <Alert message={error} />
      {data ? <SettingsForm initial={data} /> : error ? null : <p className="muted">Wird geladen.</p>}
    </>
  );
}

function SettingsForm({ initial }: { initial: BusinessSettings }) {
  const { refreshBusiness } = useApp();
  const [s, setS] = useState<BusinessSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const template = useDebounced(s.messageTemplate, 400);

  useEffect(() => {
    let alive = true;
    api<{ text: string }>("POST", "/api/betrieb/settings/preview", { template }).then(
      (r) => {
        if (!alive) return;
        setPreview(r.text);
        setPreviewError(null);
      },
      (e) => alive && setPreviewError(errorMessage(e))
    );
    return () => {
      alive = false;
    };
  }, [template]);

  const set = <K extends keyof BusinessSettings>(k: K, v: BusinessSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));

  function addQuick() {
    const text = newCategory.trim().replace(/\s+/g, " ");
    if (!text) return;
    if (s.quickCategories.some((c) => c.toLocaleLowerCase("de-DE") === text.toLocaleLowerCase("de-DE"))) {
      setMsg({ kind: "error", text: `"${text}" steht schon in der Schnellauswahl.` });
      return;
    }
    if (s.quickCategories.length >= QUICK_CATEGORY_MAX_COUNT) {
      setMsg({ kind: "error", text: `Die Schnellauswahl darf höchstens ${QUICK_CATEGORY_MAX_COUNT} Einträge haben.` });
      return;
    }
    setMsg(null);
    set("quickCategories", [...s.quickCategories, text]);
    setNewCategory("");
  }

  function setDay(day: Weekday, intervals: TimeInterval[]) {
    setS((cur) => ({ ...cur, openingHours: { ...cur.openingHours, [day]: intervals } }));
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    try {
      let url = await resizeImage(file, 256, "image/png");
      if (url.length > 280_000) url = await resizeImage(file, 256, "image/jpeg", 0.85);
      set("logoDataUrl", url);
    } catch (e) {
      setMsg({ kind: "error", text: errorMessage(e) });
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const saved = await api<BusinessSettings>("PUT", "/api/betrieb/settings", s);
      setS(saved);
      refreshBusiness();
      setMsg({ kind: "success", text: "Die Einstellungen wurden gespeichert." });
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings" onSubmit={save}>
      <section className="card">
        <h2>Betrieb</h2>
        <label className="field">
          <span>Name</span>
          <input value={s.name} onChange={(e) => set("name", e.target.value)} required />
        </label>
        <div className="field">
          <span>Logo</span>
          {s.logoDataUrl ? <img className="logo-preview" src={s.logoDataUrl} alt="Aktuelles Logo" /> : <small className="muted">Es ist noch kein Logo hochgeladen.</small>}
          <input type="file" accept="image/*" aria-label="Logo hochladen" onChange={(e) => onLogo(e.target.files?.[0])} />
          {s.logoDataUrl ? (
            <button type="button" className="btn btn-quiet" onClick={() => set("logoDataUrl", null)}>
              Logo entfernen
            </button>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2>Schnellauswahl für neue Aufträge</h2>
        <p className="muted">
          Das sind die Knöpfe, die beim Anlegen eines Auftrags unter dem Feld Gegenstand erscheinen. Tragen Sie ein, was in Ihrer Werkstatt oft vorkommt, zum Beispiel Ölwechsel, Reifenwechsel oder Schlauch wechseln. Am Ende auf Speichern tippen.
        </p>
        {s.quickCategories.length > 0 ? (
          <ul className="quick-list" aria-label="Aktuelle Schnellauswahl">
            {s.quickCategories.map((c) => (
              <li key={c}>
                <span>{c}</span>
                <button type="button" className="btn btn-quiet" aria-label={`${c} entfernen`} onClick={() => set("quickCategories", s.quickCategories.filter((x) => x !== c))}>
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Noch keine Einträge.</p>
        )}
        <div className="quick-add">
          <label className="field">
            <span>Neuer Eintrag</span>
            <input
              value={newCategory}
              maxLength={QUICK_CATEGORY_MAX_LENGTH}
              placeholder="zum Beispiel Bremsen wechseln"
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQuick();
                }
              }}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={addQuick}>
            Hinzufügen
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Öffnungszeiten</h2>
        {WEEKDAYS.map((d) => {
          const iv = s.openingHours[d];
          const open = iv.length > 0;
          return (
            <fieldset key={d} className="day-row">
              <legend>{WEEKDAY_LABELS[d]}</legend>
              <label className="check">
                <input type="checkbox" checked={open} onChange={(e) => setDay(d, e.target.checked ? [{ open: "09:00", close: "13:00" }] : [])} />
                <span>{open ? "Geöffnet" : "Geschlossen"}</span>
              </label>
              {iv.map((t, i) => (
                <div className="interval" key={i}>
                  <input
                    type="time"
                    aria-label={`${WEEKDAY_LABELS[d]} Zeitfenster ${i + 1} von`}
                    value={t.open}
                    onChange={(e) => setDay(d, iv.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))}
                  />
                  <span>bis</span>
                  <input
                    type="time"
                    aria-label={`${WEEKDAY_LABELS[d]} Zeitfenster ${i + 1} bis`}
                    value={t.close}
                    onChange={(e) => setDay(d, iv.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))}
                  />
                  {iv.length > 1 ? (
                    <button type="button" className="btn btn-quiet" onClick={() => setDay(d, iv.filter((_, j) => j !== i))}>
                      Entfernen
                    </button>
                  ) : null}
                </div>
              ))}
              {open && iv.length < 2 ? (
                <button type="button" className="btn btn-quiet" onClick={() => setDay(d, [...iv, { open: "14:00", close: "18:00" }])}>
                  Zweites Zeitfenster
                </button>
              ) : null}
            </fieldset>
          );
        })}
      </section>

      <section className="card">
        <h2>Abholzeiten</h2>
        <label className="field">
          <span>Länge einer Abholzeit</span>
          <select value={s.slotLengthMinutes} onChange={(e) => set("slotLengthMinutes", Number(e.target.value) as SlotLengthMinutes)}>
            {SLOT_LENGTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} Minuten
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Wie viele Kunden pro Abholzeit (1 bis 10)</span>
          <input type="number" min={1} max={10} value={s.slotCapacity} onChange={(e) => set("slotCapacity", Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Abholfrist in Tagen</span>
          <input type="number" min={1} max={60} value={s.pickupDeadlineDays} onChange={(e) => set("pickupDeadlineDays", Number(e.target.value))} />
        </label>
      </section>

      <section className="card">
        <h2>Nachrichten</h2>
        <label className="field">
          <span>Standardkanal</span>
          <select value={s.defaultChannel} onChange={(e) => set("defaultChannel", e.target.value as Channel)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Text der Abholbereit Nachricht</span>
          <textarea rows={4} value={s.messageTemplate} onChange={(e) => set("messageTemplate", e.target.value)} minLength={10} maxLength={500} />
          <small className="muted">
            Platzhalter: {"{betrieb}"} für den Namen, {"{nummer}"} für die Auftragsnummer, {"{link}"} für den Link zur Statusseite. Der Platzhalter {"{link}"} muss im Text vorkommen.
          </small>
        </label>
        <div className="preview" aria-live="polite">
          <strong>Vorschau</strong>
          <p>{preview || "Die Vorschau wird geladen."}</p>
          <Alert message={previewError} />
        </div>
      </section>

      <Alert message={msg?.text} kind={msg?.kind} />
      <button className="btn btn-primary btn-xl" disabled={saving}>
        {saving ? "Wird gespeichert" : "Speichern"}
      </button>
    </form>
  );
}
