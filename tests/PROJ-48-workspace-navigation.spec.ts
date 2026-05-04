import { test, expect, type Page } from "@playwright/test";

/**
 * E2E-Tests für PROJ-48 Workspace-Navigation.
 *
 * Voraussetzungen:
 *   - Dev-Server läuft auf localhost:3000 (durch playwright.config.ts webServer-Config)
 *   - Auth ist projektweit aktiv → Tests benötigen Test-Credentials via Env-Vars:
 *       E2E_TEST_EMAIL und E2E_TEST_PASSWORD
 *     Ohne Credentials werden alle Tests via test.skip() übersprungen.
 *
 * Strategie:
 *   - Erster Test loggt ein, alle weiteren nutzen `storageState` über die Test-Suite
 *   - localStorage wird vor jedem Test geleert, damit Last-active-page-Tests reproduzierbar sind
 *   - Wir nutzen `getByRole`/`getByText` für stabile Selektoren
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const STORAGE_KEY = "lichtengros.workspace.last-page";

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(TEST_EMAIL!);
  await page.getByLabel("Passwort").fill(TEST_PASSWORD!);
  await page.getByRole("button", { name: /anmelden/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10000 });
}

async function clearWorkspaceStorage(page: Page) {
  await page.evaluate((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, STORAGE_KEY);
}

test.beforeEach(async ({ page }) => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, "E2E_TEST_EMAIL/E2E_TEST_PASSWORD nicht gesetzt");
  await login(page);
  await clearWorkspaceStorage(page);
});

test("Topnav zeigt genau vier Workspace-Buttons in korrekter Reihenfolge", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(4);
  await expect(links.nth(0)).toContainText("Start");
  await expect(links.nth(1)).toContainText("Lösungen");
  await expect(links.nth(2)).toContainText("Kunden");
  await expect(links.nth(3)).toContainText("Einstellungen");
});

test("Start-Workspace ist auf '/' aktiv markiert", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  await expect(nav.getByRole("link", { name: /start/i })).toHaveAttribute("aria-current", "page");
});

test("Direktaufruf /produkte markiert Lösungen aktiv", async ({ page }) => {
  await page.goto("/produkte");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  await expect(nav.getByRole("link", { name: /lösungen/i })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Tiefen-URL /kunden/druckhistorie markiert Kunden aktiv", async ({ page }) => {
  await page.goto("/kunden/druckhistorie");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  await expect(nav.getByRole("link", { name: /kunden/i })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Direktaufruf /benutzer markiert Einstellungen aktiv", async ({ page }) => {
  await page.goto("/benutzer");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  await expect(nav.getByRole("link", { name: /einstellungen/i })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Lösungen-Sidebar zeigt Bereiche/Kategorien/Produkte/Mediathek/Icons/Vorlagen/Druckhistorie", async ({
  page,
}) => {
  await page.goto("/bereiche");
  await expect(page.getByRole("link", { name: "Bereiche" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kategorien" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Produkte" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mediathek" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Icons" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Datenblatt-Vorlagen" })).toBeVisible();
  await expect(page.getByRole("link", { name: /druckhistorie \(alle\)/i })).toBeVisible();
});

test("Kunden-Sidebar zeigt Kundenliste/Druckhistorie/Sonderpreise/Branchen", async ({ page }) => {
  await page.goto("/kunden");
  await expect(page.getByRole("link", { name: "Kundenliste" })).toBeVisible();
  await expect(page.getByRole("link", { name: /druckhistorie \(kunden\)/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sonderpreise" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Branchen" })).toBeVisible();
});

test("Einstellungen-Sidebar zeigt Profil/Benutzer/Filialen/Aktivität/Hilfe", async ({ page }) => {
  await page.goto("/einstellungen");
  await expect(page.getByRole("link", { name: "Mein Profil" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Benutzer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Filialen & Katalog" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aktivität" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hilfe & FAQ" })).toBeVisible();
});

test("Vorschläge-bereit-Karte erscheint nur im Lösungen-Workspace", async ({ page }) => {
  await page.goto("/bereiche");
  await expect(page.getByRole("link", { name: /jetzt prüfen/i })).toBeVisible();

  await page.goto("/kunden");
  await expect(page.getByRole("link", { name: /jetzt prüfen/i })).toHaveCount(0);

  await page.goto("/einstellungen");
  await expect(page.getByRole("link", { name: /jetzt prüfen/i })).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /jetzt prüfen/i })).toHaveCount(0);
});

test("Klick auf Lösungen navigiert zu /bereiche (Default-Landing)", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  await nav.getByRole("link", { name: /lösungen/i }).click();
  await page.waitForURL("**/bereiche");
  expect(new URL(page.url()).pathname).toBe("/bereiche");
});

test("Last-active-page-Persistenz funktioniert", async ({ page }) => {
  await page.goto("/produkte");
  await page.waitForTimeout(200);

  const nav = page.getByRole("navigation", { name: /workspaces/i });

  await nav.getByRole("link", { name: /kunden/i }).click();
  await page.waitForURL("**/kunden");
  await page.waitForTimeout(200);

  await nav.getByRole("link", { name: /lösungen/i }).click();
  await page.waitForURL("**/produkte");
  expect(new URL(page.url()).pathname).toBe("/produkte");
});

test("Aktiver Workspace-Klick ist No-Op (keine Navigation)", async ({ page }) => {
  await page.goto("/produkte/import");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  const beforeUrl = page.url();
  await nav.getByRole("link", { name: /lösungen/i }).click();
  await page.waitForTimeout(300);
  expect(page.url()).toBe(beforeUrl);
});

test("Workspace-Heading erscheint in Sidebar", async ({ page }) => {
  await page.goto("/produkte");
  await expect(page.getByText("Lösungen", { exact: true }).first()).toBeVisible();

  await page.goto("/kunden");
  await expect(page.getByText("Kunden", { exact: true }).first()).toBeVisible();
});

test("localStorage speichert Pfade pro Workspace", async ({ page }) => {
  await page.goto("/produkte/vergleich");
  await page.waitForTimeout(300);
  await page.goto("/kunden/branchen");
  await page.waitForTimeout(300);

  const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  const parsed = JSON.parse(stored ?? "{}");
  expect(parsed.loesungen).toBe("/produkte/vergleich");
  expect(parsed.kunden).toBe("/kunden/branchen");
});

test("Mobile-Viewport: alle 4 Workspace-Buttons sichtbar (Icons-only)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  await expect(nav.getByRole("link")).toHaveCount(4);
});
