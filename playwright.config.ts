import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5173" },
  webServer: {
    command: "corepack pnpm --filter @arcane-table/web dev --host 127.0.0.1 --port 5173",
    reuseExistingServer: true,
    url: "http://127.0.0.1:5173",
  },
});
