import { useCallback, useEffect, useState } from "react";
import type { BusinessInfo, DemoClock, LoginResponse, StaffUser } from "@abholdemo/shared";
import { ROLE_LABELS } from "@abholdemo/shared";
import { api, getToken, onUnauthorized, setToken } from "./api";
import { formatDayShort, toDayString } from "./format";
import { AppContext } from "./ui";
import { Login } from "./screens/Login";
import { OrderList } from "./screens/OrderList";
import { NewOrder } from "./screens/NewOrder";
import { OrderDetailScreen } from "./screens/OrderDetail";
import { Calendar } from "./screens/Calendar";
import { Messages } from "./screens/Messages";
import { Poster } from "./screens/Poster";
import { Settings } from "./screens/Settings";
import { Staff } from "./screens/Staff";
import { DemoTools } from "./screens/DemoTools";
import { Icon } from "./icons";

function useHashRoute(): string {
  const read = () => window.location.hash.replace(/^#/, "") || "/auftraege";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(path: string): void {
  window.location.hash = path;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
  ownerOnly?: boolean;
}

const NAV: NavItem[] = [
  { path: "/auftraege", label: "Aufträge", icon: "list" },
  { path: "/neu", label: "Neuer Auftrag", icon: "plus" },
  { path: "/kalender", label: "Kalender", icon: "calendar" },
  { path: "/nachrichten", label: "Nachrichten", icon: "message" },
  { path: "/aufsteller", label: "Aufsteller", icon: "qr" },
  { path: "/einstellungen", label: "Einstellungen", icon: "sliders", ownerOnly: true },
  { path: "/mitarbeiter", label: "Mitarbeiter", icon: "people", ownerOnly: true },
  { path: "/demo", label: "Demo", icon: "sparkle" },
];

export function App() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [checking, setChecking] = useState<boolean>(() => getToken() !== null);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setChecking(false);
    // The next login must start on the order list, never on an owner only page.
    window.location.hash = "/auftraege";
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
  }, [logout]);

  useEffect(() => {
    if (!getToken()) return;
    api<StaffUser>("GET", "/api/auth/me").then(
      (u) => {
        setUser(u);
        setChecking(false);
      },
      () => {
        setToken(null);
        setChecking(false);
      }
    );
  }, []);

  if (checking) return <div className="center-note">Einen Moment bitte.</div>;
  if (!user) {
    return (
      <Login
        onLoggedIn={(r: LoginResponse) => {
          setToken(r.token);
          setUser(r.user);
          if (!window.location.hash) go("/auftraege");
        }}
      />
    );
  }
  return (
    <Shell
      user={user}
      onLogout={() => {
        api("POST", "/api/auth/logout").catch(() => {});
        logout();
      }}
    />
  );
}

function Shell({ user, onLogout }: { user: StaffUser; onLogout: () => void }) {
  const route = useHashRoute();
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [clock, setClock] = useState<DemoClock | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isOwner = user.role === "INHABER";

  const refreshBusiness = useCallback(() => {
    api<BusinessInfo>("GET", "/api/betrieb/business").then(setBusiness, () => {});
  }, []);
  const refreshClock = useCallback(() => {
    api<DemoClock>("GET", "/api/demo/clock").then(setClock, () => {});
  }, []);
  const reloadAll = useCallback(() => {
    setReloadKey((k) => k + 1);
    refreshClock();
    refreshBusiness();
  }, [refreshClock, refreshBusiness]);

  useEffect(() => {
    refreshBusiness();
  }, [refreshBusiness]);
  useEffect(() => {
    refreshClock();
  }, [route, refreshClock]);

  const items = NAV.filter((n) => !n.ownerOnly || isOwner);
  const active = items.find((n) => route === n.path || (n.path === "/auftraege" && route.startsWith("/auftrag/")));

  let screen;
  if (route === "/neu") screen = <NewOrder />;
  else if (route.startsWith("/auftrag/")) screen = <OrderDetailScreen id={route.slice("/auftrag/".length)} />;
  else if (route === "/kalender") screen = <Calendar />;
  else if (route === "/nachrichten") screen = <Messages />;
  else if (route === "/aufsteller") screen = <Poster />;
  else if (route === "/einstellungen") screen = isOwner ? <Settings /> : <NotAllowed />;
  else if (route === "/mitarbeiter") screen = isOwner ? <Staff /> : <NotAllowed />;
  else if (route === "/demo") screen = <DemoTools />;
  else screen = <OrderList />;

  return (
    <AppContext.Provider value={{ user, business, clock, refreshClock, refreshBusiness, reloadAll }}>
      <div className="shell">
        <header className="topbar no-print">
          <div className="brand">
            {business?.logoDataUrl ? <img className="brand-logo" src={business.logoDataUrl} alt="" /> : null}
            <span className="brand-name">{business?.name ?? "Abholstatus"}</span>
          </div>
          <div className="topbar-right">
            {clock ? (
              <span className="demo-marker" title="Die Demo hat eine eigene Uhr">
                Demo: {formatDayShort(toDayString(new Date(clock.now)))}
              </span>
            ) : null}
            <span className="who">
              {user.displayName} ({ROLE_LABELS[user.role]})
            </span>
            <button className="btn btn-quiet" onClick={onLogout}>
              Abmelden
            </button>
          </div>
        </header>
        <nav className="nav no-print" aria-label="Hauptmenü">
          {items.map((n) => (
            <a key={n.path} href={`#${n.path}`} className={`nav-item${active === n ? " active" : ""}`} aria-current={active === n ? "page" : undefined}>
              <span className="nav-icon" aria-hidden="true">
                <Icon name={n.icon} />
              </span>
              <span className="nav-label">{n.label}</span>
            </a>
          ))}
        </nav>
        <main className="main" key={`${route}-${reloadKey}`}>
          {screen}
        </main>
      </div>
    </AppContext.Provider>
  );
}

function NotAllowed() {
  return (
    <div className="alert alert-error" role="alert">
      Diese Seite ist nur für Inhaber.
    </div>
  );
}
