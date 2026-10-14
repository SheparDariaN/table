import { roleSchema, type Role } from "@arcane-table/protocol";
import { z } from "zod";

export const PLUGIN_CONTRACT_VERSION = "1.0.0" as const;

export const pluginCapabilitySchema = z.enum([
  "admin.read",
  "converter",
  "navigation",
  "table.placeholder",
]);
export const pluginSlotSchema = z.enum([
  "admin.sections",
  "dashboard.widgets",
  "settings.sections",
  "table.dock",
  "table.sidebar",
  "table.toolbar",
]);
export const pluginStatusSchema = z.enum(["active", "placeholder"]);

const identifierSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

export const pluginNavigationSchema = z.object({
  id: identifierSchema,
  label: z.string().min(1),
  roles: z.array(roleSchema).min(1),
  section: z.enum(["admin", "play", "tools"]),
  to: z.string().regex(/^\/[a-z0-9\-./]*$/),
});

export const pluginRouteSchema = z.object({
  id: identifierSchema,
  path: z.string().regex(/^\/[A-Za-z0-9\-./:$]*$/),
  roles: z.array(roleSchema).min(1),
});

export const pluginManifestSchema = z.object({
  capabilities: z.array(pluginCapabilitySchema),
  contractVersion: z.literal(PLUGIN_CONTRACT_VERSION),
  id: identifierSchema,
  name: z.string().min(1),
  navigation: z.array(pluginNavigationSchema),
  routes: z.array(pluginRouteSchema),
  slots: z.array(pluginSlotSchema),
  status: pluginStatusSchema,
  version: versionSchema,
});

export type PluginCapability = z.infer<typeof pluginCapabilitySchema>;
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginNavigation = z.infer<typeof pluginNavigationSchema>;
export type PluginSlot = z.infer<typeof pluginSlotSchema>;

export type RegistryValidation =
  | { readonly errors: readonly string[]; readonly ok: false }
  | { readonly ok: true; readonly plugins: readonly PluginManifest[] };

const uniqueError = (label: string, value: string): string => `Duplicate ${label}: ${value}`;

export const validatePlugins = (input: readonly unknown[]): RegistryValidation => {
  const plugins: PluginManifest[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  const navigationIds = new Set<string>();
  const navigationPaths = new Set<string>();
  const routePaths = new Set<string>();

  for (const [index, candidate] of input.entries()) {
    const parsed = pluginManifestSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push(`Plugin ${index} is invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`);
      continue;
    }
    const plugin = parsed.data;
    if (ids.has(plugin.id)) errors.push(uniqueError("plugin id", plugin.id));
    ids.add(plugin.id);
    for (const item of plugin.navigation) {
      if (navigationIds.has(item.id)) errors.push(uniqueError("navigation id", item.id));
      navigationIds.add(item.id);
      if (navigationPaths.has(item.to)) errors.push(uniqueError("navigation path", item.to));
      navigationPaths.add(item.to);
    }
    for (const route of plugin.routes) {
      if (routePaths.has(route.path)) errors.push(uniqueError("route", route.path));
      routePaths.add(route.path);
    }
    plugins.push(plugin);
  }

  return errors.length > 0 ? { errors, ok: false } : { ok: true, plugins };
};

export const navigationForRoles = (
  plugins: readonly PluginManifest[],
  roles: readonly Role[],
): readonly PluginNavigation[] =>
  plugins.flatMap((plugin) =>
    plugin.navigation.filter((item) => item.roles.some((role) => roles.includes(role))),
  );

export const pluginsForSlot = (
  plugins: readonly PluginManifest[],
  slot: PluginSlot,
): readonly PluginManifest[] => plugins.filter((plugin) => plugin.slots.includes(slot));

const navigation = (item: PluginNavigation): PluginNavigation => item;

