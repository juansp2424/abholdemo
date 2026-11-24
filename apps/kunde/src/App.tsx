import { useCallback, useEffect, useState } from "react";
import { PingoLogo } from "./PingoLogo";
import { AppointmentPage, DropOffPage } from "./pages/DropOff";
import { CentralStart, CentralStatus } from "./pages/Central";
import { StartPage } from "./pages/StartPage";
import { StatusPage } from "./pages/StatusPage";

export function navigate(to: string) {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function Link({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

function useLocation() {
  const [loc, setLoc] = useState({ path: window.location.pathname, search: window.location.search });
  const update = useCallback(() => setLoc({ path: window.location.pathname, search: window.location.search }), []);
  useEffect(() => {
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [update]);
  return loc;
}

export function App() {
  const { path, search } = useLocation();
  const parts = path.split("/").filter(Boolean);
  let page: React.ReactNode;
  if (parts[0] === "b" && parts[1] && parts[2] === "termin") {
    page = <DropOffPage key={parts[1]} web={parts[1]} />;
  } else if (parts[0] === "termin" && parts[1]) {
    page = <AppointmentPage key={parts[1]} token={decodeURIComponent(parts[1])} fresh={new URLSearchParams(search).get("neu") === "1"} />;
  } else if (parts[0] === "b" && parts[1] && parts[2] === "a" && parts[3]) {
    const abmelden = new URLSearchParams(search).get("abmelden") === "1";
    page = <StatusPage key={`${parts[1]}/${parts[3]}`} web={parts[1]} code={decodeURIComponent(parts[3])} abmelden={abmelden} />;
  } else if (parts[0] === "b" && parts[1]) {
    page = <StartPage key={parts[1]} web={parts[1]} />;
  } else if (parts[0] === "a" && parts[1]) {
    const abmelden = new URLSearchParams(search).get("abmelden") === "1";
    page = <CentralStatus key={parts[1]} code={decodeURIComponent(parts[1])} abmelden={abmelden} />;
  } else {
    page = <CentralStart />;
  }
  return (
    <>
      <header className="pingo-bar">
        <Link to="/" className="pingo-link" aria-label="Pingo, zur Startseite"><PingoLogo /></Link>
      </header>
      {page}
    </>
  );
}
