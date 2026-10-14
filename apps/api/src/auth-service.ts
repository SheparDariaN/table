import type { PublicUser, Role } from "@arcane-table/protocol";
import type { AuthStore, StoredUser } from "@arcane-table/persistence";
import type { RateLimiter } from "./security.js";
import { createSecret, hashToken } from "./security.js";

export type PasswordHasher = Readonly<{
  hash: (password: string) => Promise<string>;
  verify: (passwordHash: string, password: string) => Promise<boolean>;
}>;

export type Principal = Readonly<{
  csrfToken: string;
  roles: readonly Role[];
  sessionId: string;
  userId: string;
  username: string;
}>;

export type LoginSuccess = Readonly<{
  csrfToken: string;
  ok: true;
  token: string;
  user: PublicUser;
}>;

export type LoginFailure = Readonly<{
  error: "INVALID_CREDENTIALS" | "RATE_LIMITED";
  ok: false;
}>;

const toPublicUser = (user: StoredUser): PublicUser => ({
  disabled: user.disabled,
  id: user.id,
  roles: [...user.roles],
  username: user.username,
});

export type AuthService = Readonly<{
  authenticate: (token: string) => Promise<Principal | null>;
  bootstrapAdmin: (username: string, password: string) => Promise<boolean>;
  createUser: (
    actor: Principal,
    input: {
      readonly password: string;
      readonly roles: readonly Role[];
      readonly username: string;
    },
  ) => Promise<
    | { readonly ok: true; readonly user: PublicUser }
    | { readonly error: "USERNAME_TAKEN"; readonly ok: false }
  >;
  listAudit: (query: {
    readonly action?: string;
    readonly page: number;
    readonly pageSize: number;
  }) => ReturnType<AuthStore["listAudit"]>;
  listUsers: (query: {
    readonly page: number;
    readonly pageSize: number;
    readonly query?: string;
  }) => ReturnType<AuthStore["listUsers"]>;
  login: (username: string, password: string) => Promise<LoginFailure | LoginSuccess>;
  logout: (principal: Principal) => Promise<void>;
  revokeUserSessions: (actor: Principal, userId: string) => Promise<number>;
  sessionCounts: () => Promise<{ readonly sessions: number; readonly users: number }>;
  updateUser: (
    actor: Principal,
    userId: string,
    patch: {
      readonly disabled?: boolean;
      readonly password?: string;
      readonly roles?: readonly Role[];
    },
  ) => Promise<PublicUser | null>;
}>;

export const createAuthService = (
  store: AuthStore,
  hasher: PasswordHasher,
  now: () => Date,
  ids: () => string,
  sessionTtlMs: number,
  limiter: RateLimiter,
): AuthService => {
  const audit = async (
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    details: Readonly<Record<string, string | number | boolean | null>> = {},
  ): Promise<void> => {
    await store.insertAudit({ action, actorUserId, details, id: ids(), targetId, targetType });
  };

  return {
    authenticate: async (token) => {
      const session = await store.findSessionByTokenHash(hashToken(token), now());
      if (session === null) return null;
      const user = await store.findUserById(session.userId);
      if (user === null || user.disabled) return null;
      return {
        csrfToken: session.csrfToken,
        roles: user.roles,
        sessionId: session.id,
        userId: user.id,
        username: user.username,
      };
    },
    bootstrapAdmin: async (username, password) => {
      if ((await store.countUsers()) > 0) return false;
      const id = ids();
      await store.insertUser({
        id,
        passwordHash: await hasher.hash(password),
        roles: ["admin"],
        username,
      });
      await audit(id, "admin.bootstrap", "user", id, { username });
      return true;
    },
    createUser: async (actor, input) => {
      const id = ids();
      const created = await store.insertUser({
        id,
        passwordHash: await hasher.hash(input.password),
        roles: input.roles,
        username: input.username,
      });
      if (created === "username_taken") return { error: "USERNAME_TAKEN", ok: false };
      await audit(actor.userId, "admin.user.created", "user", id, { username: input.username });
      const user = await store.findUserById(id);
      if (user === null) throw new Error("Created user was not readable.");
      return { ok: true, user: toPublicUser(user) };
    },
    listAudit: (query) => store.listAudit(query),
    listUsers: (query) => store.listUsers(query),
    login: async (username, password) => {
      if (!limiter.allow(username)) {
        await audit(null, "auth.login.rate_limited", "user", username, { username });
        return { error: "RATE_LIMITED", ok: false };
      }
      const user = await store.findUserByUsername(username);
      const valid =
        user !== null && !user.disabled && (await hasher.verify(user.passwordHash, password));
      if (!valid || user === null) {
        await audit(null, "auth.login.failed", "user", username, { username });
        return { error: "INVALID_CREDENTIALS", ok: false };
      }
      const token = createSecret();
      const csrfToken = createSecret();
      const sessionId = ids();
      await store.insertSession({
        csrfToken,
        expiresAt: new Date(now().getTime() + sessionTtlMs),
        id: sessionId,
        tokenHash: hashToken(token),
        userId: user.id,
      });
      await audit(user.id, "auth.login.succeeded", "session", sessionId, { username });
      return { csrfToken, ok: true, token, user: toPublicUser(user) };
    },
    logout: async (principal) => {
      await store.revokeSession(principal.sessionId, now());
      await audit(principal.userId, "auth.logout", "session", principal.sessionId);
    },
    revokeUserSessions: async (actor, userId) => {
      const count = await store.revokeUserSessions(userId, now());
      await audit(actor.userId, "admin.session.revoked", "user", userId, { count });
      return count;
    },
    sessionCounts: async () => ({
      sessions: await store.countActiveSessions(now()),
      users: await store.countUsers(),
    }),
    updateUser: async (actor, userId, patch) => {
      const updated = await store.updateUser(userId, {
        ...(patch.disabled === undefined ? {} : { disabled: patch.disabled }),
        ...(patch.password === undefined
          ? {}
          : { passwordHash: await hasher.hash(patch.password) }),
        ...(patch.roles === undefined ? {} : { roles: patch.roles }),
      });
      if (updated === null) return null;
      await audit(actor.userId, "admin.user.updated", "user", userId, {
        disabled: patch.disabled ?? updated.disabled,
        roles: updated.roles.join(","),
      });
      return toPublicUser(updated);
    },
  };
};

export const hasRole = (principal: Principal, roles: readonly Role[]): boolean =>
  principal.roles.some((role) => roles.includes(role));
