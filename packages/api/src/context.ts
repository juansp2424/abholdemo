import type { RandomInt } from "./code.js";
import type { RateLimiter } from "./rateLimit.js";
import type { Store } from "./store.js";
import type { UserRec } from "./types.js";

/** Everything the route modules need. */
export interface Ctx {
  store: Store;
  /** Demo clock: base clock plus the demo offset. */
  now(): number;
  rng: RandomInt;
  limiter: RateLimiter;
  lookupMinMs: number;
}

declare module "fastify" {
  interface FastifyRequest {
    user: UserRec | null;
    token: string | null;
  }
  interface FastifyInstance {
    ctx: Ctx;
  }
}
