# Roll20 Character → Foundry v14 Converter

Status: Normative  
Target: Foundry VTT core **14.369**, `dnd5e` **6.0.6**, Actor type **`character`**, D&D **2014** rules

`MUST`, `SHOULD`, and `MAY` are normative. This profile does not claim compatibility with other Foundry or `dnd5e` versions.

## Implementation references

- [Source, IR, target, and report schemas](../../packages/converter-schemas/src/index.ts)
- [Normalization, mapping, emission, diagnostics, and validators](../../packages/converter-core/src/index.ts)
- [Golden, behavior, security, and property tests](../../packages/converter-core/src/index.test.ts)
- [Primary source-shape fixture](../../packages/converter-core/fixtures/primary-source-shape.roll20.json)
- [Legacy compatibility fixture](../../packages/converter-core/fixtures/synthetic-hero.roll20.json)

## 1. Contracts

The primary input is an object or `{ character }` wrapper whose character has:

```ts
interface PrimaryCharacter {
  readonly attributes: {
    readonly name?: string;
    readonly bio?: string;
    readonly gmnotes?: string;
    readonly avatar?: string;
    readonly [metadata: string]: unknown;
  };
  readonly blobDefaultToken?: string;
  readonly attribs?: readonly Roll20Attribute[];
  readonly [extension: string]: unknown;
}

interface Roll20Attribute {
  readonly name: string;
  readonly current?: string | number | boolean | null;
  readonly max?: string | number | boolean | null;
  readonly id?: string;
}
```

Primary normalization maps metadata from `character.attributes`, token JSON from `character.blobDefaultToken`, and sheet attributes from `character.attribs`. Legacy `character.name/bio/gmnotes/avatar`, `character.defaulttoken`, and array-valued `character.attributes` are secondary compatibility only. Bare character and optional `schema_version` wrapper forms are accepted. Invalid source shape is an `INVALID_SOURCE` error and conversion MUST stop.

Output is `{ actor, report }`. `actor.type` MUST be `character`; `_stats` MUST identify core `14.369`, system `dnd5e`, version `6.0.6`; report target MUST be `Foundry VTT v14 / dnd5e 6.0.6 / PC 2014`.

## 2. Normalization

- String values are trimmed; numbers and booleans become strings; nullish/unsupported values become empty.
- Attribute, section, row, and field keys are compared case-insensitively.
- Numeric parsing removes grouping commas, uses `Number.parseFloat`, and accepts every finite result, including `0`. Fallback applies only to non-finite parses; `parsed || fallback` is forbidden.
- Scalar attributes exclude `repeating_*` and `_reporder_*`.
- The `*_roll` signal MUST be detected before noise filtering. Its suffix is removed and its expression is attached to the base scalar even when that base name is normally filtered.
- Empty values do not replace non-empty values. The last non-empty duplicate wins; differing scalar values emit `SCALAR_CONFLICT`. Existing `max` and `roll` data MUST survive later partial duplicates.
- Known sheet UI/internal noise MAY be ignored: kingdom/army/kingmaker, l1mancer/mancer/lvup, `pbd_safe`, `drop_*`, `appliedupdates`, non-roll `queryadvantage`, and inventory/trait tab-toggle-display-filter-search-page-navigator fields.
- No semantically meaningful non-empty value may disappear silently. Unmapped sections/fields MUST be represented in a diagnostic with a source path; only the explicit noise set above and empty values may be ignored without one.

## 3. Repeating rows, order, and linking

`repeating_<section>_<rowId>_<field>` is grouped by normalized section and row ID; spell sections `spell-cantrip` and `spell-1`…`spell-9` are valid. Field names are normalized to lowercase.

`_reporder_repeating_<section>` is case-insensitive and supplies comma-separated row IDs. Listed rows follow that order; unlisted rows follow deterministically by row ID. Final order is section, requested order, then row ID.

Material sections are inventory, attack, spell, feat/trait, class, subclass, race, and background. Resource and proficiency rows feed actor resources/traits. Attack rows link to inventory first by normalized `itemattackid`/`itemid`/row ID, then by case-insensitive name. A linked attack becomes an activity on the inventory item and MUST NOT also emit a duplicate item. An unresolved attack remains a weapon item; unsupported meaningful rows require diagnostics.

