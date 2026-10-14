import { describe, expect, it } from "vitest";
import { canvasId } from "../src/index.js";

describe("canvasId", () => {
  it("rejects blank identifiers", () => {
    expect(canvasId(" ")).toEqual({ error: "invalid-id", ok: false });
  });
});
