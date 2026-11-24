import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { PUBLIC_LOOKUP_MIN_MS } from "@abholdemo/shared";
import { DAY_MS, systemClock, type Clock } from "./clock.js";
import { cryptoRandomInt, type RandomInt } from "./code.js";
import type { Ctx } from "./context.js";
import { sweepAppointments, sweepEstimates, sweepOverdue } from "./domain.js";
import { createRateLimiter } from "./rateLimit.js";
import { authRoutes, authedAuthRoutes } from "./routes/auth.js";
import { demoRoutes } from "./routes/demo.js";
import { messageRoutes } from "./routes/messages.js";
import { orderRoutes } from "./routes/orders.js";
import { publicRoutes } from "./routes/public.js";
import { settingsRoutes } from "./routes/settings.js";
import { estimateRoutes } from "./routes/estimates.js";
import { appointmentPublicRoutes, appointmentRoutes } from "./routes/appointments.js";
import { seed } from "./seed.js";
import { Store, type RemoteDb } from "./store.js";
import { HttpError } from "./validation.js";

export interface BuildAppOptions {
  /** JSON database file. Omit or null for an in memory database (tests). */
  dbFile?: string | null;
  /** Base clock (the demo offset is added on top). */
  clock?: Clock;
  random?: RandomInt;
  /** Minimum duration of public order lookups. Default PUBLIC_LOOKUP_MIN_MS. */
  lookupMinMs?: number;
  logger?: boolean;
  /** Supabase persistence; replaces the JSON file when set. */
  remote?: RemoteDb;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const base = opts.clock ?? systemClock;
  const store = new Store(opts.dbFile ?? null, () => seed(base.now()), opts.remote);
  const now = () => base.now() + store.db.offsetDays * DAY_MS;
  const ctx: Ctx = {
    store,
    now,
    rng: opts.random ?? cryptoRandomInt,
    limiter: createRateLimiter(now),
    lookupMinMs: opts.lookupMinMs ?? PUBLIC_LOOKUP_MIN_MS,
  };

  const app = Fastify({ logger: opts.logger ? { level: "warn" } : false, bodyLimit: 4 * 1024 * 1024 });
  app.decorate("ctx", ctx);
  app.decorateRequest("user", null);
  app.decorateRequest("token", null);

  // Lenient JSON parser: an empty body counts as {}.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (body === "") return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(new HttpError(400, "VALIDATION", "Die Anfrage ist nicht lesbar."), undefined);
    }
  });

  // CORS for the hosted frontends (bearer token auth, no cookies). CORS_ORIGINS: comma separated list.
  const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (!origin || !origins.includes(origin)) return;
    reply.header("Access-Control-Allow-Origin", origin).header("Vary", "Origin");
    if (req.method === "OPTIONS") {
      return reply
        .header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE")
        .header("Access-Control-Allow-Headers", "Authorization,Content-Type")
        .code(204)
        .send();
    }
  });

  // Overdue sweep before every request, so every read sees the current state.
  app.addHook("onRequest", async (req) => {
    if (!req.url.startsWith("/api/")) return;
    const r = sweepOverdue(store.db, now());
    const a = sweepAppointments(store.db, now());
    if (sweepEstimates(store.db, now()) || a || r.newlyOverdue.length) store.dirty = true;
  });

  // Persist after anything that may have changed data (atomic file write).
  app.addHook("onSend", async (req, _reply, payload) => {
    if (store.dirty || req.method !== "GET") store.save();
    return payload;
  });

  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message } });
    }
    if (err.statusCode === 413) {
      return reply.code(413).send({ error: { code: "VALIDATION", message: "Die Datei ist zu groß." } });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: "Die Anfrage ist nicht gültig." } });
    }
    req.log.error(err);
    return reply.code(500).send({
      error: { code: "INTERNAL", message: "Es ist ein Fehler passiert. Bitte versuchen Sie es noch einmal." },
    });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Diese Seite gibt es nicht." } }),
  );

  app.register(async (s) => publicRoutes(s, ctx));
  app.register(async (s) => authRoutes(s, ctx));
  app.register(async (s) => appointmentPublicRoutes(s, ctx));
  app.register(async (s) => {
    s.addHook("preHandler", authGuard(ctx));
    authedAuthRoutes(s, ctx);
    orderRoutes(s, ctx);
    messageRoutes(s, ctx);
    settingsRoutes(s, ctx);
    estimateRoutes(s, ctx);
    appointmentRoutes(s, ctx);
    demoRoutes(s, ctx);
  });

  return app;
}

function authGuard(ctx: Ctx) {
  return async (req: FastifyRequest) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const rec = token ? ctx.store.db.tokens.find((t) => t.token === token) : undefined;
    const user = rec ? ctx.store.db.users.find((u) => u.id === rec.userId) : undefined;
    if (!rec || !user || !user.active) {
      throw new HttpError(401, "UNAUTHORIZED", "Bitte melden Sie sich an.");
    }
    req.user = user;
    req.token = token;
  };
}
