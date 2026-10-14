import { z } from "zod";

export const TARGET = Object.freeze({
  foundry: "14",
  system: "dnd5e",
  systemVersion: "6.0.6",
  rules: "2014",
} as const);

export const roll20AttributeSchema = z
  .object({
    name: z.string(),
    current: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    max: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    id: z.string().optional(),
  })
  .passthrough();

const metadataSchema = z
  .object({
    name: z.string().optional().default("Unnamed Character"),
    bio: z.string().optional().default(""),
    gmnotes: z.string().optional().default(""),
    avatar: z.string().optional(),
  })
  .passthrough();

export const normalizedRoll20CharacterSchema = metadataSchema.extend({
  attributes: z.array(roll20AttributeSchema).default([]),
  defaulttoken: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
});

const primaryRoll20CharacterSchema = z
  .object({
    attributes: metadataSchema,
    blobDefaultToken: z.string().optional(),
    attribs: z.array(roll20AttributeSchema).default([]),
  })
  .passthrough()
  .transform((source) => ({
    ...source.attributes,
    attributes: source.attribs,
    ...(source.blobDefaultToken === undefined ? {} : { defaulttoken: source.blobDefaultToken }),
  }));

const legacyRoll20CharacterSchema = z
  .object({
    name: z.string().optional().default("Unnamed Character"),
    bio: z.string().optional().default(""),
    gmnotes: z.string().optional().default(""),
    avatar: z.string().optional(),
    attributes: z.array(roll20AttributeSchema).default([]),
    defaulttoken: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  })
  .passthrough();

export const roll20CharacterSchema = z.union([
  primaryRoll20CharacterSchema,
  legacyRoll20CharacterSchema,
]);

const bareRoll20CharacterSchema = roll20CharacterSchema.refine(
  (character) => !("character" in character),
  "A wrapped export must contain a valid character object.",
);

export const roll20WrapperSchema = z.union([
  z
    .object({
      schema_version: z.union([z.string(), z.number()]).optional(),
      character: roll20CharacterSchema,
    })
    .passthrough()
    .transform((source) => ({ character: source.character })),
  bareRoll20CharacterSchema.transform((character) => ({ character })),
]);

export type Roll20Attribute = z.infer<typeof roll20AttributeSchema>;
export type Roll20Character = z.infer<typeof normalizedRoll20CharacterSchema>;
export type Roll20Wrapper = { readonly character: Roll20Character };

export const diagnosticSchema = z.object({
  code: z.string(),
  severity: z.enum(["warning", "error"]),
  message: z.string(),
  path: z.string().optional(),
});
export type Diagnostic = z.infer<typeof diagnosticSchema>;

export const scalarValueSchema = z.object({
  value: z.string(),
  max: z.string().optional(),
  roll: z.string().optional(),
});
export type ScalarValue = z.infer<typeof scalarValueSchema>;

export const repeatingRowSchema = z.object({
  section: z.string(),
  id: z.string(),
  fields: z.record(z.string(), z.string()),
  order: z.number(),
});
export type RepeatingRow = z.infer<typeof repeatingRowSchema>;

const numericValueSchema = z.object({
  value: z.number(),
  max: z.number().optional(),
});

export const itemKindSchema = z.enum([
  "class",
  "subclass",
  "race",
  "background",
  "feat",
  "weapon",
  "equipment",
  "consumable",
  "tool",
  "loot",
  "spell",
]);
export type ItemKind = z.infer<typeof itemKindSchema>;

export const activitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["attack", "damage", "heal", "save", "utility"]),
  activation: z.string().default("action"),
  attackAbility: z.string().optional(),
  damage: z.string().optional(),
  saveAbility: z.string().optional(),
  saveDc: z.number().optional(),
  healing: z.string().optional(),
  method: z.string().optional(),
  bonus: z.string().optional(),
});
export type ActivityIR = z.infer<typeof activitySchema>;

export const itemSchema = z.object({
  id: z.string(),
  kind: itemKindSchema,
  name: z.string(),
  description: z.string().default(""),
  sourceRowId: z.string().optional(),
  quantity: z.number().default(1),
  equipped: z.boolean().default(false),
  level: z.number().optional(),
  uses: numericValueSchema.optional(),
  weight: z.number().default(0),
  properties: z.array(z.string()).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
  activities: z.array(activitySchema).default([]),
});
export type ItemIR = z.infer<typeof itemSchema>;

