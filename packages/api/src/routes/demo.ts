import type { FastifyInstance } from "fastify";
import type { AdvanceTimeResponse, DemoClock } from "@abholdemo/shared";
import { iso } from "../clock.js";
import type { Ctx } from "../context.js";
import { sweepOverdue } from "../domain.js";
import { seed } from "../seed.js";
import { asObject, invalid } from "../validation.js";

export function demoRoutes(app: FastifyInstance, ctx: Ctx) {
  const clock = (): DemoClock => ({ now: iso(ctx.now()), offsetDays: ctx.store.db.offsetDays });

  app.get("/api/demo/clock", async () => clock());

  app.post("/api/demo/advance", async (req): Promise<AdvanceTimeResponse> => {
    const days = asObject(req.body).days;
    if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 60) {
      invalid("Bitte geben Sie eine ganze Zahl von 1 bis 60 Tagen an.");
    }
    const db = ctx.store.db;
    db.offsetDays += days as number;
    const result = sweepOverdue(db, ctx.now());
    return { ...clock(), ...result };
  });

  app.post("/api/demo/reset", async () => {
    const old = ctx.store.db;
    // The base time is now() minus the current offset, so the seed starts at real time with offset 0.
    const fresh = seed(ctx.now() - old.offsetDays * 86_400_000);
    // Tokens of the stable seed users stay valid.
    fresh.tokens = old.tokens.filter((t) => fresh.users.some((u) => u.id === t.userId));
    ctx.store.photos.clear();
    ctx.store.replace(fresh);
    return clock();
  });
}
