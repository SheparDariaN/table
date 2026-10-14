import { createHash } from "node:crypto";
import {
  type CanonicalCharacter,
  canonicalCharacterSchema,
  type ConversionReport,
  type ConversionResult,
  conversionResultSchema,
  type Diagnostic,
  diagnosticSchema,
  type FoundryActor,
  foundryActorSchema,
  type ItemIR,
  type ItemKind,
  type RepeatingRow,
  type Roll20Attribute,
  type Roll20Character,
  roll20WrapperSchema,
  type ScalarValue,
} from "@arcane-table/converter-schemas";
import type { z } from "zod";

export type ConversionMode = "strict" | "lenient";
export interface ConversionOptions {
  readonly mode?: ConversionMode;
}
export interface Inspection {
  readonly characterName: string;
  readonly attributeCount: number;
  readonly scalarCount: number;
  readonly repeatingSections: Readonly<Record<string, number>>;
  readonly diagnostics: readonly Diagnostic[];
}
export interface ValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly Diagnostic[];
}
export interface VersionProfileValidation {
  readonly profile: "Foundry VTT 14.369 / dnd5e 6.0.6 structural";
  readonly valid: boolean;
  readonly diagnostics: readonly Diagnostic[];
}
export type ConversionError = Error & { readonly diagnostics: readonly Diagnostic[] };

