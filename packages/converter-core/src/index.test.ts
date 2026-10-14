import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  buildScalarIndex,
  convert,
  decodeRoll20,
  deterministicId,
  inspect,
  parseRepeating,
  sanitizeHtml,
  validate,
  validateFoundryVersionProfile,
} from "./index.js";

const fixturePath = fileURLToPath(
  new URL("../fixtures/synthetic-hero.roll20.json", import.meta.url),
);
const fixture = async (): Promise<unknown> =>
  JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
const primaryFixturePath = fileURLToPath(
  new URL("../fixtures/primary-source-shape.roll20.json", import.meta.url),
);
const primaryFixture = async (): Promise<unknown> =>
  JSON.parse(await readFile(primaryFixturePath, "utf8")) as unknown;

describe("golden conversion", () => {
  it("emits stable Foundry v14/dnd5e 6 actor essentials", async () => {
    const result = convert(await fixture());
    expect({
      id: result.actor._id,
      name: result.actor.name,
      type: result.actor.type,
      abilities: result.actor.system.abilities,
      hp: result.actor.system.attributes.hp,
      ac: result.actor.system.attributes.ac,
      currency: result.actor.system.currency,
      itemNames: result.actor.items.map(({ name }) => name),
      diagnostics: result.report.diagnostics.map(({ code }) => code),
    }).toMatchInlineSnapshot(`
      {
        "abilities": {
          "cha": {
            "bonuses": {
              "check": "",
              "save": "",
            },
            "proficient": 0,
            "value": 15,
          },
          "con": {
            "bonuses": {
              "check": "",
              "save": "",
            },
            "proficient": 0,
            "value": 13,
          },
          "dex": {
            "bonuses": {
              "check": "",
              "save": "",
            },
            "proficient": 0,
            "value": 14,
          },
          "int": {
            "bonuses": {
              "check": "",
              "save": "",
            },
            "proficient": 0,
            "value": 12,
          },
          "str": {
            "bonuses": {
              "check": "",
              "save": "",
            },
            "proficient": 0,
            "value": 16,
          },
          "wis": {
            "bonuses": {
              "check": "",
              "save": "",
            },
            "proficient": 0,
            "value": 10,
          },
        },
        "ac": {
          "calc": "flat",
          "flat": 15,
        },
        "currency": {
          "cp": 0,
          "ep": 0,
          "gp": 42,
          "pp": 0,
          "sp": 0,
        },
        "diagnostics": [
          "SCALAR_CONFLICT",
          "ACTIVITY_VERSION_PROFILE",
        ],
        "hp": {
          "max": 24,
          "temp": 3,
          "value": 19,
        },
        "id": "f597242c1d09cebf",
        "itemNames": [
          "Bard",
          "College of Lore",
          "Human",
          "Sage",
          "Inspiring Leader",
          "Longsword",
          "Explorer's Pack",
          "Healing Word",
        ],
        "name": "Synthetic Hero",
        "type": "character",
      }
    `);
  });
});

