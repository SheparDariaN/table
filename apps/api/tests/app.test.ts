import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const apps: Array<ReturnType<typeof createApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

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

describe("conversion route", () => {
  it("converts the primary Roll20 source shape", async () => {
    const app = createApp();
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/conversions/roll20-foundry",
      payload: {
        character: {
          attributes: { name: "API Hero" },
          attribs: [{ name: "strength", current: "14" }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      actor: {
        name: "API Hero",
        type: "character",
        _stats: { coreVersion: "14.369", systemVersion: "6.0.6" },
      },
    });
  });

  it("returns typed diagnostics for invalid input", async () => {
    const app = createApp();
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/conversions/roll20-foundry",
      payload: { character: { attributes: "invalid" } },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: "CONVERSION_REJECTED" });
  });
});
