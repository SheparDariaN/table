#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { convert, inspect, validate, type ConversionMode } from "@arcane-table/converter-core";

type Command = "convert" | "validate" | "inspect";
interface Arguments {
  readonly command: Command;
  readonly input: string;
  readonly output?: string;
  readonly report?: string;
  readonly mode: ConversionMode;
}

const usage = (): string =>
  [
    "Usage:",
    "  arcane-convert convert <input.json> [--output actor.json] [--report report.json] [--strict]",
    "  arcane-convert validate <input.json> [--report report.json] [--strict]",
    "  arcane-convert inspect <input.json> [--output inspection.json]",
  ].join("\n");

const parseArgs = (args: readonly string[]): Arguments => {
  const [rawCommand, input, ...flags] = args;
  if (!["convert", "validate", "inspect"].includes(rawCommand ?? "") || !input)
    throw new Error(usage());
  const readFlag = (name: string): string | undefined => {
    const index = flags.indexOf(name);
    if (index < 0) return undefined;
    const value = flags[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.\n${usage()}`);
    return value;
  };
  const unknown = flags.filter(
    (value, index) =>
      value.startsWith("--") &&
      !["--strict", "--output", "--report"].includes(value) &&
      flags[index - 1] !== "--output" &&
      flags[index - 1] !== "--report",
  );
  if (unknown.length > 0) throw new Error(`Unknown option: ${unknown[0]}\n${usage()}`);
  const output = readFlag("--output");
  const report = readFlag("--report");
  return {
    command: rawCommand as Command,
    input,
    ...(output ? { output } : {}),
    ...(report ? { report } : {}),
    mode: flags.includes("--strict") ? "strict" : "lenient",
  };
};

const loadJson = async (path: string): Promise<unknown> => {
  const source = await readFile(resolve(path), "utf8");
  try {
    return JSON.parse(source) as unknown;
  } catch (error: unknown) {
    throw new Error(
      `Invalid JSON in ${path}: ${error instanceof Error ? error.message : "unknown parse error"}`,
    );
  }
};

const printOrWrite = async (value: unknown, output: string | undefined): Promise<void> => {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (output) await writeFile(resolve(output), json, "utf8");
  else process.stdout.write(json);
};

const main = async (): Promise<number> => {
  let args: Arguments;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : usage()}\n`);
    return 2;
  }
  try {
    const input = await loadJson(args.input);
    if (args.command === "inspect") {
      await printOrWrite(inspect(input), args.output);
      return 0;
    }
    if (args.command === "validate") {
      const result = validate(input, { mode: args.mode });
      await printOrWrite(result, args.report ?? args.output);
      return result.valid ? 0 : 1;
    }
    const result = convert(input, { mode: args.mode });
    await printOrWrite(result.actor, args.output);
    if (args.report) await printOrWrite(result.report, args.report);
    return result.report.diagnostics.some(({ severity }) => severity === "error") ? 1 : 0;
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : "Conversion failed."}\n`);
    return 1;
  }
};

process.exitCode = await main();