describe("behavior", () => {
  it("normalizes the primary metadata/blobDefaultToken/attribs contract", async () => {
    const source = await primaryFixture();
    const decoded = decodeRoll20(source);
    expect(decoded.character).toMatchObject({
      name: "Primary Shape Hero",
      avatar: "icons/svg/angel.svg",
      defaulttoken: expect.stringContaining("Primary Token"),
    });
    expect(decoded.character?.attributes).toHaveLength(35);
  });

  it("rejects an invalid wrapped character instead of treating the wrapper as a bare character", () => {
    const result = validate({ character: { attributes: "invalid" } });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toContain("INVALID_SOURCE");
  });

  it("filters sheet noise while preserving roll signals", async () => {
    const source = await primaryFixture();
    const decoded = decodeRoll20(source);
    const indexed = buildScalarIndex(decoded.character?.attributes ?? []);
    expect(indexed.values.has("kingdom_name")).toBe(false);
    expect(indexed.values.has("inventory_tab")).toBe(false);
    expect(indexed.values.get("acrobatics")?.roll).toBe("@{d20}+4");
  });

  it("filters all unsupported sheet namespaces but never a roll signal", () => {
    const blocked = [
      "kingdom_value",
      "army_value",
      "kingmaker_value",
      "l1mancer_value",
      "mancer_value",
      "appliedUpdates",
      "queryadvantage",
      "lvup_value",
      "pbd_safe",
      "drop_target",
      "inventory_navigator",
      "traits_toggle",
    ];
    const indexed = buildScalarIndex([
      ...blocked.map((name) => ({ name, current: "noise" })),
      { name: "queryadvantage_roll", current: "@{d20}" },
    ]);
    expect([...indexed.values.keys()]).toEqual(["queryadvantage"]);
    expect(indexed.values.get("queryadvantage")?.roll).toBe("@{d20}");
  });

  it("uses last non-empty scalar, retains roll and reports conflicts", () => {
    const result = buildScalarIndex([
      { name: "Strength", current: "8" },
      { name: "strength", current: "" },
      { name: "STRENGTH", current: "16" },
      { name: "strength_roll", current: "@{d20}+3" },
    ]);
    expect(result.values.get("strength")).toEqual({ value: "16", roll: "@{d20}+3" });
    expect(result.diagnostics).toHaveLength(1);
  });

  it("honors reporder and case-insensitive repeating names", () => {
    const result = parseRepeating([
      { name: "Repeating_Inventory_B_Name", current: "B" },
      { name: "repeating_inventory_A_name", current: "A" },
      { name: "_reporder_repeating_INVENTORY", current: "A,B" },
    ]);
    expect(result.rows.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("keeps activity object keys identical to _id", async () => {
    const result = convert(await fixture());
    for (const item of result.actor.items) {
      for (const [key, activity] of Object.entries(item.system.activities))
        expect(activity._id).toBe(key);
    }
  });

  it("links matching repeating attacks to inventory items", () => {
    const result = convert({
      character: {
        name: "Link Test",
        attributes: [
          { name: "repeating_inventory_item1_itemname", current: "Rapier" },
          { name: "repeating_inventory_item1_itemtype", current: "Weapon" },
          { name: "repeating_attack_atk1_atkname", current: "Rapier" },
          { name: "repeating_attack_atk1_atkattr_base", current: "dexterity" },
          { name: "repeating_attack_atk1_dmgbase", current: "1d8 + @mod" },
        ],
      },
    });
    const rapiers = result.actor.items.filter(({ name }) => name === "Rapier");
    expect(rapiers).toHaveLength(1);
    expect(Object.values(rapiers[0]?.system.activities ?? {})).toHaveLength(1);
  });

  it("maps primary-shape skills, resources, proficiencies, items and actor profile", async () => {
    const result = convert(await primaryFixture());
    expect(result.actor).toMatchObject({
      img: "icons/svg/angel.svg",
      effects: [],
      ownership: { default: 0 },
      _stats: { coreVersion: "14.369", systemId: "dnd5e", systemVersion: "6.0.6" },
      system: {
        attributes: {
          hp: { value: 10, max: 10 },
          inspiration: true,
          exhaustion: 2,
        },
        skills: { acr: { value: 2, bonuses: { check: "2" }, roll: "@{d20}+4" } },
        resources: { primary: { label: "Arcane Recovery", value: 1, max: 1 } },
      },
      prototypeToken: {
        name: "Primary Token",
        bar2: { attribute: "attributes.ac" },
        sight: { range: 60, visionMode: "darkvision" },
      },
    });
    expect(result.actor.system.traits.languages).toMatchObject({ value: ["Общий"] });
    const weapon = result.actor.items.find(({ name }) => name === "Рапира");
    expect(weapon).toMatchObject({
      type: "weapon",
      effects: [],
      system: { weight: { value: 2, units: "lb" } },
    });
    expect(Object.keys(weapon?.system.activities ?? {})).toHaveLength(1);
    expect(result.actor.items.some(({ name }) => name === "Different label")).toBe(false);
    expect(result.actor.items.find(({ name }) => name === "Light")).toMatchObject({
      type: "spell",
      system: { school: "evocation", preparation: { prepared: true } },
    });
    const ids = [
      result.actor._id,
      ...result.actor.items.flatMap((item) => [
        item._id,
        ...Object.values(item.system.activities).map(({ _id }) => _id),
      ]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[A-Za-z0-9]{16}$/.test(id))).toBe(true);
    expect(validateFoundryVersionProfile(result.actor)).toMatchObject({ valid: true });
  });

  it("exposes inspect and validate", async () => {
    const source = await fixture();
    expect(inspect(source).repeatingSections).toEqual({ feat: 1, inventory: 2, "spell-1": 1 });
    expect(validate(source).valid).toBe(true);
    expect(validate(source, { mode: "strict" }).valid).toBe(false);
  });
});

describe("security", () => {
  it("removes executable markup and attributes", () => {
    const dirty =
      '<script>alert(1)</script><img src="javascript:alert(1)" onerror=alert(2)><a href="data:text/html,x">x</a><p>safe</p>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toMatch(/script|onerror|javascript:|data:/i);
    expect(clean).toContain("<p>safe</p>");
  });

  it("does not execute or trust malformed token JSON", () => {
    const result = convert({ character: { name: "X", defaulttoken: "__proto__", attributes: [] } });
    expect(result.actor.prototypeToken.name).toBe("X");
    expect(result.report.diagnostics.map(({ code }) => code)).toContain("INVALID_TOKEN_JSON");
  });
});

describe("properties", () => {
  it("produces stable 16-character alphanumeric IDs", () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const first = deterministicId(seed);
        expect(first).toBe(deterministicId(seed));
        expect(first).toMatch(/^[A-Za-z0-9]{16}$/);
      }),
    );
  });

  it("sanitization is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (source) => {
        const once = sanitizeHtml(source);
        expect(sanitizeHtml(once)).toBe(once);
      }),
    );
  });
});
