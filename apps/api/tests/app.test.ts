import { createMemoryAuthStore } from "@arcane-table/persistence";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, type AppOptions } from "../src/app.js";

const apps: Array<ReturnType<typeof createApp>> = [];
const password = {
  hash: async (value: string) => `hash:${value}`,
  verify: async (passwordHash: string, value: string) => passwordHash === `hash:${value}`,
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const createTestApp = async (): Promise<ReturnType<typeof createApp>> => {
  const authStore = createMemoryAuthStore();
  await authStore.insertUser({
    id: "11111111-1111-4111-8111-111111111111",
    passwordHash: "hash:correct-password",
    roles: ["admin"],
    username: "admin",
  });
  await authStore.insertUser({
    id: "22222222-2222-4222-8222-222222222222",
    passwordHash: "hash:correct-password",
    roles: ["player"],
    username: "player",
  });
  const options: AppOptions = { authStore, password };
  const app = createApp(options);
  apps.push(app);
  return app;
};

const login = async (app: ReturnType<typeof createApp>, username: string) => {
  const response = await app.inject({
    method: "POST",
    payload: { password: "correct-password", username },
    url: "/v1/auth/login",
  });
  const body = response.json() as { csrfToken: string };
  const cookie = response.headers["set-cookie"];
  return {
    cookie: Array.isArray(cookie) ? cookie.join(";") : String(cookie),
    csrfToken: body.csrfToken,
  };
};

describe("health routes", () => {
  it("reports liveness", async () => {
    const app = createApp();
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: "api", status: "ok" });
  });

  it("reports unavailable dependencies", async () => {
    const app = createApp({ readiness: async () => false });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
  });
});

describe("authorization", () => {
  it("accepts login from any browser origin", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      headers: { host: "localhost", origin: "http://localhost:5173" },
      method: "POST",
      payload: { password: "correct-password", username: "admin" },
      url: "/v1/auth/login",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ authenticated: true, user: { username: "admin" } });
  });

  it("rejects anonymous conversion", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      payload: { character: { attributes: { name: "API Hero" }, attribs: [] } },
      url: "/v1/conversions/roll20-foundry",
    });
    expect(response.statusCode).toBe(401);
  });

  it("lets an admin convert and denies a player", async () => {
    const app = await createTestApp();
    const admin = await login(app, "admin");
    const converted = await app.inject({
      headers: { cookie: admin.cookie, "x-csrf-token": admin.csrfToken },
      method: "POST",
      payload: {
        character: {
          attributes: { name: "API Hero" },
          attribs: [{ current: "14", name: "strength" }],
        },
      },
      url: "/v1/conversions/roll20-foundry",
    });
    expect(converted.statusCode).toBe(200);
    expect(converted.json()).toMatchObject({ actor: { name: "API Hero", type: "character" } });

    const player = await login(app, "player");
    const denied = await app.inject({
      headers: { cookie: player.cookie, "x-csrf-token": player.csrfToken },
      method: "POST",
      payload: { character: { attributes: { name: "Hidden" }, attribs: [] } },
      url: "/v1/conversions/roll20-foundry",
    });
    expect(denied.statusCode).toBe(403);
  });

  it("creates a user and writes a redacted audit event", async () => {
    const app = await createTestApp();
    const admin = await login(app, "admin");
    const created = await app.inject({
      headers: { cookie: admin.cookie, "x-csrf-token": admin.csrfToken },
      method: "POST",
      payload: { password: "another-password", roles: ["gm"], username: "guide" },
      url: "/v1/admin/users",
    });
    expect(created.statusCode).toBe(201);
    expect(JSON.stringify(created.json())).not.toContain("another-password");

    const audit = await app.inject({
      headers: { cookie: admin.cookie },
      method: "GET",
      url: "/v1/admin/audit?action=admin.user.created",
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json()).toMatchObject({
      items: [{ action: "admin.user.created", details: { username: "guide" } }],
    });
    expect(JSON.stringify(audit.json())).not.toContain("hash:");
  });
});
