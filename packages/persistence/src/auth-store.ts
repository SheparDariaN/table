import type { Pool, PoolClient } from "pg";
import type { Role } from "./roles.js";

export type StoredUser = Readonly<{
  createdAt: Date;
  disabled: boolean;
  id: string;
  passwordHash: string;
  roles: readonly Role[];
  username: string;
}>;

export type StoredSession = Readonly<{
  csrfToken: string;
  expiresAt: Date;
  id: string;
  userId: string;
}>;

export type StoredAudit = Readonly<{
  action: string;
  actorUsername: string | null;
  createdAt: Date;
  details: Readonly<Record<string, string | number | boolean | null>>;
  id: string;
  targetId: string;
  targetType: string;
}>;

export type NewUser = Readonly<{
  id: string;
  passwordHash: string;
  roles: readonly Role[];
  username: string;
}>;

export type UserPatch = Readonly<{
  disabled?: boolean;
  passwordHash?: string;
  roles?: readonly Role[];
}>;

export type NewSession = Readonly<{
  csrfToken: string;
  expiresAt: Date;
  id: string;
  tokenHash: string;
  userId: string;
}>;

export type NewAuditEvent = Readonly<{
  action: string;
  actorUserId: string | null;
  details: Readonly<Record<string, string | number | boolean | null>>;
  id: string;
  targetId: string;
  targetType: string;
}>;

export type PageQuery = Readonly<{
  action?: string;
  page: number;
  pageSize: number;
  query?: string;
}>;

export type Page<T> = Readonly<{
  items: readonly T[];
  total: number;
}>;

export type AuthStore = Readonly<{
  countActiveSessions: (now: Date) => Promise<number>;
  countUsers: () => Promise<number>;
  findSessionByTokenHash: (tokenHash: string, now: Date) => Promise<StoredSession | null>;
  findUserById: (id: string) => Promise<StoredUser | null>;
  findUserByUsername: (username: string) => Promise<StoredUser | null>;
  insertAudit: (event: NewAuditEvent) => Promise<void>;
  insertSession: (session: NewSession) => Promise<void>;
  insertUser: (user: NewUser) => Promise<"created" | "username_taken">;
  listAudit: (query: PageQuery) => Promise<Page<StoredAudit>>;
  listUsers: (query: PageQuery) => Promise<Page<StoredUser>>;
  revokeSession: (id: string, revokedAt: Date) => Promise<boolean>;
  revokeUserSessions: (userId: string, revokedAt: Date) => Promise<number>;
  updateUser: (id: string, patch: UserPatch) => Promise<StoredUser | null>;
}>;

type MutableUser = {
  createdAt: Date;
  disabled: boolean;
  id: string;
  passwordHash: string;
  roles: Role[];
  username: string;
};

type MutableSession = NewSession & { revokedAt: Date | null };

const pageSlice = <T>(items: readonly T[], query: PageQuery): Page<T> => {
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length };
};

