import { createPostgresAuthStore, createPostgresPool, migrate } from "@arcane-table/persistence";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthService } from "../src/auth-service.js";
import { createApp } from "../src/app.js";

describe("postgres auth", () => {
  const password = {
    hash: async (value: string) => `hash:${value}`,
    verify: async (passwordHash: string, value: string) => passwordHash === `hash:${value}`,
  };
  let container: Awaited<ReturnType<PostgreSqlContainer["start"]>> | undefined;
  let app: ReturnType<typeof createApp> | undefined;
  let pool: ReturnType<typeof createPostgresPool> | undefined;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17.6-alpine3.22").start();
    pool = createPostgresPool(container.getConnectionUri());
    await migrate(pool);
    const store = createPostgresAuthStore(pool);
    const auth = createAuthService(
      store,
      password,
      () => new Date(),
      () => crypto.randomUUID(),
      60_000,
      {
        allow: () => true,
      },
    );
    await auth.bootstrapAdmin("admin", "correct-password");
    app = createApp({ authStore: store, password, sessionTtlMs: 60_000 });
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    await container?.stop();
  });

  it("bootstraps one admin and enforces unique usernames", async () => {
    if (app === undefined) throw new Error("Database was not started.");
    const login = await app.inject({
      method: "POST",
      payload: { password: "correct-password", username: "admin" },
      url: "/v1/auth/login",
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers["set-cookie"]);
    const csrfToken = (login.json() as { csrfToken: string }).csrfToken;
    const duplicate = await app.inject({
      headers: { cookie, "x-csrf-token": csrfToken },
      method: "POST",
      payload: { password: "correct-password", roles: ["player"], username: "admin" },
      url: "/v1/admin/users",
    });
    expect(duplicate.statusCode).toBe(409);
  });
});
