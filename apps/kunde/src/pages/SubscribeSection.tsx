import { useState } from "react";
import { CHANNEL_LABELS, CONSENT_TEXT, type Channel, type PublicBusiness, type PublicOrderView } from "@abholdemo/shared";
import { ApiFailure, subscribe } from "../api";

const CHANNELS: Channel[] = ["MAIL", "SMS", "WHATSAPP"];

export function SubscribeSection(props: {
  web: string;
  code: string;
  business: PublicBusiness | null;
  onChange: (o: PublicOrderView) => void;
}) {
  const [channel, setChannel] = useState<Channel>(props.business?.defaultChannel ?? "MAIL");
  const [touched, setTouched] = useState(false);
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Apply the business default once it has loaded, unless the customer already chose.
  const chosen = touched ? channel : props.business?.defaultChannel ?? channel;
  const isMail = chosen === "MAIL";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      props.onChange(await subscribe(props.web, props.code, chosen, contact.trim(), consent));
    } catch (err) {
      setError((err as ApiFailure).message);
    }
    setBusy(false);
  }

  return (
    <section className="box" aria-labelledby="bescheid">
      <h2 id="bescheid">Sag mir Bescheid</h2>
      <p>Wir sagen Ihnen Bescheid, wenn Ihr Auftrag abholbereit ist.</p>
      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend>Wie möchten Sie die Nachricht bekommen?</legend>
          {CHANNELS.map((c) => (
            <label key={c} className="choice">
              <input
                type="radio"
                name="channel"
                value={c}
                checked={chosen === c}
                onChange={() => {
                  setChannel(c);
                  setTouched(true);
                  setError(null);
                }}
              />
              <span>
                {CHANNEL_LABELS[c]}
                {c === "MAIL" && <em className="tag">Empfohlen</em>}
              </span>
            </label>
          ))}
        </fieldset>
        <label htmlFor="contact" className="label">{isMail ? "Ihre E-Mail Adresse" : "Ihre Handynummer"}</label>
        <input
          id="contact"
          className="field"
          type={isMail ? "email" : "tel"}
          inputMode={isMail ? "email" : "tel"}
          autoComplete={isMail ? "email" : "tel"}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          aria-describedby={error ? "sub-error" : undefined}
        />
        <label className="choice consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{CONSENT_TEXT}</span>
        </label>
        {error && <p id="sub-error" role="alert" className="alert">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>Bescheid sagen lassen</button>
      </form>
    </section>
  );
}
