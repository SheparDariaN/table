import { describe, expect, it } from "vitest";
import { canvases } from "../src/index.js";

describe("canvases schema", () => {
  it("declares its primary key", () => {
    expect(canvases.id.name).toBe("id");
    expect(canvases.id.primary).toBe(true);
  });
});
