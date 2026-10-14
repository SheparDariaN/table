import { parseApiEnv } from "@arcane-table/config";
import { createPostgresPool, migrate } from "@arcane-table/persistence";

const env = parseApiEnv(process.env);
const pool = createPostgresPool(env.DATABASE_URL);

try {
  const applied = await migrate(pool);
  console.log(applied.length === 0 ? "No migrations applied." : `Applied: ${applied.join(", ")}`);
} finally {
  await pool.end();
}
