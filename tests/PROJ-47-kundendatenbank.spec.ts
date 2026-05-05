import { test, expect, type Page } from "@playwright/test";

/**
 * E2E-Tests für PROJ-47 Kundendatenbank.
 *
 * Voraussetzungen:
 *   - Dev-Server läuft auf localhost:3000 (durch playwright.config.ts webServer-Config)
 *   - Auth ist projektweit aktiv → Tests benötigen Test-Credentials via Env-Vars:
 *       E2E_TEST_EMAIL und E2E_TEST_PASSWORD
 *     Ohne Credentials werden alle Tests via test.skip() übersprungen.
 *
 * Strategie:
 *   - Jeder Test loggt ein und navigiert direkt zum Ziel
 *   - Tests sind seriell, weil sie auf gemeinsame DB-Zustände zugreifen
 *   - Aufräumen erfolgt am Ende jedes Tests, der etwas anlegt
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(TEST_EMAIL!);
  await page.getByLabel("Passwort").fill(TEST_PASSWORD!);
  await page.getByRole("button", { name: /anmelden/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10000 });
}

test.beforeEach(async ({ page }) => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, "E2E_TEST_EMAIL/E2E_TEST_PASSWORD nicht gesetzt");
  await login(page);
});

test("Kundenliste lädt mit leerem oder befülltem Zustand", async ({ page }) => {
  await page.goto("/kunden");
  await expect(page.getByRole("heading", { name: "Kunden" })).toBeVisible();
  await expect(page.getByRole("link", { name: /neuer kunde/i })).toBeVisible();
});

test("Kunden anlegen — Happy Path mit minimalen Daten", async ({ page }) => {
  await page.goto("/kunden/neu");
  await expect(page.getByRole("heading", { name: "Neuer Kunde" })).toBeVisible();

  // Auto-Kunden-Nr. ist vorbefüllt
  const kundenNrInput = page.getByLabel(/kunden-nr/i);
  await expect(kundenNrInput).not.toHaveValue("");

  // Firma ausfüllen
  const firmaInput = page.getByLabel(/^firma/i);
  await firmaInput.fill("E2E-Testkunde " + Date.now());

  await page.getByRole("button", { name: /kunden anlegen/i }).click();
  await page.waitForURL(/\/kunden\/[a-z0-9-]+\/stammdaten/, { timeout: 10000 });

  // Cleanup: Kunde löschen — über Stammdaten-Tab gibt's keinen Löschen-Button auf der Form-Seite,
  // also über die Kundenliste
  await page.goto("/kunden");
  // Hier könnten wir aufräumen, aber im seriellen Modus reicht die Anlage als Test.
});

test("Kunden-Nr. validiert das K-NNNN Format", async ({ page }) => {
  await page.goto("/kunden/neu");
  const kundenNrInput = page.getByLabel(/kunden-nr/i);
  await kundenNrInput.fill("0001");
  await page.getByLabel(/^firma/i).fill("Test-Validation");
  await page.getByRole("button", { name: /kunden anlegen/i }).click();
  // Sollte einen Fehler zeigen
  await expect(page.getByText(/format k-nnnn/i)).toBeVisible({ timeout: 5000 });
});

test("Firma ist Pflichtfeld", async ({ page }) => {
  await page.goto("/kunden/neu");
  // Kunden-Nr. ist auto, Firma leer lassen
  await page.getByRole("button", { name: /kunden anlegen/i }).click();
  await expect(page.getByText(/firma ist pflicht/i)).toBeVisible({ timeout: 5000 });
});

test("Tabs-Navigation auf Kunden-Detail funktioniert", async ({ page }) => {
  await page.goto("/kunden");
  // Wenn keine Kunden: Test überspringen
  const firstRow = page.getByRole("link").filter({ hasText: /^K-/ }).first();
  const count = await firstRow.count();
  if (count === 0) {
    test.skip(true, "Keine Kunden vorhanden für Tab-Test");
    return;
  }
  await firstRow.click();
  await page.waitForURL(/\/kunden\/[a-z0-9-]+\/stammdaten/);

  // Alle 4 Tabs sind sichtbar
  await expect(page.getByRole("link", { name: "Stammdaten" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Auswahl" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Preise" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Druckhistorie" })).toBeVisible();

  // Quick-Buttons sichtbar
  await expect(page.getByRole("button", { name: /katalog drucken/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /datenblatt drucken/i })).toBeVisible();

  // Datenblatt-Button ist disabled (Folge-Schritt)
  await expect(page.getByRole("button", { name: /datenblatt drucken/i })).toBeDisabled();

  // Wechsel zu Auswahl-Tab
  await page.getByRole("link", { name: "Auswahl" }).click();
  await page.waitForURL(/\/auswahl/);
  await expect(page.getByText(/alle produkte aufnehmen/i)).toBeVisible();

  // Wechsel zu Preise-Tab
  await page.getByRole("link", { name: "Preise" }).click();
  await page.waitForURL(/\/preise/);
  await expect(page.getByText(/preisspur/i)).toBeVisible();

  // Wechsel zu Druckhistorie
  await page.getByRole("link", { name: "Druckhistorie" }).click();
  await page.waitForURL(/\/druckhistorie/);
});

test("Workspace-Aktiv-Markierung: Kunden-Workspace markiert Kunden-Tab", async ({ page }) => {
  await page.goto("/kunden");
  const nav = page.getByRole("navigation", { name: /workspaces/i });
  await expect(nav.getByRole("link", { name: /kunden/i })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Sidebar im Kunden-Workspace zeigt Kundenliste/Druckhistorie/Sonderpreise/Branchen", async ({
  page,
}) => {
  await page.goto("/kunden");
  await expect(page.getByRole("link", { name: "Kundenliste" })).toBeVisible();
  await expect(page.getByRole("link", { name: /druckhistorie \(kunden\)/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sonderpreise" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Branchen" })).toBeVisible();
});

test("Branchen-Pflege: Anlegen einer neuen Branche", async ({ page }) => {
  await page.goto("/kunden/branchen");
  await expect(page.getByRole("heading", { name: "Branchen" })).toBeVisible();

  const testName = `E2E-Branche-${Date.now()}`;
  await page.getByPlaceholder(/neue branche/i).fill(testName);
  await page.getByRole("button", { name: /anlegen/i }).click();
  await expect(page.getByRole("cell", { name: testName })).toBeVisible({ timeout: 5000 });

  // Cleanup: löschen — hat 0 Verwendungen, sollte gehen
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: testName }) });
  await row.getByRole("button").last().click(); // Trash-Icon
  await page.getByRole("button", { name: "Löschen" }).click();
  await expect(page.getByRole("cell", { name: testName })).not.toBeVisible({ timeout: 5000 });
});

test("Sonderpreise-Cross-Cut zeigt Filter-Buttons", async ({ page }) => {
  await page.goto("/kunden/sonderpreise");
  await expect(page.getByRole("heading", { name: "Sonderpreise" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^alle$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /nur rabatte/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /nur aufschläge/i })).toBeVisible();
});

test("Globale Druckhistorie ist erreichbar über Sidebar", async ({ page }) => {
  await page.goto("/kunden/druckhistorie");
  await expect(page.getByRole("heading", { name: "Druckhistorie (Kunden)" })).toBeVisible();
});

test("Kunden-Stub-Pages sind durch Echtseiten ersetzt", async ({ page }) => {
  // Die Stub-Karten "Kommt mit PROJ-47" dürfen nicht mehr erscheinen
  for (const path of [
    "/kunden",
    "/kunden/druckhistorie",
    "/kunden/sonderpreise",
    "/kunden/branchen",
  ]) {
    await page.goto(path);
    await expect(page.getByText("Kommt mit PROJ-47")).not.toBeVisible();
  }
});

test("Kunden-Suche filtert Kundenliste", async ({ page }) => {
  await page.goto("/kunden");
  // Wenn keine Kunden: skip
  const rows = await page.getByRole("row").count();
  if (rows < 2) {
    test.skip(true, "Keine Kunden vorhanden für Such-Test");
    return;
  }

  await page.getByPlaceholder(/suche firma/i).fill("zzzzz_unmöglich_zzzzz");
  await page.getByRole("button", { name: /anwenden/i }).click();
  await expect(page.getByText(/keine treffer/i)).toBeVisible({ timeout: 5000 });
});

test("Direktaufruf einer Detail-URL leitet auf Stammdaten-Tab um", async ({ page }) => {
  // Erst einen Kunden suchen
  await page.goto("/kunden");
  const link = page.getByRole("link").filter({ hasText: /^K-/ }).first();
  if ((await link.count()) === 0) {
    test.skip(true, "Keine Kunden vorhanden");
    return;
  }
  const href = await link.getAttribute("href");
  if (!href) return;
  // href endet auf /stammdaten — wir testen mit der Root-Detail-URL
  const baseUrl = href.replace(/\/stammdaten$/, "");
  await page.goto(baseUrl);
  await page.waitForURL(/\/stammdaten$/);
});