const text = (value: unknown): string =>
  typeof value === "string"
    ? value.trim()
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";
const lower = (value: string): string => value.trim().toLowerCase();
const finite = (value: unknown, fallback = 0): number => {
  const parsed = Number.parseFloat(text(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const integer = (value: unknown, fallback = 0): number => Math.trunc(finite(value, fallback));
const truthy = (value: unknown): boolean =>
  ["1", "true", "on", "yes", "checked", "proficient", "2"].includes(lower(text(value)));

const issueDiagnostics = (error: z.ZodError): Diagnostic[] =>
  error.issues.map((issue) => ({
    code: "INVALID_SOURCE",
    severity: "error",
    message: issue.message,
    path: issue.path.join("."),
  }));

export const decodeRoll20 = (
  input: unknown,
): { readonly character?: Roll20Character; readonly diagnostics: Diagnostic[] } => {
  const decoded = roll20WrapperSchema.safeParse(input);
  return decoded.success
    ? { character: decoded.data.character as Roll20Character, diagnostics: [] }
    : { diagnostics: issueDiagnostics(decoded.error) };
};

export const sanitizeHtml = (unsafe: string): string =>
  unsafe
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s+(href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript|data):[\s\S]*?\2/gi,
      "",
    )
    .replace(
      /\s+style\s*=\s*(["'])[\s\S]*?(?:expression\s*\(|url\s*\(\s*['"]?\s*javascript:)[\s\S]*?\1/gi,
      "",
    )
    .trim();

const nonEmpty = (value: unknown): string | undefined => {
  const normalized = text(value);
  return normalized.length > 0 ? normalized : undefined;
};

export const buildScalarIndex = (
  attributes: readonly Roll20Attribute[],
): { readonly values: ReadonlyMap<string, ScalarValue>; readonly diagnostics: Diagnostic[] } => {
  const values = new Map<string, ScalarValue>();
  const diagnostics: Diagnostic[] = [];
  for (const attribute of attributes) {
    const rawName = lower(attribute.name);
    if (!rawName || rawName.startsWith("repeating_") || rawName.startsWith("_reporder_")) continue;
    const isRoll = rawName.endsWith("_roll");
    if (!isRoll && isFilteredAttribute(rawName)) continue;
    const name = isRoll ? rawName.slice(0, -5) : rawName;
    const value = nonEmpty(attribute.current);
    if (!value) continue;
    const existing = values.get(name);
    if (existing && existing.value !== value && !isRoll) {
      diagnostics.push({
        code: "SCALAR_CONFLICT",
        severity: "warning",
        message: `Conflicting values for "${name}"; the last non-empty value was selected.`,
        path: `attributes.${attribute.name}`,
      });
    }
    values.set(name, {
      value: isRoll ? (existing?.value ?? "") : value,
      ...(nonEmpty(attribute.max)
        ? { max: nonEmpty(attribute.max) }
        : existing?.max
          ? { max: existing.max }
          : {}),
      ...(isRoll ? { roll: value } : existing?.roll ? { roll: existing.roll } : {}),
    });
  }
  return { values, diagnostics };
};

const isFilteredAttribute = (name: string): boolean =>
  /^(?:kingdom_|army_|kingmaker_|l1mancer_|mancer_|lvup_|pbd_safe|drop_|appliedupdates$|queryadvantage$)/i.test(
    name,
  ) ||
  /^(?:inventory|traits?)(?:_tab|_toggle|_show|_hide|_display|_filter|_search|_page|_navigator)/i.test(
    name,
  );

const repeatingPattern = /^repeating_((?:spell-(?:cantrip|[1-9]))|[^_]+)_([^_]+)_(.+)$/i;
export const parseRepeating = (
  attributes: readonly Roll20Attribute[],
): { readonly rows: RepeatingRow[]; readonly diagnostics: Diagnostic[] } => {
  const grouped = new Map<
    string,
    { section: string; id: string; fields: Record<string, string> }
  >();
  const orders = new Map<string, readonly string[]>();
  for (const attribute of attributes) {
    const name = attribute.name.trim();
    const orderMatch = /^_reporder_repeating_(.+)$/i.exec(name);
    if (orderMatch?.[1]) {
      orders.set(
        lower(orderMatch[1]),
        text(attribute.current).split(",").map(lower).filter(Boolean),
      );
      continue;
    }
    const match = repeatingPattern.exec(name);
    if (!match?.[1] || !match[2] || !match[3]) continue;
    const section = lower(match[1]);
    if (isFilteredAttribute(section)) continue;
    const id = lower(match[2]);
    const key = `${section}\0${id}`;
    const row = grouped.get(key) ?? { section, id, fields: {} };
    const value = nonEmpty(attribute.current);
    if (value) row.fields[lower(match[3])] = value;
    grouped.set(key, row);
  }
  const rows = [...grouped.values()]
    .map((row) => {
      const requested = orders.get(row.section) ?? [];
      const requestedIndex = requested.indexOf(row.id);
      return { ...row, order: requestedIndex < 0 ? Number.MAX_SAFE_INTEGER : requestedIndex };
    })
    .sort(
      (a, b) => a.section.localeCompare(b.section) || a.order - b.order || a.id.localeCompare(b.id),
    )
    .map((row, index) => ({ ...row, order: index }));
  return { rows, diagnostics: [] };
};

export const deterministicId = (seed: string, salt = 0): string =>
  createHash("sha256").update(`${seed}\0${salt}`).digest("hex").slice(0, 16);

const assignUniqueIds = (seeds: readonly string[]): string[] => {
  const used = new Set<string>();
  return seeds.map((seed) => {
    let salt = 0;
    let candidate = deterministicId(seed, salt);
    while (used.has(candidate)) candidate = deterministicId(seed, ++salt);
    used.add(candidate);
    return candidate;
  });
};

const ensureDocumentIds = (actorId: string, items: readonly ItemIR[]): ItemIR[] => {
  const used = new Set<string>([actorId]);
  const allocate = (seed: string): string => {
    let salt = 0;
    let candidate = seed;
    while (used.has(candidate)) candidate = deterministicId(seed, ++salt);
    used.add(candidate);
    return candidate;
  };
  return items.map((item) => {
    const id = allocate(item.id);
    return {
      ...item,
      id,
      activities: item.activities.map((activity) => ({ ...activity, id: allocate(activity.id) })),
    };
  });
};

const scalar = (index: ReadonlyMap<string, ScalarValue>, ...names: readonly string[]): string => {
  for (const name of names) {
    const found = index.get(lower(name))?.value;
    if (found) return found;
  }
  return "";
};

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_NAMES: Readonly<Record<(typeof ABILITIES)[number], string>> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};
const SKILLS: Readonly<Record<string, readonly string[]>> = {
  acr: ["acrobatics"],
  ani: ["animal_handling", "animalhandling"],
  arc: ["arcana"],
  ath: ["athletics"],
  dec: ["deception"],
  his: ["history"],
  ins: ["insight"],
  itm: ["intimidation"],
  inv: ["investigation"],
  med: ["medicine"],
  nat: ["nature"],
  prc: ["perception"],
  prf: ["performance"],
  per: ["persuasion"],
  rel: ["religion"],
  slt: ["sleight_of_hand", "sleightofhand"],
  ste: ["stealth"],
  sur: ["survival"],
};

const proficiency = (value: string): number => {
  const normalized = lower(value);
  if (normalized === "2" || normalized.includes("expert") || normalized.includes("эксперт"))
    return 2;
  return truthy(value) || normalized.includes("profic") || normalized.includes("владен") ? 1 : 0;
};

const skillData = (
  index: ReadonlyMap<string, ScalarValue>,
  aliases: readonly string[],
): CanonicalCharacter["skills"][string] => {
  const names = aliases.flatMap((name) => [`${name}_prof`, `${name}_proficiency`, `${name}_type`]);
  const base = aliases.map((name) => index.get(name)).find(Boolean);
  const roll = aliases.map((name) => index.get(name)?.roll).find(Boolean) ?? base?.roll ?? "";
  const explicit = proficiency(scalar(index, ...names));
  const rollProficiency =
    /(?:2\s*\*?\s*@?\{?(?:pb|proficiency_bonus)|(?:pb|proficiency_bonus).*2)/i.test(roll)
      ? 2
      : /(?:pb|proficiency_bonus)/i.test(roll)
        ? 1
        : 0;
  return {
    value: explicit || rollProficiency,
    bonus: scalar(index, ...aliases.flatMap((name) => [`${name}_flat`, `${name}_bonus`])),
    roll,
  };
};

const csv = (value: string): string[] =>
  value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

const repeatingProficiencies = (
  rows: readonly RepeatingRow[],
): Readonly<{ languages: string[]; armor: string[]; weapons: string[]; tools: string[] }> =>
  rows
    .filter(({ section }) => /proficien/.test(section))
    .reduce(
      (result, { fields }) => {
        const name = fields.name ?? fields.proficiency ?? fields.prof_name ?? "";
        const type = lower(fields.type ?? fields.prof_type ?? "");
        if (!name) return result;
        if (/(language|язык)/.test(type)) result.languages.push(name);
        else if (/(armor|брон)/.test(type)) result.armor.push(name);
        else if (/(weapon|оруж)/.test(type)) result.weapons.push(name);
        else result.tools.push(name);
        return result;
      },
      {
        languages: [] as string[],
        armor: [] as string[],
        weapons: [] as string[],
        tools: [] as string[],
      },
    );

const itemKind = (section: string, fields: Readonly<Record<string, string>>): ItemKind => {
  if (section.includes("spell")) return "spell";
  if (section.includes("attack")) return "weapon";
  if (section.includes("inventory")) {
    const type = lower(fields.itemtype ?? fields.type ?? "");
    if (/(weapon|оруж)/.test(type)) return "weapon";
    if (/(armor|armour|equipment|брон|экип)/.test(type)) return "equipment";
    if (/(consum|расход)/.test(type)) return "consumable";
    if (/(tool|инструмент)/.test(type)) return "tool";
    return "loot";
  }
  if (section.includes("feat") || section.includes("trait")) return "feat";
  return "feat";
};

const activityType = (
  fields: Readonly<Record<string, string>>,
): "attack" | "damage" | "heal" | "save" | "utility" => {
  if (fields.atkflag || fields.attack_flag || fields.atkattr_base) return "attack";
  if (/(heal|леч)/.test(lower(fields.dmgtype ?? fields.healing ?? ""))) return "heal";
  if (fields.savedc || fields.saveattr) return "save";
  if (fields.dmgbase || fields.dmg1) return "damage";
  return "utility";
};

const rowName = (row: RepeatingRow): string =>
  row.fields.name ??
  row.fields.itemname ??
  row.fields.spellname ??
  row.fields.atkname ??
  row.fields.traitname ??
  "Unnamed Item";

const spellLevel = (row: RepeatingRow): number => {
  const explicit = row.fields.spelllevel ?? row.fields.level;
  if (explicit) return Math.max(0, integer(explicit));
  if (row.section === "spell-cantrip") return 0;
  const sectionLevel = /^spell-([1-9])$/.exec(row.section)?.[1];
  return sectionLevel ? integer(sectionLevel) : 0;
};

const rowsToItems = (rows: readonly RepeatingRow[], actorSeed: string): ItemIR[] => {
  const material = rows
    .filter((row) =>
      /^(inventory|attack|spell|feat|trait|class|subclass|race|background)/i.test(row.section),
    )
    .map((row) => ({ row, name: rowName(row) }));
  const ids = assignUniqueIds(
    material.map(({ row, name }) => `${actorSeed}:item:${row.section}:${row.id}:${name}`),
  );
  const emitted = material.map(({ row, name }, index) => {
    const id = ids[index] ?? deterministicId(`${actorSeed}:${row.id}`);
    const kind = itemKind(row.section, row.fields);
    const hasActivity =
      kind === "spell" ||
      row.section.includes("attack") ||
      Boolean(row.fields.dmgbase || row.fields.dmg1 || row.fields.atkflag);
    const activities = hasActivity
      ? [
          {
            id: deterministicId(`${id}:activity:primary`),
            name,
            type: activityType(row.fields),
            activation: row.fields.activation ?? row.fields.spellcastingtime ?? "action",
            ...(row.fields.atkattr_base
              ? { attackAbility: lower(row.fields.atkattr_base).slice(0, 3) }
              : {}),
            ...(row.fields.dmgbase || row.fields.dmg1
              ? { damage: row.fields.dmgbase ?? row.fields.dmg1 ?? "" }
              : {}),
            ...(row.fields.saveattr ? { saveAbility: lower(row.fields.saveattr).slice(0, 3) } : {}),
            ...(row.fields.savedc ? { saveDc: integer(row.fields.savedc) } : {}),
            ...(row.fields.healing || /(heal|леч)/.test(lower(row.fields.dmgtype ?? ""))
              ? { healing: row.fields.healing ?? row.fields.dmgbase ?? row.fields.dmg1 ?? "" }
              : {}),
            ...(row.fields.spellcastingmethod ? { method: row.fields.spellcastingmethod } : {}),
            ...(row.fields.atkmod ? { bonus: row.fields.atkmod } : {}),
          },
        ]
      : [];
    return {
      id,
      kind,
      name,
      description: sanitizeHtml(
        [
          row.fields.itemcontent ?? row.fields.spelldescription ?? row.fields.description ?? "",
          row.fields.spellhldie
            ? `<p><strong>At Higher Levels:</strong> ${row.fields.spellhldie}</p>`
            : "",
        ].join(""),
      ),
      sourceRowId: row.id,
      quantity: Math.max(0, integer(row.fields.itemcount ?? row.fields.quantity, 1)),
      equipped: truthy(row.fields.equipped ?? row.fields.itemequipped),
      weight: Math.max(0, finite(row.fields.itemweight ?? row.fields.weight)),
      ...(kind === "spell" ? { level: spellLevel(row) } : {}),
      ...(row.fields.uses || row.fields.itemcount
        ? {
            uses: {
              value: integer(row.fields.uses ?? row.fields.itemcount),
              ...(row.fields.uses_max ? { max: integer(row.fields.uses_max) } : {}),
            },
          }
        : {}),
      properties: csv(row.fields.properties ?? row.fields.options ?? ""),
      data: {
        source: row.fields.source ?? row.fields.featsource ?? "",
        school: lower(row.fields.spellschool ?? row.fields.school ?? ""),
        preparation: {
          mode: lower(row.fields.spellcastingmethod ?? row.fields.preparationmode ?? "prepared"),
          prepared: truthy(row.fields.spellprepared ?? row.fields.prepared),
        },
        itemId: lower(row.fields.itemid ?? row.fields.itemattackid ?? row.id),
      },
      activities,
    };
  });
  const links = material.flatMap(({ row, name }, attackIndex) => {
    if (!row.section.includes("attack")) return [];
    const attackLink = lower(row.fields.itemattackid ?? row.fields.itemid ?? "");
    const inventoryIndex = material.findIndex(
      (candidate) =>
        candidate.row.section.includes("inventory") &&
        ((attackLink.length > 0 &&
          [candidate.row.fields.itemid, candidate.row.fields.itemattackid, candidate.row.id]
            .map((value) => lower(value ?? ""))
            .includes(attackLink)) ||
          lower(candidate.name) === lower(name)),
    );
    return inventoryIndex < 0 ? [] : [{ attackIndex, inventoryIndex }];
  });
  const linkedAttackIndices = new Set(links.map(({ attackIndex }) => attackIndex));
  return emitted.flatMap((item, index) => {
    if (linkedAttackIndices.has(index)) return [];
    const linkedActivities = links
      .filter(({ inventoryIndex }) => inventoryIndex === index)
      .flatMap(({ attackIndex }) => emitted[attackIndex]?.activities ?? []);
    return [{ ...item, activities: [...item.activities, ...linkedActivities] }];
  });
};

const syntheticDetailItems = (
  index: ReadonlyMap<string, ScalarValue>,
  actorSeed: string,
): ItemIR[] => {
  const specs: readonly { kind: ItemKind; name: string; keys: readonly string[] }[] = [
    {
      kind: "class",
      name: scalar(index, "class", "class_display"),
      keys: ["class", "class_display"],
    },
    { kind: "subclass", name: scalar(index, "subclass"), keys: ["subclass"] },
    { kind: "race", name: scalar(index, "race_display", "race"), keys: ["race_display", "race"] },
    { kind: "background", name: scalar(index, "background"), keys: ["background"] },
  ];
  return specs
    .filter(({ name }) => Boolean(name))
    .map(({ kind, name, keys }) => ({
      id: deterministicId(`${actorSeed}:detail:${kind}:${name}`),
      kind,
      name,
      description: "",
      quantity: 1,
      equipped: false,
      weight: 0,
      ...(kind === "class"
        ? { level: Math.max(1, integer(scalar(index, "level", "base_level"), 1)) }
        : {}),
      properties: [...keys],
      data:
        kind === "class"
          ? {
              hd: scalar(index, "hit_dice", "class_hit_die") || "d8",
              progression:
                scalar(index, "spellcasting_progression", "caster_progression") || "none",
            }
          : {},
      activities: [],
    }));
};

const safeToken = (
  source: unknown,
  fallbackName: string,
  avatar: string | undefined,
  darkvision: number,
  diagnostics: Diagnostic[],
): CanonicalCharacter["token"] => {
  let value: Readonly<Record<string, unknown>> = {};
  if (typeof source === "string" && source.trim()) {
    try {
      const parsed: unknown = JSON.parse(source);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
        value = parsed as Record<string, unknown>;
      else throw new Error("Token JSON must be an object.");
    } catch {
      diagnostics.push({
        code: "INVALID_TOKEN_JSON",
        severity: "warning",
        message: "defaulttoken was not valid object JSON and was ignored.",
        path: "character.defaulttoken",
      });
    }
  } else if (typeof source === "object" && source !== null && !Array.isArray(source)) {
    value = source as Record<string, unknown>;
  }
  const image = text(value.imgsrc ?? value.img ?? avatar);
  return {
    name: text(value.name) || fallbackName,
    ...(image ? { img: image } : {}),
    width: Math.max(1, finite(value.width, 70) / 70),
    height: Math.max(1, finite(value.height, 70) / 70),
    disposition: integer(value.represents ? 1 : value.disposition, 1),
    vision: value.has_bright_light_vision !== false,
    displayName: integer(value.showname, 20),
    displayBars: 20,
    bar1: "attributes.hp",
    bar2: "attributes.ac",
    darkvision: Math.max(darkvision, finite(value.night_vision_distance ?? value.light_radius)),
  };
};

const toCanonical = (
  character: Roll20Character,
  diagnostics: Diagnostic[],
): { readonly canonical: CanonicalCharacter; readonly rowCount: number } => {
  const indexed = buildScalarIndex(character.attributes);
  diagnostics.push(...indexed.diagnostics);
  const repeating = parseRepeating(character.attributes);
  diagnostics.push(...repeating.diagnostics);
  const name = character.name.trim() || "Unnamed Character";
  const actorId = deterministicId(`actor:${name}`);
  const abilities = Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      {
        value: integer(
          scalar(
            indexed.values,
            ability,
            ABILITY_NAMES[ability],
            `${ability}_base`,
            `${ABILITY_NAMES[ability]}_base`,
          ),
          10,
        ),
        proficient: truthy(
          scalar(indexed.values, `${ability}_save_prof`, `${ability}_save_proficient`),
        )
          ? 1
          : 0,
      },
    ]),
  ) as CanonicalCharacter["abilities"];
  const skills = Object.fromEntries(
    Object.entries(SKILLS).map(([key, aliases]) => [key, skillData(indexed.values, aliases)]),
  );
  const hpValue = integer(scalar(indexed.values, "hp", "hit_points"), 10);
  const hpMax = integer(
    indexed.values.get("hp")?.max ?? scalar(indexed.values, "hp_max", "hp"),
    hpValue,
  );
  const rowItems = rowsToItems(repeating.rows, actorId);
  const itemKeys = new Set(rowItems.map((item) => `${item.kind}:${lower(item.name)}`));
  const detailItems = syntheticDetailItems(indexed.values, actorId).filter(
    (item) => !itemKeys.has(`${item.kind}:${lower(item.name)}`),
  );
  const repeatingProfs = repeatingProficiencies(repeating.rows);
  const canonical: CanonicalCharacter = {
    id: actorId,
    name,
    img: character.avatar || "icons/svg/mystery-man.svg",
    biography: sanitizeHtml(
      `${character.bio}${character.gmnotes ? `<hr><p>${character.gmnotes}</p>` : ""}`,
    ),
    abilities,
    skills,
    hp: {
      value: hpValue,
      max: hpMax,
      temp: integer(scalar(indexed.values, "hp_temp", "temp_hp")),
    },
    ac: {
      value: integer(scalar(indexed.values, "ac", "armor_class"), 10),
      calc:
        scalar(indexed.values, "ac_calc", "armor_class_calc") === "default" ? "default" : "flat",
    },
    inspiration: truthy(scalar(indexed.values, "inspiration")),
    exhaustion: Math.min(
      6,
      Math.max(0, integer(scalar(indexed.values, "exhaustion", "exhaustion_level"))),
    ),
    movement: {
      walk: finite(scalar(indexed.values, "speed", "speed_base", "walk")),
      burrow: finite(scalar(indexed.values, "burrow_speed", "burrow")),
      climb: finite(scalar(indexed.values, "climb_speed", "climb")),
      fly: finite(scalar(indexed.values, "fly_speed", "fly")),
      swim: finite(scalar(indexed.values, "swim_speed", "swim")),
      units: "ft",
      hover: truthy(scalar(indexed.values, "hover")),
    },
    spellcasting: {
      ability: (ABILITIES.find((ability) =>
        lower(scalar(indexed.values, "spellcasting_ability", "spellcastingability")).includes(
          ability,
        ),
      ) ?? "") as CanonicalCharacter["spellcasting"]["ability"],
      ...(scalar(indexed.values, "spell_save_dc", "spell_save_dc_mod")
        ? { dc: integer(scalar(indexed.values, "spell_save_dc", "spell_save_dc_mod")) }
        : {}),
      ...(scalar(indexed.values, "spell_attack_bonus")
        ? { attack: integer(scalar(indexed.values, "spell_attack_bonus")) }
        : {}),
    },
    details: {
      alignment: scalar(indexed.values, "alignment"),
      appearance: scalar(indexed.values, "character_appearance", "appearance"),
      age: scalar(indexed.values, "age"),
      eyes: scalar(indexed.values, "eyes"),
      faith: scalar(indexed.values, "faith"),
      gender: scalar(indexed.values, "gender"),
      hair: scalar(indexed.values, "hair"),
      height: scalar(indexed.values, "height"),
      ideals: scalar(indexed.values, "ideals"),
      bonds: scalar(indexed.values, "bonds"),
      flaws: scalar(indexed.values, "flaws"),
      personality: scalar(indexed.values, "personality_traits", "personality"),
      backstory: sanitizeHtml(scalar(indexed.values, "backstory")),
      allies: sanitizeHtml(scalar(indexed.values, "allies_and_organizations", "allies")),
      skin: scalar(indexed.values, "skin"),
      weight: scalar(indexed.values, "weight"),
      xp: scalar(indexed.values, "experience", "xp"),
    },
    currency: Object.fromEntries(
      (["pp", "gp", "ep", "sp", "cp"] as const).map((coin) => [
        coin,
        integer(scalar(indexed.values, coin)),
      ]),
    ) as CanonicalCharacter["currency"],
    resources: [
      ...(["class_resource", "other_resource", "resource3"] as const)
        .map((key, position) => ({
          label: scalar(indexed.values, `${key}_name`) || `Resource ${position + 1}`,
          value: integer(scalar(indexed.values, key)),
          max: integer(indexed.values.get(key)?.max ?? scalar(indexed.values, `${key}_max`)),
        }))
        .filter(
          (resource) =>
            resource.value !== 0 || resource.max !== 0 || !resource.label.startsWith("Resource "),
        ),
      ...repeating.rows
        .filter(({ section }) => section === "resource")
        .map(({ fields }) => ({
          label: fields.resource_name ?? fields.name ?? "Resource",
          value: integer(fields.resource_left ?? fields.current ?? fields.value),
          max: integer(fields.resource_max ?? fields.max),
        })),
    ],
    traits: {
      languages: [...csv(scalar(indexed.values, "languages")), ...repeatingProfs.languages],
      armor: [
        ...csv(scalar(indexed.values, "armor_proficiencies", "armor_prof")),
        ...repeatingProfs.armor,
      ],
      weapons: [
        ...csv(scalar(indexed.values, "weapon_proficiencies", "weapon_prof")),
        ...repeatingProfs.weapons,
      ],
      tools: [
        ...csv(scalar(indexed.values, "tool_proficiencies", "tool_prof")),
        ...repeatingProfs.tools,
      ],
      damageResistances: csv(scalar(indexed.values, "damage_resistances")),
      damageImmunities: csv(scalar(indexed.values, "damage_immunities")),
      damageVulnerabilities: csv(scalar(indexed.values, "damage_vulnerabilities")),
      conditionImmunities: csv(scalar(indexed.values, "condition_immunities")),
      senses: csv(scalar(indexed.values, "senses")),
    },
    items: ensureDocumentIds(actorId, [...detailItems, ...rowItems]),
    token: safeToken(
      character.defaulttoken,
      name,
      character.avatar,
      finite(scalar(indexed.values, "darkvision", "darkvision_distance")),
      diagnostics,
    ),
  };
  return { canonical: canonicalCharacterSchema.parse(canonical), rowCount: repeating.rows.length };
};

