import { sessionResponseSchema } from "@arcane-table/protocol";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { LoginPage, UnauthorizedPage } from "../features/auth/LoginPage.js";
import {
  AdminHomePage,
  AuditPage,
  PluginsPage,
  SystemPage,
  UsersPage,
} from "../features/admin/AdminPages.js";
import { DashboardPage } from "../features/dashboard/DashboardPage.js";
import { ConverterPage } from "../features/converter/ConverterPage.js";
import { ModulePage } from "../features/placeholders/ModulePage.js";
import { ProfilePage } from "../features/settings/ProfilePage.js";
import { AppShell } from "../features/shell/Shell.js";
import { TablePage } from "../features/table/TablePage.js";
import { sessionQuery } from "../application/session.js";

type RouterContext = Readonly<{ queryClient: QueryClient }>;

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <Outlet />
    </>
  ),
});

const loginRoute = createRoute({
  component: LoginPage,
  getParentRoute: () => rootRoute,
  path: "/login",
});

const unauthorizedRoute = createRoute({
  component: UnauthorizedPage,
  getParentRoute: () => rootRoute,
  path: "/unauthorized",
});

const authenticatedRoute = createRoute({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!sessionResponseSchema.safeParse(session).success || session.user === null)
      throw redirect({ to: "/login" });
    return { user: session.user };
  },
  getParentRoute: () => rootRoute,
  id: "_authenticated",
});

const shellRoute = createRoute({
  component: AppShell,
  getParentRoute: () => authenticatedRoute,
  id: "shell",
});

const requireRoles =
  (roles: readonly string[]) =>
  async ({
    context,
  }: {
    readonly context: { readonly user: { readonly roles: readonly string[] } };
  }) => {
    if (!roles.some((role) => context.user.roles.includes(role)))
      throw redirect({ to: "/unauthorized" });
  };

const dashboardRoute = createRoute({
  component: DashboardPage,
  getParentRoute: () => shellRoute,
  path: "/",
});
const worldsRoute = createRoute({
  component: () => (
    <ModulePage
      capabilities={["World list", "Membership"]}
      description="Worlds will group scenes, actors, and journals."
      permissions="Any signed-in role"
      title="Worlds"
    />
  ),
  getParentRoute: () => shellRoute,
  path: "worlds",
});
const worldRoute = createRoute({
  component: () => (
    <ModulePage
      capabilities={["Overview", "Members", "Scenes"]}
      description="A world overview will host tabs supplied by plugins."
      permissions="World member"
      title="World"
    />
  ),
  getParentRoute: () => shellRoute,
  path: "worlds/$worldId",
});
const actorsRoute = createRoute({
  component: () => (
    <ModulePage
      capabilities={["Actor list", "Actor detail"]}
      description="Character sheets are not implemented in this release."
      permissions="Any signed-in role, with GM-only fields filtered by the server"
      title="Actors"
    />
  ),
  getParentRoute: () => shellRoute,
  path: "actors",
});
const compendiumRoute = createRoute({
  component: () => (
    <ModulePage
      capabilities={["Compendium packs"]}
      description="Reference content will be loaded from an authoritative source later."
      permissions="Any signed-in role"
      title="Compendium"
    />
  ),
  getParentRoute: () => shellRoute,
  path: "compendium",
});
const journalRoute = createRoute({
  component: () => (
    <ModulePage
      capabilities={["Journal entries"]}
      description="Journal pages are reserved and currently empty."
      permissions="Any signed-in role"
      title="Journal"
    />
  ),
  getParentRoute: () => shellRoute,
  path: "journal",
});
const converterRoute = createRoute({
  beforeLoad: requireRoles(["admin", "gm"]),
  component: ConverterPage,
  getParentRoute: () => shellRoute,
  path: "tools/converter",
});
const profileRoute = createRoute({
  component: ProfilePage,
  getParentRoute: () => shellRoute,
  path: "settings/profile",
});
const adminRoute = createRoute({
  beforeLoad: requireRoles(["admin"]),
  component: () => <Outlet />,
  getParentRoute: () => shellRoute,
  path: "admin",
});
const adminIndexRoute = createRoute({
  component: AdminHomePage,
  getParentRoute: () => adminRoute,
  path: "/",
});
const adminUsersRoute = createRoute({
  component: UsersPage,
  getParentRoute: () => adminRoute,
  path: "users",
});
const adminAuditRoute = createRoute({
  component: AuditPage,
  getParentRoute: () => adminRoute,
  path: "audit",
});
const adminPluginsRoute = createRoute({
  component: PluginsPage,
  getParentRoute: () => adminRoute,
  path: "plugins",
});
const adminSystemRoute = createRoute({
  component: SystemPage,
  getParentRoute: () => adminRoute,
  path: "system",
});
const tableRoute = createRoute({
  component: TablePage,
  getParentRoute: () => authenticatedRoute,
  path: "table/$worldId/$sceneId",
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  unauthorizedRoute,
  authenticatedRoute.addChildren([
    shellRoute.addChildren([
      dashboardRoute,
      worldsRoute,
      worldRoute,
      actorsRoute,
      compendiumRoute,
      journalRoute,
      converterRoute,
      profileRoute,
      adminRoute.addChildren([
        adminIndexRoute,
        adminUsersRoute,
        adminAuditRoute,
        adminPluginsRoute,
        adminSystemRoute,
      ]),
    ]),
    tableRoute,
  ]),
]);

export const createAppRouter = (queryClient: QueryClient, history?: RouterHistory) =>
  createRouter({
    context: { queryClient },
    routeTree,
    ...(history === undefined ? {} : { history }),
  });
