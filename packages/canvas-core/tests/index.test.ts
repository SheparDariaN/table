import { describe, expect, it } from "vitest";
import { hitTestCircle, screenToWorld, worldToScreen } from "../src/index.js";

describe("coordinates", () => {
  it("round-trips through a viewport", () => {
    const viewport = { offset: { x: 10, y: 20 }, scale: 2 };
    expect(screenToWorld(worldToScreen({ x: 4, y: 6 }, viewport), viewport)).toEqual({
      x: 4,
      y: 6,
    });
  });

  it("hit-tests a circle boundary", () => {
    expect(hitTestCircle({ x: 3, y: 4 }, { center: { x: 0, y: 0 }, radius: 5 })).toBe(true);
  });
});
