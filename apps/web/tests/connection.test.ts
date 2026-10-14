import { describe, expect, it } from "vitest";
import { connectionFromQuery } from "../src/application/connection.js";

describe("connection state", () => {
  it("derives the reserved connection states", () => {
    expect(connectionFromQuery("success", true, false)).toBe("offline");
    expect(connectionFromQuery("pending", false, true)).toBe("connecting");
    expect(connectionFromQuery("error", true, true)).toBe("reconnecting");
    expect(connectionFromQuery("success", false, true)).toBe("forbidden");
    expect(connectionFromQuery("success", true, true)).toBe("live");
  });
});
