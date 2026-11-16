import { useState } from "react";
import type { FormEvent } from "react";
import type { LoginResponse } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { Alert } from "../ui";

export function Login({ onLoggedIn }: { onLoggedIn: (r: LoginResponse) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(await api<LoginResponse>("POST", "/api/auth/login", { username: username.trim(), password }, false));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h1>Abholstatus Betrieb</h1>
        <p className="muted">Bitte melden Sie sich an.</p>
        <Alert message={error} />
        <label className="field">
          <span>Benutzername</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoCapitalize="none" autoComplete="username" required />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Einen Moment bitte" : "Anmelden"}
        </button>
        <div className="hint-box">
          <strong>Demozugänge</strong>
          <ul>
            <li>
              <code>inhaber</code> / <code>demo1234</code> (Inhaber)
            </li>
            <li>
              <code>mitarbeiter</code> / <code>demo1234</code> (Mitarbeiter)
            </li>
          </ul>
        </div>
      </form>
    </div>
  );
}
