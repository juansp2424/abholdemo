import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CreateOrderRequest, OrderDetail } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { go } from "../App";
import { resizeImage } from "../image";
import { Alert, PageHeader, useApp } from "../ui";

export function NewOrder() {
  const { user, business } = useApp();
  const quick = business?.quickCategories ?? [];
  const [item, setItem] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [planned, setPlanned] = useState("");
  const [estimated, setEstimated] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<OrderDetail | null>(null);
  const itemRef = useRef<HTMLInputElement>(null);

  function reset() {
    setItem("");
    setCategory(null);
    setPhoto(null);
    setName("");
    setEmail("");
    setPhone("");
    setPlanned("");
    setEstimated("");
    setMore(false);
    setError(null);
    setSaved(null);
    setTimeout(() => itemRef.current?.focus(), 0);
  }

  function addCategory(c: string) {
    setCategory(c);
    setItem((cur) => {
      const t = cur.trim();
      if (!t) return c;
      if (t.includes(c)) return cur;
      return `${t}, ${c}`;
    });
    itemRef.current?.focus();
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await resizeImage(file, 1024, "image/jpeg", 0.8));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = item.trim();
    if (!text) {
      setError("Bitte geben Sie an, was repariert wird.");
      itemRef.current?.focus();
      return;
    }
    if (!phone.trim()) {
      setError("Bitte geben Sie die Telefonnummer des Kunden an.");
      return;
    }
    setBusy(true);
    setError(null);
    const body: CreateOrderRequest = {
      item: text,
      category: category && text.includes(category) ? category : null,
      photoDataUrl: photo,
      customerName: name.trim() || null,
      customerEmail: email.trim() || null,
      customerPhone: phone.trim(),
      plannedPickupDate: planned || null,
      estimatedCompletion: estimated || null,
    };
    try {
      setSaved(await api<OrderDetail>("POST", "/api/betrieb/orders", body));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <>
        <PageHeader title="Auftrag gespeichert" />
        <section className="card saved" aria-live="polite">
          <p className="saved-lead">Bitte auf den Anhänger schreiben</p>
          <div className="huge-code" aria-label={`Auftragsnummer ${saved.code.split("").join(" ")}`}>
            {saved.code}
          </div>
          <p className="saved-item">{saved.item}</p>
          <p className="muted">Der Statuslink wurde {saved.customerEmail ? "per Mail" : "per SMS"} vorbereitet (Demo, es wird nichts versendet).</p>
          <div className="btn-row">
            <button className="btn btn-primary btn-xl" onClick={reset} autoFocus>
              Nächster Auftrag
            </button>
            <button className="btn btn-secondary btn-xl" onClick={() => go(`/auftrag/${saved.id}`)}>
              Zum Auftrag
            </button>
            <button className="btn btn-secondary btn-xl" onClick={() => go(`/anhaenger/${saved.id}`)}>
              Anhänger drucken
            </button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Neuer Auftrag" />
      <form className="card form" onSubmit={submit}>
        <Alert message={error} />
        <label className="field">
          <span>Gegenstand (Pflichtfeld)</span>
          <input
            ref={itemRef}
            className="input-big"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder="zum Beispiel Auto, Ölwechsel"
            aria-required="true"
          />
        </label>
        {quick.length > 0 ? (
          <div className="chips" role="group" aria-label="Schnellauswahl">
            {quick.map((c) => (
              <button type="button" key={c} className="chip" onClick={() => addCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted quick-empty">
            Noch keine Schnellauswahl angelegt.{" "}
            {user.role === "INHABER" ? (
              <a href="#/einstellungen">Schnellauswahl in den Einstellungen anlegen</a>
            ) : (
              "Der Inhaber kann sie in den Einstellungen anlegen."
            )}
          </p>
        )}

        <label className="field">
          <span>Telefonnummer (Pflichtfeld)</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="off"
            placeholder="zum Beispiel +49 151 00000012"
            aria-required="true"
          />
          <small className="muted">Damit können Sie dem Kunden Bescheid sagen, wenn sich eine Reparatur verzögert.</small>
        </label>

        <button type="button" className="btn btn-secondary" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? "Weniger Angaben" : "Mehr Angaben"}
        </button>

        {more ? (
          <div className="more">
            <div className="field">
              <span>Foto</span>
              <input type="file" accept="image/*" capture="environment" aria-label="Foto aufnehmen" onChange={(e) => onPhoto(e.target.files?.[0])} />
              {photo ? (
                <div className="photo-preview">
                  <img src={photo} alt="Vorschau des Fotos" />
                  <button type="button" className="btn btn-quiet" onClick={() => setPhoto(null)}>
                    Foto entfernen
                  </button>
                </div>
              ) : null}
            </div>
            <label className="field">
              <span>Kundenname</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="zum Beispiel Petra Beispiel" />
            </label>
            <label className="field">
              <span>Mailadresse</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="zum Beispiel petra@beispiel.de" />
              <small className="muted">Mit Mailadresse bekommt der Kunde den Statuslink.</small>
            </label>
            <label className="field">
              <span>Geplantes Abholdatum</span>
              <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} />
            </label>
            <label className="field">
              <span>Voraussichtliche Fertigstellung</span>
              <input type="date" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
            </label>
          </div>
        ) : null}

        <button className="btn btn-primary btn-xl" disabled={busy}>
          {busy ? "Wird gespeichert" : "Speichern"}
        </button>
      </form>
    </>
  );
}
