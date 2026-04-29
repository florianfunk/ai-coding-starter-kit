import { test, expect } from "@playwright/test";

/**
 * E2E-Tests für PROJ-37 Katalog-Druck-Wizard.
 *
 * Voraussetzungen:
 *   - Dev-Server läuft auf localhost:3000 (durch playwright.config.ts webServer-Config)
 *   - Auth ist im Projekt aktuell deaktiviert (siehe src/lib/supabase/middleware.ts) —
 *     `/produkte` ist also direkt erreichbar
 *   - Echtdaten in Supabase (geprüft beim Smoke-Test: ~423 Produkte, 20 Bereiche, 79 Kategorien)
 *
 * Strategie:
 *   - localStorage wird vor jedem Test geleert, damit Defaults reproduzierbar sind
 *   - Wir nutzen `getByRole`/`getByText` statt CSS-Selektoren für stabilere Tests
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/produkte");
  // Zähler wird nach Initial-Render gerendert — auf Button-Trigger warten
  await page.getByRole("button", { name: /katalog drucken/i }).waitFor();
  await page.evaluate(() => localStorage.removeItem("lichtengros.katalog-wizard.defaults"));
  await page.reload();
});

test("Wizard öffnet als Modal mit Schritt 1 aktiv", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Katalog drucken" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /1\. parameter/i })).toHaveAttribute("data-state", "active");
});

test("Schritt 1: alle Parameter-Felder vorhanden mit Defaults", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();

  // Layout-Default = lichtengros
  await expect(page.getByRole("radio", { name: "Lichtengros" })).toBeChecked();
  // Preisauswahl-Default = Listenpreis
  await expect(page.getByRole("combobox").first()).toContainText("Listenpreis");
  // Vorzeichen-Default = plus
  await expect(page.getByRole("radio", { name: "plus" })).toBeChecked();
  // Prozent-Default = 0
  await expect(page.locator('input[type="number"]')).toHaveValue("0");
  // Währung-Default = EUR
  await expect(page.getByRole("radio", { name: "EUR" })).toBeChecked();
  // Sprache disabled
  await expect(page.getByRole("combobox").nth(1)).toBeDisabled();
});

test("Preisauswahl-Dropdown bietet alle drei Spuren", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await page.getByRole("combobox").first().click();

  await expect(page.getByRole("option", { name: "Listenpreis" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Lichtengros-Preis" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Eisenkeil-Preis" })).toBeVisible();
});

test("Counter im Footer zeigt Live-Stand der Auswahl", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  // Default: alles ausgewählt — mind. 100 Produkte, gleicher Wert vor und hinter dem /
  await expect(page.getByRole("dialog")).toContainText(/\d{3} \/ \d{3} Produkte/);

  await page.getByRole("tab", { name: /2\. inhalt/i }).click();
  await page.getByRole("button", { name: "Alle abwählen" }).click();
  await expect(page.getByRole("dialog")).toContainText(/0 \/ \d+ Produkte/);
});

test("PDF-erstellen-Button ist disabled bei 0 ausgewählten Produkten", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await page.getByRole("tab", { name: /2\. inhalt/i }).click();
  await page.getByRole("button", { name: "Alle abwählen" }).click();

  await expect(page.getByRole("button", { name: "PDF erstellen" })).toBeDisabled();
});

test("Suche filtert Produkte und hebt Treffer hervor", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await page.getByRole("tab", { name: /2\. inhalt/i }).click();

  await page.getByPlaceholder(/suche artikelnr/i).fill("BL13528");

  // Tree zeigt nur LED STRIP (einziger Bereich mit BL13528-Treffern)
  await expect(page.getByRole("dialog")).toContainText("LED STRIP");
  // Highlight-Mark wird gerendert
  await expect(page.locator("mark").first()).toContainText("BL13528");
});

test("Suchfeld escaped potenzielle XSS-Angriffe", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await page.getByRole("tab", { name: /2\. inhalt/i }).click();

  await page.getByPlaceholder(/suche artikelnr/i).fill('<script>window._xss=true</script>');

  // Kein Script-Tag im DOM, kein _xss-Flag im window
  const xssRan = await page.evaluate(() => (window as any)._xss === true);
  expect(xssRan).toBe(false);
  await expect(page.getByRole("dialog").locator("script")).toHaveCount(0);
});

test("Wizard merkt sich Parameter via localStorage", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await page.getByRole("radio", { name: "Eisenkeil" }).click();
  await page.getByRole("radio", { name: "minus" }).click();

  // Reload — Defaults sollten Eisenkeil + minus liefern
  await page.reload();
  await page.getByRole("button", { name: /katalog drucken/i }).click();

  await expect(page.getByRole("radio", { name: "Eisenkeil" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "minus" })).toBeChecked();
});

test("Tri-State: Kategorie anwählen lässt Bereich indeterminate", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await page.getByRole("tab", { name: /2\. inhalt/i }).click();

  // Alles abwählen und Bereich aufklappen, damit Kategorien gerendert werden
  await page.getByRole("button", { name: "Alle abwählen" }).click();
  await page.getByRole("button", { name: "Bereich LED STRIP aufklappen" }).click();

  // Eine Kategorie wieder anwählen
  await page.locator('button[role="checkbox"][aria-label="Kategorie 60 SMD/MT"]').click();

  // Bereich LED STRIP sollte indeterminate sein (eine Kategorie an, andere aus)
  await expect(
    page.locator('button[role="checkbox"][aria-label="Bereich LED STRIP"]'),
  ).toHaveAttribute("aria-checked", "mixed");
});

test("Tabs sind navigierbar mit Zurück/Weiter Buttons", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();

  // Schritt 1 → Schritt 2
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("tab", { name: /2\. inhalt/i })).toHaveAttribute("data-state", "active");

  // Schritt 2 → Schritt 1
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByRole("tab", { name: /1\. parameter/i })).toHaveAttribute("data-state", "active");
});

test("Wizard öffnet nach Schließen wieder auf Schritt 1 (LOW-1 Fix)", async ({ page }) => {
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await page.getByRole("tab", { name: /2\. inhalt/i }).click();
  await expect(page.getByRole("tab", { name: /2\. inhalt/i })).toHaveAttribute("data-state", "active");

  // Dialog mit Abbrechen schließen
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Erneut öffnen — Tab 1 muss aktiv sein
  await page.getByRole("button", { name: /katalog drucken/i }).click();
  await expect(page.getByRole("tab", { name: /1\. parameter/i })).toHaveAttribute("data-state", "active");
});
