import { convert, validate } from "@arcane-table/converter-core";
import type { AuthStore } from "@arcane-table/persistence";
import { corePlugins, type PluginManifest } from "@arcane-table/plugin-sdk";
import {
  adminHealthSchema,
  auditPageSchema,
  conversionRejectedSchema,
  conversionResponseSchema,
  createUserRequestSchema,
  healthStatusSchema,
  loginRequestSchema,
  publicUserSchema,
  sessionResponseSchema,
  updateUserRequestSchema,
  userPageSchema,
  type Role,
} from "@arcane-table/protocol";
import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createAuthService,
  hasRole,
  type AuthService,
  type PasswordHasher,
  type Principal,
} from "./auth-service.js";
import { createRateLimiter, secretsMatch, sendError, sessionCookie } from "./security.js";

declare module "fastify" {
  interface FastifyRequest {
    principal: Principal | null;
  }
}

export type AppOptions = Readonly<{
  authStore?: AuthStore;
  ids?: () => string;
  now?: () => Date;
  password?: PasswordHasher;
  plugins?: readonly PluginManifest[];
  readiness?: () => Promise<boolean>;
  secureCookies?: boolean;
  sessionTtlMs?: number;
}>;

const status = (serviceStatus: "ok" | "degraded") =>
  healthStatusSchema.parse({
    service: "api",
    status: serviceStatus,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });

const pageQuerySchema = z.object({
  action: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(32).optional(),
});

const requirePrincipal = (request: FastifyRequest, reply: FastifyReply): Principal | null => {
  if (request.principal === null) {
    sendError(reply, 401, "UNAUTHENTICATED", "Sign in required.");
    return null;
  }
  return request.principal;
};

const requireCsrf = (
  request: FastifyRequest,
  principal: Principal,
  reply: FastifyReply,
): boolean => {
  const header = request.headers["x-csrf-token"];
  const token = Array.isArray(header) ? header[0] : header;
  if (typeof token !== "string" || !secretsMatch(token, principal.csrfToken)) {
    sendError(reply, 403, "INVALID_CSRF", "CSRF token is missing or invalid.");
    return false;
  }
  return true;
};

const requireRoles = (
  request: FastifyRequest,
  reply: FastifyReply,
  roles: readonly Role[],
): Principal | null => {
  const principal = requirePrincipal(request, reply);
  if (principal === null) return null;
  if (!hasRole(principal, roles)) {
    sendError(reply, 403, "FORBIDDEN", "This action is not available for the current role.");
    return null;
  }
  return principal;
};

