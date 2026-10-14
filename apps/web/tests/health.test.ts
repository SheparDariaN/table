import { healthStatusSchema } from "@arcane-table/protocol";
import { describe, expect, it } from "vitest";

describe("health contract", () => {
  it("rejects an unsupported status", () => {
    expect(
      healthStatusSchema.safeParse({
        service: "api",
        status: "unknown",
        timestamp: new Date().toISOString(),
        version: "0.1.0",
      }).success,
    ).toBe(false);
  });
});
