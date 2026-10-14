import { parseApiEnv } from "@arcane-table/config";
import { createDatabaseHealthProbe, createPostgresPool } from "@arcane-table/persistence";
import { createApp } from "./app.js";

const env = parseApiEnv(process.env);
const pool = createPostgresPool(env.DATABASE_URL);
const app = createApp({ readiness: createDatabaseHealthProbe(pool) });

app.addHook("onClose", async () => {
  await pool.end();
});

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, "shutting down");
  await app.close();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error: unknown) {
  app.log.error(error);
  process.exitCode = 1;
}
