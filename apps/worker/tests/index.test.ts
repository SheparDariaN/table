import { describe, expect, it } from "vitest";
import { createWorkerDefinition } from "../src/index.js";

describe("createWorkerDefinition", () => {
  it("prepares pg-boss configuration without starting jobs", () => {
    const worker = createWorkerDefinition({
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      NODE_ENV: "test",
    });
    expect(worker.connectionString).toContain("postgres://");
  });
});