const itemType: Readonly<Record<ItemKind, string>> = {
  class: "class",
  subclass: "subclass",
  race: "race",
  background: "background",
  feat: "feat",
  weapon: "weapon",
  equipment: "equipment",
  consumable: "consumable",
  tool: "tool",
  loot: "loot",
  spell: "spell",
};

const emitItem = (item: ItemIR): FoundryActor["items"][number] => {
  const activities = Object.fromEntries(
    item.activities.map((activity) => [
      activity.id,
      {
        _id: activity.id,
        type: activity.type,
        name: activity.name,
        activation: { type: activity.activation, value: 1, condition: "" },
        ...(activity.attackAbility
          ? {
              attack: {
                ability: activity.attackAbility,
                bonus: activity.bonus ?? "",
                critical: { threshold: null },
              },
            }
          : {}),
        ...(activity.damage
          ? { damage: { parts: [{ number: null, denomination: null, bonus: activity.damage }] } }
          : {}),
        ...(activity.healing
          ? { healing: { number: null, denomination: null, bonus: activity.healing } }
          : {}),
        ...(activity.saveAbility
          ? {
              save: {
                ability: [activity.saveAbility],
                dc: { calculation: "", formula: String(activity.saveDc ?? "") },
              },
            }
          : {}),
        ...(activity.method ? { method: activity.method } : {}),
      },
    ]),
  );
  return {
    _id: item.id,
    name: item.name,
    type: itemType[item.kind],
    img: "icons/svg/item-bag.svg",
    system: {
      description: { value: item.description, chat: "" },
      quantity: item.quantity,
      equipped: item.equipped,
      level: item.level ?? 0,
      uses: item.uses ?? { value: null, max: "" },
      properties: item.properties,
      weight: { value: item.weight, units: "lb" },
      ...item.data,
      activities,
    },
    effects: [],
    flags: {
      "arcane-table": { source: "roll20", sourceRowId: item.sourceRowId ?? null, rules: "2014" },
    },
  };
};

