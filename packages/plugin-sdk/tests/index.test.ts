import { describe, expect, it } from "vitest";
import { corePlugins, navigationForRoles, validatePlugins } from "../src/index.js";

describe("plugin registry", () => {
  it("accepts the trusted core plugins", () => {
    expect(validatePlugins(corePlugins).ok).toBe(true);
  });

  it("rejects duplicate routes", () => {
    const result = validatePlugins([
      corePlugins[0],
      {
        ...corePlugins[1],
        id: "another",
        routes: [{ id: "route-dashboard", path: "/", roles: ["player"] }],
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("filters navigation by role", () => {
    const labels = navigationForRoles(corePlugins, ["player"]).map((item) => item.label);
    expect(labels).toContain("Worlds");
    expect(labels).not.toContain("Converter");
    expect(labels).not.toContain("Users");
  });
});
