import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { STATUS_LABELS } from "@abholdemo/shared";
import type { BusinessInfo, DemoClock, OrderStatus, StaffUser } from "@abholdemo/shared";
import { errorMessage } from "./api";

export interface AppContextValue {
  user: StaffUser;
  business: BusinessInfo | null;
  clock: DemoClock | null;
  refreshClock: () => void;
  refreshBusiness: () => void;
  /** Bump after demo reset so screens reload their data. */
  reloadAll: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error("AppContext missing");
  return v;
}

export function Alert({ message, kind = "error" }: { message: string | null | undefined; kind?: "error" | "success" }) {
  if (!message) return null;
  return (
    <div className={kind === "error" ? "alert alert-error" : "alert alert-success"} role={kind === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}

/** Load data on mount and when deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(() => {
    const my = ++seq.current;
    setLoading(true);
    fnRef.current().then(
      (d) => {
        if (my !== seq.current) return;
        setData(d);
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (my !== seq.current) return;
        setError(errorMessage(e));
        setLoading(false);
      }
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, deps);
  return { data, error, loading, reload, setData };
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header no-print">
      <h1>{title}</h1>
      {children}
    </div>
  );
}