export const emitFoundryActor = (character: CanonicalCharacter): FoundryActor =>
  foundryActorSchema.parse({
    _id: character.id,
    name: character.name,
    type: "character",
    img: character.img,
    system: {
      abilities: Object.fromEntries(
        Object.entries(character.abilities).map(([key, ability]) => [
          key,
          {
            value: ability.value,
            proficient: ability.proficient,
            bonuses: { check: "", save: "" },
          },
        ]),
      ),
      skills: Object.fromEntries(
        Object.entries(character.skills).map(([key, skill]) => [
          key,
          {
            value: skill.value,
            ability: "",
            bonuses: { check: skill.bonus, passive: "" },
            roll: skill.roll,
          },
        ]),
      ),
      attributes: {
        hp: character.hp,
        ac: { flat: character.ac.value, calc: character.ac.calc },
        inspiration: character.inspiration,
        exhaustion: character.exhaustion,
        movement: character.movement,
        spellcasting: character.spellcasting.ability,
        spelldc: character.spellcasting.dc ?? null,
      },
      details: {
        ...character.details,
        biography: { value: character.biography, public: "" },
        level: character.items
          .filter((item) => item.kind === "class")
          .reduce((sum, item) => sum + (item.level ?? 0), 0),
      },
      currency: character.currency,
      resources: Object.fromEntries(
        character.resources.map((resource, index) => [`primary${index || ""}`, resource]),
      ),
      traits: Object.fromEntries(
        Object.entries(character.traits).map(([key, values]) => [
          key,
          { value: values, custom: "" },
        ]),
      ),
      bonuses: {
        spell: {
          attack:
            character.spellcasting.attack === undefined
              ? ""
              : String(character.spellcasting.attack),
          damage: "",
        },
      },
    },
    items: character.items.map(emitItem),
    effects: [],
    prototypeToken: {
      name: character.token.name,
      texture: { src: character.token.img ?? "icons/svg/mystery-man.svg", scaleX: 1, scaleY: 1 },
      width: character.token.width,
      height: character.token.height,
      disposition: character.token.disposition,
      displayName: character.token.displayName,
      displayBars: character.token.displayBars,
      bar1: { attribute: character.token.bar1 },
      bar2: { attribute: character.token.bar2 },
      sight: {
        enabled: character.token.vision,
        range: character.token.darkvision,
        angle: 360,
        visionMode: character.token.darkvision > 0 ? "darkvision" : "basic",
      },
      actorLink: true,
    },
    flags: {
      "arcane-table": {
        source: "roll20",
        target: "Foundry VTT v14 / dnd5e 6.0.6 / PC 2014",
      },
    },
    ownership: { default: 0 },
    _stats: {
      coreVersion: "14.369",
      systemId: "dnd5e",
      systemVersion: "6.0.6",
      createdTime: null,
      modifiedTime: null,
      lastModifiedBy: null,
    },
  });

