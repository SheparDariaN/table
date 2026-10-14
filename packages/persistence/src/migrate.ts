import type { Pool } from "pg";
import { migrations } from "./migrations.js";

export const migrate = async (pool: Pool): Promise<readonly string[]> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied: string[] = [];
  for (const migration of migrations) {
    const existing = await pool.query("SELECT version FROM schema_migrations WHERE version = $1", [
      migration.version,
    ]);
    if ((existing.rowCount ?? 0) > 0) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [
        migration.version,
      ]);
      await client.query("COMMIT");
      applied.push(migration.version);
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return applied;
};
