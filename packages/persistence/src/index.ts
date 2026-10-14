import type { CanvasId } from "@arcane-table/domain";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { canvases as canvasTable } from "./schema.js";

export {
  auditEvents,
  canvases,
  sessions,
  userRoles,
  users,
} from "./schema.js";
export { migrate } from "./migrate.js";
export {
  createMemoryAuthStore,
  createPostgresAuthStore,
  sanitizeAuditDetails,
} from "./auth-store.js";
export type {
  AuthStore,
  NewAuditEvent,
  NewSession,
  NewUser,
  Page,
  PageQuery,
  StoredAudit,
  StoredSession,
  StoredUser,
  UserPatch,
} from "./auth-store.js";

export type CanvasRecord = Readonly<{
  createdAt: Date;
  id: CanvasId;
  name: string;
  snapshot: unknown;
  updatedAt: Date;
}>;

export type CanvasRepository = Readonly<{
  findById: (id: CanvasId) => Promise<CanvasRecord | null>;
}>;

export const createPostgresPool = (connectionString: string): Pool =>
  new Pool({ connectionString, max: 10 });

export const createDatabaseHealthProbe =
  (pool: Pool): (() => Promise<boolean>) =>
  async () => {
    try {
      await pool.query("select 1");
      return true;
    } catch {
      return false;
    }
  };

export const createCanvasRepository = (pool: Pool): CanvasRepository => {
  const database = drizzle(pool, { schema: { canvases: canvasTable } });
  return {
    findById: async (id) => {
      const record = await database.query.canvases.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      });
      return record === undefined ? null : { ...record, id: record.id as CanvasId };
    },
  };
};