const failIfStrict = (diagnostics: readonly Diagnostic[], mode: ConversionMode): void => {
  if (mode === "strict" && diagnostics.length > 0) {
    throw conversionError("Strict conversion rejected diagnostics.", diagnostics);
  }
};

export const convert = (input: unknown, options: ConversionOptions = {}): ConversionResult => {
  const mode = options.mode ?? "lenient";
  const decoded = decodeRoll20(input);
  if (!decoded.character) throw conversionError("Invalid Roll20 export.", decoded.diagnostics);
  const diagnostics = [...decoded.diagnostics];
  const { canonical, rowCount } = toCanonical(decoded.character, diagnostics);
  if (canonical.items.some(({ activities }) => activities.length > 0)) {
    diagnostics.push({
      code: "ACTIVITY_VERSION_PROFILE",
      severity: "warning",
      message:
        "Activities were emitted by the explicit dnd5e 6.0.6 structural profile; Foundry runtime validation was not performed.",
    });
  }
  failIfStrict(diagnostics, mode);
  const report: ConversionReport = {
    target: "Foundry VTT v14 / dnd5e 6.0.6 / PC 2014",
    diagnostics,
    stats: {
      attributes: decoded.character.attributes.length,
      repeatingRows: rowCount,
      items: canonical.items.length,
    },
  };
  return conversionResultSchema.parse({ actor: emitFoundryActor(canonical), report });
};

