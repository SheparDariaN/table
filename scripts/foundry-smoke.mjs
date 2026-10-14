import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const runner = process.env.FOUNDRY_SMOKE_RUNNER;
if (!runner) {
  console.error(
    "FOUNDRY_SMOKE_RUNNER must point to a licensed Foundry 14.369/dnd5e 6.0.6 smoke runner.",
  );
  process.exit(2);
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), "arcane-foundry-smoke-"));
const actorPath = join(temporaryDirectory, "actor.json");
const fixturePath = resolve("packages/converter-core/fixtures/primary-source-shape.roll20.json");

try {
  execFileSync(
    process.execPath,
    ["apps/converter-cli/dist/index.js", "convert", fixturePath, "--output", actorPath],
    { stdio: "inherit" },
  );
  const actor = JSON.parse(readFileSync(actorPath, "utf8"));
  if (actor?._stats?.coreVersion !== "14.369" || actor?._stats?.systemVersion !== "6.0.6") {
    throw new Error("Generated actor does not match the licensed smoke target.");
  }

  const output = execFileSync(runner, [actorPath], { encoding: "utf8" });
  const result = JSON.parse(output);
  if (
    result?.imported !== true ||
    !Array.isArray(result?.migrationWarnings) ||
    result.migrationWarnings.length > 0 ||
    result?.sheetOpened !== true ||
    result?.tokenCreated !== true
  ) {
    throw new Error(`Foundry smoke failed: ${JSON.stringify(result)}`);
  }
  console.log("Foundry licensed runtime smoke passed.");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
