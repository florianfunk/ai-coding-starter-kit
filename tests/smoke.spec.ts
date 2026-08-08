import { expect, test } from "@playwright/test";

test("öffentlicher Einstieg führt zum funktionsfähigen Login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /steueragent/i })).toBeVisible();
  await expect(page.getByLabel("E-Mail")).toBeVisible();
  await expect(page.getByLabel("Passwort")).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeEnabled();
});

test("geschützte Seite leitet unangemeldet zum Login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("API weist unangemeldeten Zugriff strukturiert ab", async ({ request }) => {
  const response = await request.get("/api/dashboard");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: expect.any(String),
  });
});

test("Login bleibt auf kleinen Displays ohne horizontalen Überlauf", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  const breite = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    inhalt: document.documentElement.scrollWidth,
  }));
  expect(breite.inhalt).toBeLessThanOrEqual(breite.viewport);
});
