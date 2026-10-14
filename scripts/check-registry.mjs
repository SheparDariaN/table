import { readFileSync } from "node:fs";

const expectedRegistry = "https://npm-mirror.gitverse.ru/";
const npmrc = readFileSync(new URL("../.npmrc", import.meta.url), "utf8");
const configuredRegistry = /^registry=(.+)$/m.exec(npmrc)?.[1]?.trim();
const actualRegistry = configuredRegistry ? new URL(configuredRegistry).href : "";

if (actualRegistry !== expectedRegistry) {
  console.error(`Expected pnpm registry ${expectedRegistry}, received ${actualRegistry}`);
  process.exitCode = 1;
} else {
  console.log(`Using ${actualRegistry}`);
}
