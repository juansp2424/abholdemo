import { useEffect, useRef, useState } from "react";
import { normalizeCode, type PublicBusiness } from "@abholdemo/shared";
import { ApiFailure, getBusiness, getOrder } from "../api";
import { navigate } from "../App";
import { FALLBACK_HINT } from "../texts";

export function StartPage({ web }: { web: string }) {
  const [biz, setBiz] = useState<PublicBusiness | null>(null);
  const [bizError, setBizError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getBusiness(web).then(setBiz, (e: ApiFailure) => setBizError(e.message));
  }, [web]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(value);
    if (!code) {
      setError("Bitte geben Sie Ihre Auftragsnummer ein.");
      input.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getOrder(web, code);
      navigate(`/b/${encodeURIComponent(web)}/a/${encodeURIComponent(code)}`);
    } catch (err) {
      setError((err as ApiFailure).message);
      setBusy(false);
      input.current?.focus();
    }
  }

  if (bizError) {
    return (
      <main className="page">
        <p role="alert" className="alert">{bizError}</p>
      </main>
    );
  }
  if (!biz) {
    return <main className="page"><p>Einen Moment bitte.</p></main>;
  }
  return (
    <main className="page">
      <header className="brand">
        {biz.logoDataUrl && <img src={biz.logoDataUrl} alt="" className="logo" />}
        <h1>{biz.name}</h1>
      </header>
      <form onSubmit={submit} noValidate>
        <label htmlFor="code" className="label">Auftragsnummer</label>
        <input
          id="code"
          ref={input}
          className="code-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={error ? "code-error" : undefined}
        />
        {error && <p id="code-error" role="alert" className="alert">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Einen Moment bitte" : "Status ansehen"}</button>
      </form>
      <section aria-labelledby="how">
        <h2 id="how">So geht es</h2>
        <ol className="steps">
          <li>Suchen Sie die Nummer auf Ihrem Anhänger oder in Ihrer Nachricht.</li>
          <li>Geben Sie die Nummer oben ein. Groß oder klein und Leerzeichen sind egal.</li>
          <li>Tippen Sie auf "Status ansehen".</li>
        </ol>
      </section>
      <p className="hint">{FALLBACK_HINT}</p>
    </main>
  );
}
