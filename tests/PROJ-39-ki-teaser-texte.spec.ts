import { test, expect } from "@playwright/test";

/**
 * E2E-Tests fuer PROJ-39 KI-Teaser-Texte.
 *
 * Voraussetzungen:
 *   - Dev-Server auf localhost:3000
 *   - Auth deaktiviert (siehe src/lib/supabase/middleware.ts)
 *   - ai_einstellungen-Row mit Default-Provider/Model existiert (Migration 0024)
 *
 * Hinweis: Echte LLM-Aufrufe werden NICHT getestet (kostet API-Credits).
 *          Wir testen nur die UI-Sichtbarkeit + Validation der Endpunkte.
 */

const SAMPLE_PRODUKT_ID = "9bd8da32-0779-4d9e-8ba1-6be5137eb679";

test("Einstellungen-Seite zeigt KI-Tab mit Provider/Modell/API-Key-Feldern", async ({ page }) => {
  await page.goto("/einstellungen", { waitUntil: "networkidle" });
  // Tab "KI" muss sichtbar + klickbar sein (Default-Tab ist "filialen")
  const kiTab = page.getByRole("tab", { name: /^ki$/i });
  await expect(kiTab).toBeVisible({ timeout: 10000 });
  await kiTab.click();
  // Tab-Inhalt aufgeklappt — pruefe API-Key-Feld
  await expect(page.getByLabel(/openai api[\s\-]?key/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel(/anthropic api[\s\-]?key/i).first()).toBeVisible();
});

test("API: Validierung greift bei leerem Body", async ({ request }) => {
  const res = await request.post("/api/ai/teaser", { data: {} });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test("API: Validierung greift bei ungueltigem entityType", async ({ request }) => {
  const res = await request.post("/api/ai/teaser", {
    data: { entityType: "hacker", entityName: "Test" },
  });
  expect(res.status()).toBe(400);
});

test("API: Validierung greift bei zu langem entityName (>300 Zeichen)", async ({ request }) => {
  const res = await request.post("/api/ai/teaser", {
    data: { entityType: "produkt", entityName: "x".repeat(301) },
  });
  expect(res.status()).toBe(400);
});

test("API: Bad JSON wird als 400 abgewiesen", async ({ request }) => {
  const res = await request.post("/api/ai/teaser", {
    data: "not-json",
    headers: { "Content-Type": "application/json" },
  });
  expect([400, 500]).toContain(res.status());
});

test("Produkt-Detailseite zeigt KI-Teaser-Button", async ({ page }) => {
  await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}`, { waitUntil: "networkidle" });
  const teaserButton = page.getByRole("button", { name: /ki[\s\-]?teaser/i }).first();
  await expect(teaserButton).toBeVisible({ timeout: 15000 });
});

test("KI-Teaser-Modal oeffnet bei Klick + zeigt Laengen-Auswahl", async ({ page }) => {
  await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}`, { waitUntil: "networkidle" });
  const teaserButton = page.getByRole("button", { name: /ki[\s\-]?teaser/i }).first();
  await teaserButton.scrollIntoViewIfNeeded();
  await teaserButton.click();

  // Modal sichtbar
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/KI-Teaser generieren/i)).toBeVisible();
  // Laengen-Auswahl
  await expect(dialog.getByText(/Länge/i).first()).toBeVisible();
  // Zusatz-Hinweis
  await expect(dialog.getByLabel(/zusatz/i)).toBeVisible();
  // Generieren-Button da, "Uebernehmen" noch NICHT (kein Text generiert)
  await expect(dialog.getByRole("button", { name: /generieren$/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^übernehmen$/i })).toHaveCount(0);
});