const coreNavigation = {
  actors: navigation({
    id: "actors",
    label: "Actors",
    roles: ["admin", "gm", "player"],
    section: "play",
    to: "/actors",
  }),
  compendium: navigation({
    id: "compendium",
    label: "Compendium",
    roles: ["admin", "gm", "player"],
    section: "play",
    to: "/compendium",
  }),
  dashboard: navigation({
    id: "dashboard",
    label: "Dashboard",
    roles: ["admin", "gm", "player"],
    section: "play",
    to: "/",
  }),
  journal: navigation({
    id: "journal",
    label: "Journal",
    roles: ["admin", "gm", "player"],
    section: "play",
    to: "/journal",
  }),
  worlds: navigation({
    id: "worlds",
    label: "Worlds",
    roles: ["admin", "gm", "player"],
    section: "play",
    to: "/worlds",
  }),
};

export const corePlugins: readonly PluginManifest[] = [
  {
    capabilities: ["navigation"],
    contractVersion: PLUGIN_CONTRACT_VERSION,
    id: "core-shell",
    name: "Core shell",
    navigation: [
      coreNavigation.dashboard,
      coreNavigation.worlds,
      coreNavigation.actors,
      coreNavigation.compendium,
      coreNavigation.journal,
    ],
    routes: [
      { id: "route-dashboard", path: "/", roles: ["admin", "gm", "player"] },
      { id: "route-worlds", path: "/worlds", roles: ["admin", "gm", "player"] },
      { id: "route-actors", path: "/actors", roles: ["admin", "gm", "player"] },
      { id: "route-compendium", path: "/compendium", roles: ["admin", "gm", "player"] },
      { id: "route-journal", path: "/journal", roles: ["admin", "gm", "player"] },
    ],
    slots: ["dashboard.widgets", "settings.sections"],
    status: "placeholder",
    version: "1.0.0",
  },
  {
    capabilities: ["table.placeholder"],
    contractVersion: PLUGIN_CONTRACT_VERSION,
    id: "core-table",
    name: "Table",
    navigation: [],
    routes: [
      { id: "route-table", path: "/table/:worldId/:sceneId", roles: ["admin", "gm", "player"] },
    ],
    slots: ["table.dock", "table.sidebar", "table.toolbar"],
    status: "placeholder",
    version: "1.0.0",
  },
  {
    capabilities: ["converter", "navigation"],
    contractVersion: PLUGIN_CONTRACT_VERSION,
    id: "core-converter",
    name: "Character converter",
    navigation: [
      {
        id: "converter",
        label: "Converter",
        roles: ["admin", "gm"],
        section: "tools",
        to: "/tools/converter",
      },
    ],
    routes: [{ id: "route-converter", path: "/tools/converter", roles: ["admin", "gm"] }],
    slots: [],
    status: "active",
    version: "1.0.0",
  },
  {
    capabilities: ["admin.read", "navigation"],
    contractVersion: PLUGIN_CONTRACT_VERSION,
    id: "core-admin",
    name: "Administration",
    navigation: [
      { id: "admin", label: "Admin", roles: ["admin"], section: "admin", to: "/admin" },
      { id: "admin-users", label: "Users", roles: ["admin"], section: "admin", to: "/admin/users" },
      {
        id: "admin-system",
        label: "System",
        roles: ["admin"],
        section: "admin",
        to: "/admin/system",
      },
      { id: "admin-audit", label: "Audit", roles: ["admin"], section: "admin", to: "/admin/audit" },
      {
        id: "admin-plugins",
        label: "Plugins",
        roles: ["admin"],
        section: "admin",
        to: "/admin/plugins",
      },
    ],
    routes: [
      { id: "route-admin", path: "/admin", roles: ["admin"] },
      { id: "route-admin-users", path: "/admin/users", roles: ["admin"] },
      { id: "route-admin-system", path: "/admin/system", roles: ["admin"] },
      { id: "route-admin-audit", path: "/admin/audit", roles: ["admin"] },
      { id: "route-admin-plugins", path: "/admin/plugins", roles: ["admin"] },
    ],
    slots: ["admin.sections"],
    status: "active",
    version: "1.0.0",
  },
];

const validatedCore = validatePlugins(corePlugins);
if (!validatedCore.ok) {
  throw new Error(validatedCore.errors.join("\n"));
}
