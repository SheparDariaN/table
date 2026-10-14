import { describe, expect, it } from "vitest";
import { healthStatusSchema } from "../src/index.js";

describe("healthStatusSchema", () => {
  it("accepts a healthy service response", () => {
    const result = healthStatusSchema.safeParse({
      service: "api",
      status: "ok",
      timestamp: "2026-01-01T00:00:00.000Z",
      version: "0.1.0",
    });
    expect(result.success).toBe(true);
  });
});
