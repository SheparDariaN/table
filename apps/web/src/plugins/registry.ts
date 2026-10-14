import {
  corePlugins as trustedPlugins,
  validatePlugins,
  type PluginManifest,
} from "@arcane-table/plugin-sdk";

const validated = validatePlugins(trustedPlugins);
if (!validated.ok) throw new Error(validated.errors.join("\n"));

export const corePlugins: readonly PluginManifest[] = validated.plugins;