export const createApp = ({
  authStore,
  ids = () => crypto.randomUUID(),
  now = () => new Date(),
  password,
  plugins = corePlugins,
  readiness = async () => true,
  secureCookies = false,
  sessionTtlMs = 12 * 60 * 60 * 1000,
}: AppOptions = {}): FastifyInstance => {
  const app = Fastify({ bodyLimit: 5 * 1024 * 1024, logger: true, trustProxy: true });
  const auth: AuthService | null =
    authStore === undefined || password === undefined
      ? null
      : createAuthService(
          authStore,
          password,
          now,
          ids,
          sessionTtlMs,
          createRateLimiter(8, 15 * 60 * 1000, () => now().getTime()),
        );

  app.decorateRequest("principal", null);
  void app.register(cookie);
  app.addHook("onRequest", async (request) => {
    const token = request.cookies[sessionCookie];
    request.principal =
      auth === null || typeof token !== "string" ? null : await auth.authenticate(token);
  });

  app.get("/health", async () => status("ok"));
  app.get("/ready", async (_request, reply) => {
    const ready = await readiness();
    return reply.code(ready ? 200 : 503).send(status(ready ? "ok" : "degraded"));
  });

  app.get("/v1/auth/session", async (request) =>
    sessionResponseSchema.parse({
      authenticated: request.principal !== null,
      contractVersion: "1",
      csrfToken: request.principal?.csrfToken ?? null,
      user:
        request.principal === null
          ? null
          : {
              disabled: false,
              id: request.principal.userId,
              roles: request.principal.roles,
              username: request.principal.username,
            },
    }),
  );

  app.post("/v1/auth/login", async (request, reply) => {
    if (auth === null)
      return sendError(reply, 503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    const parsed = loginRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return sendError(reply, 400, "INVALID_REQUEST", "Username or password is invalid.");
    const result = await auth.login(parsed.data.username, parsed.data.password);
    if (!result.ok) {
      const statusCode = result.error === "RATE_LIMITED" ? 429 : 401;
      return sendError(reply, statusCode, result.error, "Username or password is incorrect.");
    }
    reply.setCookie(sessionCookie, result.token, {
      httpOnly: true,
      maxAge: Math.floor(sessionTtlMs / 1000),
      path: "/",
      sameSite: "lax",
      secure: secureCookies && request.protocol === "https",
    });
    return sessionResponseSchema.parse({
      authenticated: true,
      contractVersion: "1",
      csrfToken: result.csrfToken,
      user: result.user,
    });
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    if (auth === null)
      return sendError(reply, 503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    const principal = requirePrincipal(request, reply);
    if (principal === null || !requireCsrf(request, principal, reply)) return reply;
    await auth.logout(principal);
    reply.clearCookie(sessionCookie, { path: "/" });
    return sessionResponseSchema.parse({
      authenticated: false,
      contractVersion: "1",
      csrfToken: null,
      user: null,
    });
  });

  app.get("/v1/admin/health", async (request, reply) => {
    if (auth === null)
      return sendError(reply, 503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    if (requireRoles(request, reply, ["admin"]) === null) return reply;
    const counts = await auth.sessionCounts();
    const databaseReady = await readiness();
    return adminHealthSchema.parse({
      contractVersion: "1",
      database: databaseReady ? "ok" : "degraded",
      pluginCount: plugins.length,
      service: "api",
      sessionCount: counts.sessions,
      userCount: counts.users,
      version: "0.1.0",
    });
  });

  app.get("/v1/admin/plugins", async (request, reply) => {
    if (requireRoles(request, reply, ["admin"]) === null) return reply;
    return { contractVersion: "1" as const, plugins };
  });

  app.get("/v1/admin/users", async (request, reply) => {
    if (auth === null)
      return sendError(reply, 503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    if (requireRoles(request, reply, ["admin"]) === null) return reply;
    const parsed = pageQuerySchema.safeParse(request.query);
    if (!parsed.success) return sendError(reply, 400, "INVALID_REQUEST", "Pagination is invalid.");
    const page = await auth.listUsers({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      ...(parsed.data.query === undefined ? {} : { query: parsed.data.query }),
    });
    return userPageSchema.parse({
      contractVersion: "1",
      items: page.items.map((user) =>
        publicUserSchema.parse({
          disabled: user.disabled,
          id: user.id,
          roles: user.roles,
          username: user.username,
        }),
      ),
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      total: page.total,
    });
  });

  app.post("/v1/admin/users", async (request, reply) => {
    if (auth === null)
      return sendError(reply, 503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    const principal = requireRoles(request, reply, ["admin"]);
    if (principal === null || !requireCsrf(request, principal, reply)) return reply;
    const parsed = createUserRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return sendError(reply, 400, "INVALID_REQUEST", "User details are invalid.");
    const created = await auth.createUser(principal, parsed.data);
    if (!created.ok) return sendError(reply, 409, created.error, "Username is already in use.");
    return reply.code(201).send(created.user);
  });

  app.patch("/v1/admin/users/:id", async (request, reply) => {
    if (auth === null)
      return sendError(reply, 503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    const principal = requireRoles(request, reply, ["admin"]);
    if (principal === null || !requireCsrf(request, principal, reply)) return reply;
    const params = z.object({ id: z.uuid() }).safeParse(request.params);
    const parsed = updateUserRequestSchema.safeParse(request.body);
    if (!params.success || !parsed.success)
      return sendError(reply, 400, "INVALID_REQUEST", "User update is invalid.");
    const patch = parsed.data;
    const updated = await auth.updateUser(principal, params.data.id, {
      ...(patch.disabled === undefined ? {} : { disabled: patch.disabled }),
      ...(patch.password === undefined ? {} : { password: patch.password }),
      ...(patch.roles === undefined ? {} : { roles: patch.roles }),
    });
    if (updated === null) return sendError(reply, 404, "NOT_FOUND", "User was not found.");
    return updated;
  });

  app.post("/v1/admin/users/:id/sessions/revoke", async (request, reply) => {
    if (auth === null)
      return sendError(reply, 503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    const principal = requireRoles(request, reply, ["admin"]);
    if (principal === null || !requireCsrf(request, principal, reply)) return reply;
    const params = z.object({ id: z.uuid() }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_REQUEST", "User id is invalid.");
    const revoked = await auth.revokeUserSessions(principal, params.data.id);
    return { revoked };
  });

  app.get("/v1/admin/audit", async (request, reply) => {
    if (auth === null)
      return sendError(reply, 503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    if (requireRoles(request, reply, ["admin"]) === null) return reply;
    const parsed = pageQuerySchema.safeParse(request.query);
    if (!parsed.success) return sendError(reply, 400, "INVALID_REQUEST", "Audit query is invalid.");
    const page = await auth.listAudit({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      ...(parsed.data.action === undefined ? {} : { action: parsed.data.action }),
    });
    return auditPageSchema.parse({
      contractVersion: "1",
      items: page.items.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      total: page.total,
    });
  });

  app.post<{ Querystring: { readonly strict?: string } }>(
    "/v1/conversions/roll20-foundry",
    async (request, reply) => {
      const principal = requireRoles(request, reply, ["admin", "gm"]);
      if (principal === null || !requireCsrf(request, principal, reply)) return reply;
      const mode = request.query.strict === "true" ? "strict" : "lenient";
      const validation = validate(request.body, { mode });
      if (!validation.valid) {
        return reply.code(422).send(
          conversionRejectedSchema.parse({
            diagnostics: validation.diagnostics,
            error: "CONVERSION_REJECTED",
            message: "The Roll20 export could not be converted.",
          }),
        );
      }
      return reply.code(200).send(conversionResponseSchema.parse(convert(request.body, { mode })));
    },
  );

  return app;
};