export const inspect = (input: unknown): Inspection => {
  const decoded = decodeRoll20(input);
  if (!decoded.character) {
    return {
      characterName: "",
      attributeCount: 0,
      scalarCount: 0,
      repeatingSections: {},
      diagnostics: decoded.diagnostics,
    };
  }
  const indexed = buildScalarIndex(decoded.character.attributes);
  const repeating = parseRepeating(decoded.character.attributes);
  return {
    characterName: decoded.character.name,
    attributeCount: decoded.character.attributes.length,
    scalarCount: indexed.values.size,
    repeatingSections: Object.fromEntries(
      [...new Set(repeating.rows.map((row) => row.section))].map((section) => [
        section,
        repeating.rows.filter((row) => row.section === section).length,
      ]),
    ),
    diagnostics: [...decoded.diagnostics, ...indexed.diagnostics, ...repeating.diagnostics],
  };
};

export const validate = (input: unknown, options: ConversionOptions = {}): ValidationResult => {
  try {
    const result = convert(input, options);
    return {
      valid: !result.report.diagnostics.some(({ severity }) => severity === "error"),
      diagnostics: result.report.diagnostics,
    };
  } catch (error: unknown) {
    return isConversionError(error)
      ? { valid: false, diagnostics: error.diagnostics }
      : {
          valid: false,
          diagnostics: [
            diagnosticSchema.parse({
              code: "CONVERSION_FAILED",
              severity: "error",
              message: error instanceof Error ? error.message : "Unknown conversion failure.",
            }),
          ],
        };
  }
};

export const validateFoundryVersionProfile = (actor: unknown): VersionProfileValidation => {
  const parsed = foundryActorSchema.safeParse(actor);
  return parsed.success
    ? {
        profile: "Foundry VTT 14.369 / dnd5e 6.0.6 structural",
        valid: true,
        diagnostics: [],
      }
    : {
        profile: "Foundry VTT 14.369 / dnd5e 6.0.6 structural",
        valid: false,
        diagnostics: issueDiagnostics(parsed.error).map((diagnostic) => ({
          ...diagnostic,
          code: "INVALID_TARGET_VERSION_PROFILE",
        })),
      };
};

const conversionError = (message: string, diagnostics: readonly Diagnostic[]): ConversionError =>
  Object.assign(new Error(message), { name: "ConversionError", diagnostics });

const isConversionError = (error: unknown): error is ConversionError =>
  error instanceof Error &&
  "diagnostics" in error &&
  Array.isArray((error as { readonly diagnostics?: unknown }).diagnostics);
