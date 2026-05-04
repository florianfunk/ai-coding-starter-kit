import { test, expect, type Page } from "@playwright/test";

/**
 * E2E-Tests für PROJ-46 Italienische Übersetzung für Datenblätter.
 *
 * Voraussetzungen:
 *   - Dev-Server auf localhost:3000
 *   - Migration 0029 + 0030 angewendet
 *   - ai_einstellungen-Row mit Provider/Modell/Key existiert
 *   - Auth ist projektweit aktiv → UI-Tests benötigen Test-Credentials via
 *       E2E_TEST_EMAIL und E2E_TEST_PASSWORD. Ohne Credentials werden alle
 *       UI-Tests via test.skip() übersprungen.
 *
 * Auth-Verhalten:
 *   Die Middleware leitet unauthenticated Requests auf /login um (HTTP 307).
 *   Die API-Tests prüfen explizit den Auth-Schutz (sollten 307 oder 401 sein).
 *
 * Hinweis: Echte LLM-Aufrufe werden NICHT getestet (kostet API-Credits).
 *          Wir testen UI-Sichtbarkeit, API-Auth-Schutz und Sprach-Schalter.
 */

const SAMPLE_PRODUKT_ID = "9bd8da32-0779-4d9e-8ba1-6be5137eb679";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(TEST_EMAIL!);
  await page.getByLabel("Passwort").fill(TEST_PASSWORD!);
  await page.getByRole("button", { name: /anmelden/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10000 });
}

// ─── API: Auth-Protection (auch ohne Credentials testbar) ───────────────────

test("API uebersetzen: ohne Auth wird umgeleitet (Auth-Schutz aktiv)", async ({ request }) => {
  // maxRedirects:0 → kein Folge-Redirect, wir sehen den 307 selbst.
  // 307 = Middleware-Redirect zu /login, 401 = Endpoint-Auth, beides "geschützt".
  const res = await request.post("/api/ai/uebersetzen", {
    data: {},
    maxRedirects: 0,
  });
  expect([307, 401]).toContain(res.status());
});

test("API uebersetzen-bulk-item: ohne Auth geschützt", async ({ request }) => {
  const res = await request.post("/api/ai/uebersetzen-bulk-item", {
    data: {},
    maxRedirects: 0,
  });
  expect([307, 401]).toContain(res.status());
});

// ─── UI-Tests benötigen Login ──────────────────────────────────────────────

test.describe("PROJ-46 UI mit Login", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, "E2E_TEST_EMAIL/E2E_TEST_PASSWORD nicht gesetzt");
    await login(page);
  });

  // ─── Datenblatt-Vorschau: Sprach-Schalter ────────────────────────────────

  test("Datenblatt-Vorschau: Sprache-Buttons sichtbar", async ({ page }) => {
    await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}/datenblatt`);
    const deutschBtn = page.getByRole("link", { name: /^deutsch$/i });
    const italienischBtn = page.getByRole("link", { name: /^italienisch$/i });
    await expect(deutschBtn).toBeVisible({ timeout: 15000 });
    await expect(italienischBtn).toBeVisible();
  });

  test("Datenblatt-Vorschau: Sprache-Wechsel auf IT setzt ?lang=it Query-Param", async ({ page }) => {
    await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}/datenblatt`);
    await page.getByRole("link", { name: /^italienisch$/i }).click();
    await page.waitForURL(/lang=it/, { timeout: 5000 });
    expect(page.url()).toContain("lang=it");
  });

  // ─── Produkt-Formular: Italienisch-Sektion ───────────────────────────────

  test("Produkt-Formular: Italienisch-Sektion mit Header sichtbar", async ({ page }) => {
    await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}`);
    const sectionHeader = page.getByText(/^Italienisch$/i).first();
    await expect(sectionHeader).toBeVisible({ timeout: 15000 });
  });

  test("Produkt-Formular: 'Alle Felder uebersetzen'-Button sichtbar", async ({ page }) => {
    await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}`);
    const trigger = page.getByRole("button", { name: /alle felder übersetzen/i });
    await expect(trigger.first()).toBeVisible({ timeout: 15000 });
  });

  test("Produkt-Formular: Klick auf 'Alle Felder uebersetzen' oeffnet Modal", async ({ page }) => {
    await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}`);
    const trigger = page.getByRole("button", { name: /alle felder übersetzen/i }).first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Checkbox "Nur leere Felder uebersetzen" ist Default aus
    const checkbox = dialog.getByRole("checkbox");
    await expect(checkbox).not.toBeChecked();
    // Generieren-Button da
    await expect(dialog.getByRole("button", { name: /^Übersetzen$/i })).toBeVisible();
  });

  // ─── Einstellungen → KI-Tab → Auto-Translate-Toggle ─────────────────────

  test("Einstellungen: KI-Tab zeigt Auto-Translate-Toggle", async ({ page }) => {
    await page.goto("/einstellungen");
    const kiTab = page.getByRole("tab", { name: /^ki$/i });
    await expect(kiTab).toBeVisible({ timeout: 15000 });
    await kiTab.click();
    // Karten-Titel "Italienische Übersetzung" und Toggle-Label
    await expect(page.getByText(/italienische übersetzung/i).first()).toBeVisible();
    await expect(page.getByLabel(/auto-übersetzung beim speichern/i)).toBeVisible();
  });

  // ─── Bulk: Produkt-Tabelle ─────────────────────────────────────────────

  test("Produkt-Liste: 'Italienisch übersetzen'-Bulk-Button erscheint nach Auswahl", async ({ page }) => {
    await page.goto("/produkte");
    // Erste Zeilen-Checkbox aktivieren (außerhalb des Header-Toggles)
    const rowCheckbox = page
      .getByRole("checkbox", { name: /produkt .* auswählen/i })
      .first();
    await expect(rowCheckbox).toBeVisible({ timeout: 15000 });
    await rowCheckbox.click();
    // Bulk-Bar sollte erscheinen mit "Italienisch übersetzen"
    await expect(
      page.getByRole("button", { name: /italienisch übersetzen/i }).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
