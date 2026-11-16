import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { LoginResponse, StaffUser } from "@abholdemo/shared";
import type { Ctx } from "../context.js";
import { hashPassword, verifyPassword } from "../password.js";
import type { UserRec } from "../types.js";
import { asObject, fail } from "../validation.js";

export const toStaffUser = (u: UserRec): StaffUser => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  active: u.active,
});

// Used so a login with an unknown user costs the same time as a wrong password.
const DUMMY_HASH = hashPassword("dummy");

export function authRoutes(app: FastifyInstance, ctx: Ctx) {
  app.post("/api/auth/login", async (req): Promise<LoginResponse> => {
    const body = asObject(req.body);
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = ctx.store.db.users.find((u) => u.username === username);
    const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.active) {
      return fail(401, "UNAUTHORIZED", "Benutzername oder Passwort stimmt nicht.");
    }
    const token = randomBytes(32).toString("hex");
    ctx.store.db.tokens.push({ token, userId: user.id, createdAt: new Date(ctx.now()).toISOString() });
    return { token, user: toStaffUser(user) };
  });
}

/** Routes under /api/auth that need a token (registered inside the guarded scope). */
export function authedAuthRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/auth/me", async (req) => toStaffUser(req.user as UserRec));

  app.post("/api/auth/logout", async (req, reply) => {
    const db = ctx.store.db;
    db.tokens = db.tokens.filter((t) => t.token !== req.token);
    return reply.code(204).send();
  });
}
