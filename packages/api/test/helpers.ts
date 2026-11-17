import type { FastifyInstance } from "fastify";
import { buildApp, type BuildAppOptions } from "../src/app.js";
import type { Db } from "../src/types.js";

/** Wednesday 2026-11-11 10:07 local time. */
export const BASE = new Date(2026, 10, 11, 10, 7, 0).getTime();

export interface TestEnv {
  app: FastifyInstance;
  /** Mutable base time in ms (the demo offset is added by the app). */
  time: { value: number };
  db(): Db;
  token(username?: string): Promise<string>;
  /** Authorized request as staff. */
  api(token: string, method: string, url: string, payload?: unknown): Promise<{ status: number; json: any; body: string }>;
  /** Anonymous request (customer side). */
  pub(method: string, url: string, payload?: unknown, opts?: { remoteAddress?: string; headers?: Record<string, string> }): Promise<{ status: number; json: any; body: string }>;
}

export function makeEnv(over: Partial<BuildAppOptions> = {}): TestEnv {
  const time = { value: BASE };
  const app = buildApp({ clock: { now: () => time.value }, lookupMinMs: 0, ...over });
  const call = async (method: string, url: string, payload: unknown, headers: Record<string, string>, remoteAddress?: string) => {
    const res = await app.inject({ method: method as any, url, payload: payload as any, headers, remoteAddress });
    let json: any = null;
    try {
      json = res.body ? JSON.parse(res.body) : null;
    } catch {
      /* not json */
    }
    return { status: res.statusCode, json, body: res.body };
  };
  const env: TestEnv = {
    app,
    time,
    db: () => app.ctx.store.db,
    async token(username = "inhaber") {
      const r = await call("POST", "/api/auth/login", { username, password: "demo1234" }, {});
      return r.json.token as string;
    },
    api: (token, method, url, payload) => call(method, url, payload, { authorization: `Bearer ${token}` }),
    pub: (method, url, payload, opts) => call(method, url, payload, opts?.headers ?? {}, opts?.remoteAddress),
  };
  return env;
}

export const PUB = "/api/public/b/werkstatt-demo";

/** Creates an order via the staff API and returns its detail. */
export async function createOrder(env: TestEnv, token: string, body: Record<string, unknown> = { item: "Testschuh" }) {
  const r = await env.api(token, "POST", "/api/betrieb/orders", { customerPhone: "+49 151 00000099", ...body });
  if (r.status !== 201) throw new Error(`create failed ${r.status} ${r.body}`);
  return r.json as import("@abholdemo/shared").OrderDetail;
}

export async function setStatus(env: TestEnv, token: string, id: string, status: string) {
  return env.api(token, "POST", `/api/betrieb/orders/${id}/status`, { status });
}

export const orderId = (env: TestEnv, code: string) => env.db().orders.find((o) => o.code === code)!.id;
