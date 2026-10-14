import { describe, expect, it } from "vitest";
import { parseApiEnv } from "../src/index.js";

describe("parseApiEnv", () => {
  it("parses defaults and coerces the port", () => {
    expect(
      parseApiEnv({ DATABASE_URL: "postgres://app:app@localhost:5432/app", PORT: "4000" }),
    ).toEqual({
      BOOTSTRAP_ADMIN_PASSWORD: "change-me-in-production",
      BOOTSTRAP_ADMIN_USERNAME: "admin",
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      HOST: "0.0.0.0",
      NODE_ENV: "development",
      PORT: 4000,
      SESSION_TTL_HOURS: 12,
    });
  });
});
