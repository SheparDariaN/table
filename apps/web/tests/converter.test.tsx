import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../src/app/router.js";

const admin = {
  authenticated: true,
  contractVersion: "1",
  csrfToken: "csrf-token",
  user: {
    disabled: false,
    id: "11111111-1111-4111-8111-111111111111",
    roles: ["admin"],
    username: "admin",
  },
};

const converted = {
  actor: { items: [], name: "Sample Ranger", type: "character" },
  report: {
    diagnostics: [],
    stats: { attributes: 2, items: 0, repeatingRows: 0 },
    target: "Foundry VTT v14 / dnd5e 6.0.6 / PC 2014",
  },
};

const renderConverter = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: ["/tools/converter"] }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("converter page", () => {
  it("shows invalid JSON without sending it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(admin), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderConverter();
    const user = userEvent.setup();
    fireEvent.change(await screen.findByLabelText("Roll20 JSON"), { target: { value: "{" } });
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(fetchMock.mock.calls.some((call) => String(call.at(0)).includes("conversions"))).toBe(
      false,
    );
    expect(localStorage.length).toBe(0);
  });

  it("downloads a converted actor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response(JSON.stringify(String(input).includes("conversions") ? converted : admin), {
            status: 200,
          }),
      ),
    );
    const clicks: string[] = [];
    URL.createObjectURL = vi.fn(() => "blob:actor");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    renderConverter();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Load sample" }));
    await user.click(screen.getByRole("button", { name: "Convert" }));
    await user.click(await screen.findByRole("button", { name: "Download actor.json" }));
    expect(clicks).toContain("actor.json");
    expect(localStorage.length).toBe(0);
  });

  it("rejects an oversized file before conversion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(admin), { status: 200 })),
    );
    renderConverter();
    await screen.findByRole("heading", { name: "Character converter" });
    const input = document.querySelector("input[type=file]");
    if (!(input instanceof HTMLInputElement)) throw new Error("File input was not rendered.");
    const file = new File([new Uint8Array(1_000_001)], "hero.json", { type: "application/json" });
    await userEvent.upload(input, file);
    expect(await screen.findByText("File exceeds the 1 MB client limit.")).toBeTruthy();
  });
});
