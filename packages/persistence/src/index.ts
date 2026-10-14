import type { CanvasId } from "@arcane-table/domain";
import { drizzle } from "drizzle-orm/node-postgres";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { Pool } from "pg";

export const canvases = pgTable("canvases", {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  snapshot: jsonb("snapshot").notNull().default({}),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

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
  const database = drizzle(pool, { schema: { canvases } });
  return {
    findById: async (id) => {
      const record = await database.query.canvases.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      });
      return record === undefined ? null : { ...record, id: record.id as CanvasId };
    },
  };
};
