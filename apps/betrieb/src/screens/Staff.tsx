import { useState } from "react";
import type { FormEvent } from "react";
import { ROLE_LABELS } from "@abholdemo/shared";
import type { CreateStaffRequest, Role, StaffUser, UpdateStaffRequest } from "@abholdemo/shared";
import { api, errorMessage } from "../api";
import { Alert, PageHeader, useApp, useLoad } from "../ui";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export function Staff() {
  const { user } = useApp();
  const { data, error, reload } = useLoad(() => api<StaffUser[]>("GET", "/api/betrieb/staff"), []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateStaffRequest>({ username: "", displayName: "", role: "MITARBEITER", password: "" });
  const [creating, setCreating] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  async function update(id: string, patch: UpdateStaffRequest) {
    setActionError(null);
    setOk(null);
    try {
      await api<StaffUser>("PATCH", `/api/betrieb/staff/${encodeURIComponent(id)}`, patch);
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
      reload();
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setActionError(null);
    setOk(null);
    try {
      const u = await api<StaffUser>("POST", "/api/betrieb/staff", { ...form, username: form.username.trim(), displayName: form.displayName.trim() });
      setOk(`${u.displayName} wurde angelegt.`);
      setForm({ username: "", displayName: "", role: "MITARBEITER", password: "" });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader title="Mitarbeiter" />
      <Alert message={error} />
      <Alert message={actionError} />
      <Alert message={ok} kind="success" />
      <ul className="staff-list">
        {data?.map((u) => (
          <li key={u.id} className={`card staff-row${u.active ? "" : " inactive"}`}>
            <div className="staff-name">
              <strong>{u.displayName}</strong>
              <span className="muted">
                {u.username}
                {u.id === user.id ? " (Sie)" : ""}
                {u.active ? "" : ", deaktiviert"}
              </span>
            </div>
            <label className="field field-inline">
              <span>Rolle</span>
              <select value={u.role} onChange={(e) => update(u.id, { role: e.target.value as Role })} aria-label={`Rolle von ${u.displayName}`}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <button className={u.active ? "btn btn-secondary" : "btn btn-primary"} disabled={u.id === user.id} title={u.id === user.id ? "Sie können sich nicht selbst deaktivieren." : undefined} onClick={() => update(u.id, { active: !u.active })}>
              {u.active ? "Deaktivieren" : "Aktivieren"}
            </button>
          </li>
        ))}
      </ul>

      <form className="card form" onSubmit={create}>
        <h2>Neuen Mitarbeiter anlegen</h2>
        <label className="field">
          <span>Benutzername (3 bis 30 Zeichen, nur Kleinbuchstaben, Ziffern und Punkt)</span>
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoCapitalize="none" autoComplete="off" placeholder="zum Beispiel anna.sohle" required />
        </label>
        <label className="field">
          <span>Name</span>
          <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} autoComplete="off" placeholder="zum Beispiel Anna Sohle" required />
        </label>
        <label className="field">
          <span>Rolle</span>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Passwort (mindestens 6 Zeichen)</span>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required minLength={6} />
        </label>
        <button className="btn btn-primary" disabled={creating}>
          Anlegen
        </button>
      </form>
    </>
  );
}
