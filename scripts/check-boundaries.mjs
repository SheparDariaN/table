import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageRoot = join(root, "packages");
const sourceExtensions = new Set([".ts", ".tsx"]);
const packageNames = new Map(
  readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = join(packageRoot, entry.name);
      const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      return [manifest.name, { directory, dependencies: new Set() }];
    }),
);

const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      return entry.name === "node_modules" || entry.name === "dist" ? [] : files(path);
    return sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf("."))) ? [path] : [];
  });

const importPattern = /(?:from\s+|import\s*)["'](@arcane-table\/[^"']+)["']/g;
for (const [name, metadata] of packageNames) {
  const source = join(metadata.directory, "src");
  for (const path of files(source)) {
    for (const match of readFileSync(path, "utf8").matchAll(importPattern)) {
      const dependency = match[1];
      if (dependency && packageNames.has(dependency)) metadata.dependencies.add(dependency);
    }
  }
  if (name === "@arcane-table/domain" && metadata.dependencies.size > 0) {
    throw new Error(
      `Domain must not depend on workspace packages: ${[...metadata.dependencies].join(", ")}`,
    );
  }
}

const visiting = new Set();
const visited = new Set();
const visit = (name, path = []) => {
  if (visiting.has(name))
    throw new Error(`Workspace dependency cycle: ${[...path, name].join(" -> ")}`);
  if (visited.has(name)) return;
  visiting.add(name);
  const metadata = packageNames.get(name);
  for (const dependency of metadata?.dependencies ?? []) visit(dependency, [...path, name]);
  visiting.delete(name);
  visited.add(name);
};

for (const name of packageNames.keys()) visit(name);
console.log(
  `Validated boundaries for ${packageNames.size} packages from ${relative(process.cwd(), packageRoot)}.`,
);