export const createMemoryAuthStore = (): AuthStore => {
  const users = new Map<string, MutableUser>();
  const sessions = new Map<string, MutableSession>();
  const audits: StoredAudit[] = [];

  const publicUser = (user: MutableUser): StoredUser => ({ ...user, roles: [...user.roles] });

  return {
    countActiveSessions: async (now) =>
      [...sessions.values()].filter(
        (session) => session.revokedAt === null && session.expiresAt > now,
      ).length,
    countUsers: async () => users.size,
    findSessionByTokenHash: async (tokenHash, now) => {
      const session = [...sessions.values()].find((item) => item.tokenHash === tokenHash);
      if (session === undefined || session.revokedAt !== null || session.expiresAt <= now)
        return null;
      return {
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
        id: session.id,
        userId: session.userId,
      };
    },
    findUserById: async (id) => {
      const user = users.get(id);
      return user === undefined ? null : publicUser(user);
    },
    findUserByUsername: async (username) => {
      const user = [...users.values()].find((item) => item.username === username);
      return user === undefined ? null : publicUser(user);
    },
    insertAudit: async (event) => {
      const actor = event.actorUserId === null ? undefined : users.get(event.actorUserId);
      audits.push({
        ...event,
        actorUsername: actor?.username ?? null,
        createdAt: new Date(),
      });
    },
    insertSession: async (session) => {
      sessions.set(session.id, { ...session, revokedAt: null });
    },
    insertUser: async (user) => {
      if ([...users.values()].some((item) => item.username === user.username))
        return "username_taken";
      users.set(user.id, {
        ...user,
        createdAt: new Date(0),
        disabled: false,
        roles: [...user.roles],
      });
      return "created";
    },
    listAudit: async (query) => {
      const action = query.action ?? "";
      const filtered = audits.filter((event) => action.length === 0 || event.action === action);
      return pageSlice([...filtered].reverse(), query);
    },
    listUsers: async (query) => {
      const needle = (query.query ?? "").toLowerCase();
      const filtered = [...users.values()]
        .filter((user) => needle.length === 0 || user.username.includes(needle))
        .sort((left, right) => left.username.localeCompare(right.username))
        .map(publicUser);
      return pageSlice(filtered, query);
    },
    revokeSession: async (id, revokedAt) => {
      const session = sessions.get(id);
      if (session === undefined || session.revokedAt !== null) return false;
      sessions.set(id, { ...session, revokedAt });
      return true;
    },
    revokeUserSessions: async (userId, revokedAt) => {
      let count = 0;
      for (const [id, session] of sessions) {
        if (session.userId === userId && session.revokedAt === null) {
          sessions.set(id, { ...session, revokedAt });
          count += 1;
        }
      }
      return count;
    },
    updateUser: async (id, patch) => {
      const user = users.get(id);
      if (user === undefined) return null;
      const next: MutableUser = {
        ...user,
        ...(patch.disabled === undefined ? {} : { disabled: patch.disabled }),
        ...(patch.passwordHash === undefined ? {} : { passwordHash: patch.passwordHash }),
        ...(patch.roles === undefined ? {} : { roles: [...patch.roles] }),
      };
      users.set(id, next);
      return publicUser(next);
    },
  };
};

const query = async (client: Pool | PoolClient, text: string, values: readonly unknown[] = []) =>
  client.query(text, [...values]);

const mapRoles = (value: unknown): Role[] =>
  Array.isArray(value)
    ? value.filter((role): role is Role => role === "admin" || role === "gm" || role === "player")
    : [];

const mapUser = (row: Record<string, unknown>): StoredUser => ({
  createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
  disabled: row.disabled === true,
  id: String(row.id),
  passwordHash: String(row.password_hash),
  roles: mapRoles(row.roles),
  username: String(row.username),
});

const userSelect = `
  SELECT u.id, u.username, u.password_hash, u.disabled, u.created_at,
         COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
  FROM users u
  LEFT JOIN user_roles r ON r.user_id = u.id
`;

export const sanitizeAuditDetails = (
  value: unknown,
): Readonly<Record<string, string | number | boolean | null>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean" ||
      entry === null
        ? [[key, entry] as const]
        : [],
    ),
  );
};