## 4. Canonical IR boundary

Conversion is:

```text
unknown input → decoded Roll20 character → scalar/repeating indexes
→ CanonicalCharacter IR → Foundry actor → schema validation
```

`CanonicalCharacter` and nested `ItemIR`, `ActivityIR`, token, ability, skill, resource, and trait schemas are the only semantic boundary between source parsing and Foundry emission. IR MUST remain independent of Foundry runtime objects and MUST be schema-validated before emission. Emitted actor/report MUST pass `conversionResultSchema`.

The converter is deterministic and performs no network, filesystem, database, clock, locale, or random access. Input acquisition, archive handling, limits, asset transfer, and Foundry import are adapter responsibilities.

## 5. Mapping

### Identity, biography, and token

- Name defaults to `Unnamed Character`; avatar defaults to `icons/svg/mystery-man.svg`.
- Biography is sanitized `bio` plus sanitized GM notes.
- Token JSON supplies name, image, dimensions in 70-pixel grid units, disposition, name display, and vision. Invalid/non-object JSON emits `INVALID_TOKEN_JSON` and uses safe defaults.
- HP and AC bars are `attributes.hp` and `attributes.ac`; darkvision is the maximum of sheet and token vision distance.

### Abilities, saves, skills, and attributes

- STR/DEX/CON/INT/WIS/CHA use short/full/base aliases and default to 10.
- Save proficiency uses corresponding save-prof aliases.
- All 18 2014 skills map to dnd5e keys; proficiency/expertise comes from explicit fields or PB signals in retained roll expressions. Flat bonus and roll expression are preserved.
- HP/current/max/temp, flat/default AC, inspiration, exhaustion 0–6, movement modes in feet, hover, spellcasting ability/DC/attack, and darkvision map from documented aliases.

### Details, currency, resources, and traits

- Alignment, appearance, age, eyes, faith, gender, hair, height, ideals, bonds, flaws, personality, backstory, allies, skin, weight, and XP map to actor details; rich text is sanitized.
- PP/GP/EP/SP/CP use zero-safe integer parsing.
- Three scalar resource slots and repeating resource rows map to actor resources.
- Languages, armor, weapons, tools, resistances, immunities, vulnerabilities, condition immunities, and senses map from CSV/newline fields and repeating proficiency rows.

### Classes, ancestry, background, items, spells, and activities

- Scalar class/subclass/race/background become synthetic items unless an equivalent repeating item exists. Class level, hit die, and spell progression are retained.
- Inventory type selects weapon/equipment/consumable/tool/loot; feat/trait become feat; spell sections become spell.
- Quantity, equipped, weight, uses, properties, source, school, preparation, and sanitized description map when present.
- Spell level comes from explicit level or section (`cantrip` = 0).
- Attack/damage/heal/save/utility activities map activation, attack ability/bonus, damage/healing formula, save ability/DC, and spellcasting method.
- Every `system.activities` object key MUST equal that activity's `_id`.
- Empty effects, least-privilege ownership `{ default: 0 }`, source flags, and 2014-rules flags MUST be emitted.

## 6. Deterministic IDs and collisions

IDs are the first 16 hexadecimal characters of SHA-256 over `` `${seed}\0${salt}` ``. Seeds derive from normalized semantic context:

- actor: `actor:<name>`;
- item: actor ID, section, source row ID, and name;
- synthetic detail: actor ID, kind, and name;
- primary activity: item ID and activity role.

Actor, item, and activity IDs MUST be unique in one actor document. A collision is resolved deterministically by incrementing integer salt from zero and rehashing; input is never dropped or assigned a random ID. Repeated conversion of equivalent normalized input MUST produce identical IDs and ordering.

## 7. Diagnostics and modes

Diagnostics contain stable `code`, `severity`, `message`, and optional source `path`.

