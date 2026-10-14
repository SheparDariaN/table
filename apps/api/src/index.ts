import { parseApiEnv } from "@arcane-table/config";
import {
  createDatabaseHealthProbe,
  createPostgresAuthStore,
  createPostgresPool,
  migrate,
} from "@arcane-table/persistence";
import { createAuthService } from "./auth-service.js";
import { createApp } from "./app.js";
import { argon2Hasher } from "./passwords.js";

const blockedPasswords = new Set(["change-me-in-production", "replace-this-password"]);
const env = parseApiEnv(process.env);

if (env.NODE_ENV === "production" && blockedPasswords.has(env.BOOTSTRAP_ADMIN_PASSWORD)) {
  console.error("Refusing to start with a placeholder bootstrap admin password.");
  process.exit(1);
}

const pool = createPostgresPool(env.DATABASE_URL);
const authStore = createPostgresAuthStore(pool);
const secureCookies = env.NODE_ENV === "production";
const app = createApp({
  authStore,
  password: argon2Hasher,
  readiness: createDatabaseHealthProbe(pool),
  secureCookies,
  sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
});

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
  await migrate(pool);
  const auth = createAuthService(
    authStore,
    argon2Hasher,
    () => new Date(),
    () => crypto.randomUUID(),
    env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    { allow: () => true },
  );
  await auth.bootstrapAdmin(env.BOOTSTRAP_ADMIN_USERNAME, env.BOOTSTRAP_ADMIN_PASSWORD);
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error: unknown) {
  app.log.error(error);
  process.exitCode = 1;
}