const likePattern = (value: string): string =>
  `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

export const createPostgresAuthStore = (pool: Pool): AuthStore => ({
  countActiveSessions: async (now) => {
    const result = await query(
      pool,
      "SELECT count(*)::int AS count FROM sessions WHERE revoked_at IS NULL AND expires_at > $1",
      [now],
    );
    return Number(result.rows[0]?.count ?? 0);
  },
  countUsers: async () => {
    const result = await query(pool, "SELECT count(*)::int AS count FROM users");
    return Number(result.rows[0]?.count ?? 0);
  },
  findSessionByTokenHash: async (tokenHash, now) => {
    const result = await query(
      pool,
      `SELECT id, user_id, csrf_token, expires_at
       FROM sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2`,
      [tokenHash, now],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (row === undefined) return null;
    return {
      csrfToken: String(row.csrf_token),
      expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at)),
      id: String(row.id),
      userId: String(row.user_id),
    };
  },
  findUserById: async (id) => {
    const result = await query(pool, `${userSelect} WHERE u.id = $1 GROUP BY u.id`, [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row === undefined ? null : mapUser(row);
  },
  findUserByUsername: async (username) => {
    const result = await query(pool, `${userSelect} WHERE u.username = $1 GROUP BY u.id`, [
      username,
    ]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row === undefined ? null : mapUser(row);
  },
  insertAudit: async (event) => {
    await query(
      pool,
      `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        event.id,
        event.actorUserId,
        event.action,
        event.targetType,
        event.targetId,
        JSON.stringify(event.details),
      ],
    );
  },
  insertSession: async (session) => {
    await query(
      pool,
      `INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.id, session.userId, session.tokenHash, session.csrfToken, session.expiresAt],
    );
  },
  insertUser: async (user) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await query(client, "INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)", [
        user.id,
        user.username,
        user.passwordHash,
      ]);
      for (const role of user.roles) {
        await query(client, "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [
          user.id,
          role,
        ]);
      }
      await client.query("COMMIT");
      return "created";
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return "username_taken";
      }
      throw error;
    } finally {
      client.release();
    }
  },
  listAudit: async (pageQuery) => {
    const action = pageQuery.action ?? "";
    const values = [action, pageQuery.pageSize, (pageQuery.page - 1) * pageQuery.pageSize];
    const where = "WHERE ($1 = '' OR a.action = $1)";
    const count = await query(pool, `SELECT count(*)::int AS count FROM audit_events a ${where}`, [
      action,
    ]);
    const result = await query(
      pool,
      `SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at, u.username AS actor_username
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      values,
    );
    return {
      items: result.rows.map((row: Record<string, unknown>) => ({
        action: String(row.action),
        actorUsername:
          row.actor_username === null || row.actor_username === undefined
            ? null
            : String(row.actor_username),
        createdAt:
          row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
        details: sanitizeAuditDetails(row.details),
        id: String(row.id),
        targetId: String(row.target_id),
        targetType: String(row.target_type),
      })),
      total: Number(count.rows[0]?.count ?? 0),
    };
  },
  listUsers: async (pageQuery) => {
    const needle = pageQuery.query ?? "";
    const pattern = likePattern(needle);
    const where = needle.length === 0 ? "" : "WHERE u.username ILIKE $1 ESCAPE '\\'";
    const countValues = needle.length === 0 ? [] : [pattern];
    const count = await query(
      pool,
      `SELECT count(*)::int AS count FROM users u ${where}`,
      countValues,
    );
    const limit = needle.length === 0 ? "$1" : "$2";
    const offset = needle.length === 0 ? "$2" : "$3";
    const values =
      needle.length === 0
        ? [pageQuery.pageSize, (pageQuery.page - 1) * pageQuery.pageSize]
        : [pattern, pageQuery.pageSize, (pageQuery.page - 1) * pageQuery.pageSize];
    const result = await query(
      pool,
      `${userSelect} ${where} GROUP BY u.id ORDER BY u.username LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return {
      items: result.rows.map((row: Record<string, unknown>) => mapUser(row)),
      total: Number(count.rows[0]?.count ?? 0),
    };
  },
  revokeSession: async (id, revokedAt) => {
    const result = await query(
      pool,
      "UPDATE sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL",
      [id, revokedAt],
    );
    return (result.rowCount ?? 0) > 0;
  },
  revokeUserSessions: async (userId, revokedAt) => {
    const result = await query(
      pool,
      "UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL",
      [userId, revokedAt],
    );
    return result.rowCount ?? 0;
  },
  updateUser: async (id, patch) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (patch.disabled !== undefined || patch.passwordHash !== undefined) {
        await query(
          client,
          `UPDATE users
           SET disabled = COALESCE($2, disabled),
               password_hash = COALESCE($3, password_hash),
               updated_at = now()
           WHERE id = $1`,
          [id, patch.disabled ?? null, patch.passwordHash ?? null],
        );
      }
      if (patch.roles !== undefined) {
        await query(client, "DELETE FROM user_roles WHERE user_id = $1", [id]);
        for (const role of patch.roles) {
          await query(client, "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [id, role]);
        }
      }
      await client.query("COMMIT");
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const result = await query(pool, `${userSelect} WHERE u.id = $1 GROUP BY u.id`, [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row === undefined ? null : mapUser(row);
  },
});