- **Lenient** (default): returns valid output with warnings; errors still invalidate conversion.
- **Strict**: any diagnostic, warning or error, rejects conversion with `ConversionError`.
- Source schema errors always reject.
- Current profile codes include `INVALID_SOURCE`, `SCALAR_CONFLICT`, `INVALID_TOKEN_JSON`, `ACTIVITY_VERSION_PROFILE`, `INVALID_TARGET_VERSION_PROFILE`, and `CONVERSION_FAILED`.
- Activity emission MUST produce `ACTIVITY_VERSION_PROFILE` until the exact licensed runtime smoke test has passed for the release artifact.
- Unsupported meaningful source data MUST produce a diagnostic; lenient mode may continue only when safe output remains possible.

`inspect` reports normalized counts without emission. `validate` executes conversion under the selected mode. Neither substitutes for runtime smoke testing.

## 8. Security, limits, and assets

- Rich HTML MUST remove comments, executable elements, event handlers, dangerous URL schemes, and script-bearing style values.
- Token JSON is parsed as data only; macros, scripts, hooks, formulas, and imported package code are never executed.
- The converter MUST NOT fetch remote URLs or copy assets. Avatar/token references are emitted as references or safe placeholders; an adapter may separately allowlist, size-check, MIME-sniff, content-address, and import assets.
- Ingestion MUST enforce byte, attribute-count, string-length, repeating-row, nesting, decompression, and processing-time limits before calling core.
- Archive adapters MUST reject traversal, absolute paths, links, encrypted entries, executable content, and decompression bombs.
- Logs/diagnostics MUST not echo full private biography, GM notes, token blobs, or credentials.

Core currently validates object structure and sanitizes mapped HTML; external limits and asset/archive policy remain mandatory adapter obligations.

## 9. Validation levels

`validateFoundryVersionProfile` is a structural Zod validator only. It checks required document shape, 16-character IDs, `character` type, version literals, and activity structure. It does not boot Foundry, execute dnd5e migrations, instantiate documents, prepare derived data, or render sheets.

A release runtime smoke MUST run in a legally licensed, isolated Foundry core 14.369 installation with dnd5e 6.0.6: import the emitted Actor, instantiate and prepare it without schema/migration errors, open its sheet, inspect item/activity preparation, and verify token creation. Test artifacts MUST be synthetic and the Foundry installation/license MUST NOT be redistributed.

## 10. Unsupported scope

- NPCs and vehicles.
- Multiclass characters and multiclass spell-slot semantics.
- D&D 2024 rules, mixed 2014/2024 actors, and advancement reconstruction.
- Other Roll20 sheets, custom sheet workers, macros, API scripts, compendium semantics, dynamic lighting scenes, and campaigns.
- Any Foundry core other than 14.369 or `dnd5e` version other than 6.0.6.

Unsupported input MUST fail with an error when detectable before mapping; otherwise it MUST emit a stable warning and never be silently represented as a supported equivalent.

## 11. Compatibility matrix

- Primary Roll20 character metadata/`blobDefaultToken`/`attribs` → **supported**.
- Legacy flattened metadata/`defaulttoken`/array `attributes` → **compatibility only**.
- Foundry 14.369 + dnd5e 6.0.6 + character + 2014 → **sole target**.
- Foundry activity documents → **structurally emitted; licensed runtime smoke required**.
- NPC, multiclass, and 2024 rules → **unsupported**.
- Other source sheets or target versions → **unsupported, fail closed or diagnose**.

## 12. Acceptance criteria

1. Primary and legacy fixtures decode; primary shape remains the documented default.
2. Duplicate scalars use last non-empty value, preserve `max`/`*_roll`, and diagnose conflicts.
3. `*_roll` is classified before filtering; zero parses as zero rather than fallback.
4. Repeating names/order are case-insensitive and deterministic; linked attacks do not duplicate inventory items.
5. Abilities, skills, HP/AC, details, currency, resources, traits, items, spells, activities, and token satisfy golden assertions.
6. Actor, item, and activity IDs are stable, 16-character, collision-free; every activity key equals `_id`.
7. Unsupported meaningful data has diagnostics; no semantic data is silently dropped.
8. Strict rejects every diagnostic; lenient returns safe output for warnings and never suppresses errors.
9. HTML/token security tests and deterministic/property tests pass.
10. Output passes canonical, actor, and conversion-result schemas plus the exact structural profile.
11. Release evidence records the exact licensed Foundry 14.369/dnd5e 6.0.6 runtime smoke result.
