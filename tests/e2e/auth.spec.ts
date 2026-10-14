import { expect, test } from "@playwright/test";

const password = process.env.E2E_ADMIN_PASSWORD;

test("login page is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("admin can create a GM and that GM can download a conversion", async ({ page, request }) => {
  test.skip(
    password === undefined,
    "Set E2E_ADMIN_PASSWORD when the API and database are running.",
  );
  const adminPassword = password ?? "";
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Welcome, admin/ })).toBeVisible();
  await page.goto("/admin/users");
  await page.getByLabel("Username").fill("guide");
  await page.getByLabel("Password").fill("guide-password");
  await page.getByLabel("Role").selectOption("gm");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("cell", { name: "guide" })).toBeVisible();
  await page.getByRole("button", { name: "admin" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByLabel("Username").fill("guide");
  await page.getByLabel("Password").fill("guide-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/tools/converter");
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.getByRole("button", { name: "Convert" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download actor.json" }).click();
  expect((await download).suggestedFilename()).toBe("actor.json");
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Unauthorized" })).toBeVisible();
  const session = await request.get("/api/v1/auth/session");
  expect(session.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome, guide/ })).toBeVisible();
});
