import { test, expect } from "@playwright/test";

// E2E regression suite for PROJ-1 — covers the public / unauthenticated surface,
// i18n, form validation and route protection. Auth happy-path flows (sign-up,
// invite acceptance) depend on real email delivery and are verified manually
// (and by the SQL-level RLS security suite documented in the feature spec).

test.describe("PROJ-1 Auth & Multi-Tenant", () => {
  test("unauthenticated root redirects to localized login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/de\/login/);
  });

  test("protected route redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/de/dashboard");
    await expect(page).toHaveURL(/\/de\/login/);
  });

  test("German login page renders password + magic-link options", async ({
    page,
  }) => {
    await page.goto("/de/login");
    await expect(
      page.getByText("Willkommen zurück bei RiskGuard."),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Passwort" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Magic Link" })).toBeVisible();
    await expect(page.getByLabel("E-Mail")).toBeVisible();
  });

  test("English locale renders translated login", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByText("Welcome back to RiskGuard.")).toBeVisible();
  });

  test("login form validates empty input", async ({ page }) => {
    await page.goto("/de/login");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByLabel("E-Mail")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("magic-link tab shows the send button", async ({ page }) => {
    await page.goto("/de/login");
    await page.getByRole("tab", { name: "Magic Link" }).click();
    await expect(
      page.getByRole("button", { name: "Magic Link senden" }),
    ).toBeVisible();
  });

  test("reset-password page renders", async ({ page }) => {
    await page.goto("/de/reset-password");
    await expect(
      page.getByRole("button", { name: "Reset-Link senden" }),
    ).toBeVisible();
  });

  test("accept-invite without a token shows the invalid message", async ({
    page,
  }) => {
    await page.goto("/de/accept-invite");
    await expect(
      page.getByText("Diese Einladung ist ungültig oder abgelaufen."),
    ).toBeVisible();
  });

  test("theme toggle is available on the login page", async ({ page }) => {
    await page.goto("/de/login");
    await expect(
      page.getByRole("button", { name: "Design wechseln" }),
    ).toBeVisible();
  });
});
