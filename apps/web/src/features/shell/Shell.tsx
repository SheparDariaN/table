import { navigationForRoles } from "@arcane-table/plugin-sdk";
import { sessionResponseSchema, type PublicUser } from "@arcane-table/protocol";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { connectionFromQuery } from "../../application/connection.js";
import { sessionQuery } from "../../application/session.js";
import { useUiStore } from "../../application/ui-store.js";
import { apiRequest, setCsrfToken } from "../../infrastructure/http.js";
import { corePlugins } from "../../plugins/registry.js";

export const AppShell = (): ReactNode => {
  const query = useQuery(sessionQuery);
  const user = query.data?.user ?? null;
  const connection = connectionFromQuery(query.status, user !== null, navigator.onLine);
  const navOpen = useUiStore((state) => state.navOpen);
  const toggleNav = useUiStore((state) => state.toggleNav);
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("/v1/auth/logout", sessionResponseSchema, { method: "POST" });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: async (session) => {
      setCsrfToken(null);
      queryClient.setQueryData(sessionQuery.queryKey, session);
      await navigate({ to: "/login" });
    },
  });
  if (user === null) return null;
  const items = navigationForRoles(corePlugins, user.roles);
  return (
    <div className={`shell ${navOpen ? "nav-open" : ""}`}>
      <header className="topbar">
        <button
          aria-expanded={navOpen}
          aria-label="Toggle navigation"
          className="button ghost"
          onClick={toggleNav}
          type="button"
        >
          <Menu aria-hidden="true" size={18} />
        </button>
        <strong>Arcane Table</strong>
        <span className={`connection ${connection}`}>{connection}</span>
        <UserMenu onSignOut={() => signOut.mutate()} user={user} />
      </header>
      <nav aria-label="Primary" className="sidebar">
        {items.map((item) => (
          <a
            aria-current={pathname === item.to ? "page" : undefined}
            href={item.to}
            key={item.id}
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
              )
                return;
              event.preventDefault();
              router.history.push(item.to);
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
      {/* biome-ignore lint/correctness/useUniqueElementIds: skip-link target for the signed-in shell */}
      <main id="content">
        <Outlet />
      </main>
    </div>
  );
};

const UserMenu = ({
  onSignOut,
  user,
}: {
  readonly onSignOut: () => void;
  readonly user: PublicUser;
}): ReactNode => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger className="button ghost">{user.username}</DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="menu">
        <DropdownMenu.Item asChild>
          <a href="/settings/profile">Profile</a>
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onSignOut}>Sign out</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);