export const tokenSchema = z.object({
  name: z.string(),
  img: z.string().optional(),
  width: z.number().positive().default(1),
  height: z.number().positive().default(1),
  disposition: z.number().int().default(1),
  vision: z.boolean().default(true),
  displayName: z.number().int().default(20),
  displayBars: z.number().int().default(20),
  bar1: z.string().default("attributes.hp"),
  bar2: z.string().default("attributes.ac"),
  darkvision: z.number().default(0),
});

const abilitySchema = z.object({
  value: z.number(),
  proficient: z.number().int().min(0).max(2).default(0),
});

export const canonicalCharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  img: z.string(),
  biography: z.string(),
  abilities: z.record(z.enum(["str", "dex", "con", "int", "wis", "cha"]), abilitySchema),
  skills: z.record(
    z.string(),
    z.object({
      value: z.number().int().min(0).max(2),
      bonus: z.string().default(""),
      roll: z.string().default(""),
    }),
  ),
  hp: z.object({ value: z.number(), max: z.number(), temp: z.number().default(0) }),
  ac: z.object({ value: z.number(), calc: z.enum(["default", "flat"]).default("flat") }),
  inspiration: z.boolean().default(false),
  exhaustion: z.number().int().min(0).max(6).default(0),
  movement: z.object({
    walk: z.number().default(0),
    burrow: z.number().default(0),
    climb: z.number().default(0),
    fly: z.number().default(0),
    swim: z.number().default(0),
    units: z.literal("ft"),
    hover: z.boolean().default(false),
  }),
  spellcasting: z.object({
    ability: z.enum(["str", "dex", "con", "int", "wis", "cha", ""]).default(""),
    dc: z.number().optional(),
    attack: z.number().optional(),
  }),
  details: z.record(z.string(), z.string()),
  currency: z.record(z.enum(["pp", "gp", "ep", "sp", "cp"]), z.number()),
  resources: z.array(z.object({ label: z.string(), value: z.number(), max: z.number() })),
  traits: z.record(z.string(), z.array(z.string())),
  items: z.array(itemSchema),
  token: tokenSchema,
});
export type CanonicalCharacter = z.infer<typeof canonicalCharacterSchema>;

const foundryActivitySchema = z
  .object({
    _id: z.string(),
    type: z.string(),
    name: z.string(),
    activation: z.record(z.string(), z.unknown()).optional(),
    attack: z.record(z.string(), z.unknown()).optional(),
    damage: z.record(z.string(), z.unknown()).optional(),
    save: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const foundryItemSchema = z
  .object({
    _id: z.string().regex(/^[A-Za-z0-9]{16}$/),
    name: z.string(),
    type: z.string(),
    img: z.string(),
    system: z
      .object({
        description: z.object({ value: z.string() }).passthrough(),
        activities: z.record(z.string(), foundryActivitySchema),
      })
      .passthrough(),
    effects: z.array(z.unknown()),
    flags: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export const foundryActorSchema = z
  .object({
    _id: z.string().regex(/^[A-Za-z0-9]{16}$/),
    name: z.string(),
    type: z.literal("character"),
    img: z.string(),
    system: z
      .object({
        abilities: z.record(z.string(), z.record(z.string(), z.unknown())),
        attributes: z.record(z.string(), z.unknown()),
        details: z.record(z.string(), z.unknown()),
        currency: z.record(z.string(), z.number()),
        skills: z.record(z.string(), z.record(z.string(), z.unknown())),
        traits: z.record(z.string(), z.unknown()),
      })
      .passthrough(),
    items: z.array(foundryItemSchema),
    prototypeToken: z.record(z.string(), z.unknown()),
    effects: z.array(z.unknown()),
    flags: z.record(z.string(), z.unknown()),
    ownership: z.record(z.string(), z.number()),
    _stats: z
      .object({
        coreVersion: z.literal("14.369"),
        systemId: z.literal("dnd5e"),
        systemVersion: z.literal("6.0.6"),
      })
      .passthrough(),
  })
  .passthrough();
export type FoundryActor = z.infer<typeof foundryActorSchema>;

export const conversionReportSchema = z.object({
  target: z.literal("Foundry VTT v14 / dnd5e 6.0.6 / PC 2014"),
  diagnostics: z.array(diagnosticSchema),
  stats: z.object({
    attributes: z.number().int().nonnegative(),
    repeatingRows: z.number().int().nonnegative(),
    items: z.number().int().nonnegative(),
  }),
});
export type ConversionReport = z.infer<typeof conversionReportSchema>;

export const conversionResultSchema = z.object({
  actor: foundryActorSchema,
  report: conversionReportSchema,
});
export type ConversionResult = z.infer<typeof conversionResultSchema>;
