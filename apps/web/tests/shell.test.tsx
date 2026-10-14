import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../src/app/router.js";

const player = {
  authenticated: true,
  contractVersion: "1",
  csrfToken: "csrf-token",
  user: {
    disabled: false,
    id: "22222222-2222-4222-8222-222222222222",
    roles: ["player"],
    username: "player",
  },
};

const renderApp = (path: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [path] }));
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("navigation", () => {
  it("shows the login form before a session exists", async () => {
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("hides converter and admin navigation from a player", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(player), { status: 200 })),
    );
    renderApp("/");
    const navigation = await screen.findByRole("navigation", { name: "Primary" });
    expect(within(navigation).getByRole("link", { name: "Worlds" })).toBeTruthy();
    expect(within(navigation).queryByRole("link", { name: "Converter" })).toBeNull();
    expect(within(navigation).queryByRole("link", { name: "Users" })).toBeNull();
  });
});
