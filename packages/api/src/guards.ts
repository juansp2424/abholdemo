import type { FastifyRequest } from "fastify";
import { HttpError } from "./validation.js";

/** preHandler for owner only routes (runs after the auth guard). */
export async function ownerOnly(req: FastifyRequest) {
  if (req.user?.role !== "INHABER") throw new HttpError(403, "FORBIDDEN", "Nur für Inhaber.");
}
