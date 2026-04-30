import { test, expect } from "@playwright/test";

/**
 * E2E-Tests fuer PROJ-38 Datenblatt-Vorlagen mit LaTeX-Layout-Varianten.
 *
 * Voraussetzungen:
 *   - Dev-Server auf localhost:3000
 *   - Auth deaktiviert (siehe src/lib/supabase/middleware.ts)
 *   - Modern-Vorlage in DB als Default + 423 Produkte zugewiesen (Migration 0023)
 */

const SAMPLE_PRODUKT_ID = "9bd8da32-0779-4d9e-8ba1-6be5137eb679";

test("Vorlagen-Uebersicht zeigt Modern als Aktiviert+Default mit Vorschau-PNG", async ({ page }) => {
  await page.goto("/datenblatt-vorlagen");
  await expect(page.getByRole("heading", { name: "Datenblatt-Vorlagen" })).toBeVisible();

  // Modern-Karte: erst Heading lokalisieren + Scrollen, dann Card-Container
  const modernHeading = page.locator("h3").filter({ hasText: "Modern Lichtengross" });
  await modernHeading.scrollIntoViewIfNeeded();
  const modernCard = modernHeading.locator("xpath=ancestor::div[contains(@class,'glass-card')]");

  await expect(modernCard.getByText("Aktiviert", { exact: false })).toBeVisible();
  await expect(modernCard.getByText("Default", { exact: false })).toBeVisible();

  const previewImg = modernCard.locator(`img[alt*="Modern Lichtengross"]`);
  await expect(previewImg).toBeVisible();
  await expect(previewImg).toHaveAttribute("src", /preview-lichtengross-datenblatt-modern\.png/);
});

test("Skeleton-Vorlagen werden als 'Skeleton' markiert", async ({ page }) => {
  await page.goto("/datenblatt-vorlagen", { waitUntil: "networkidle" });
  // V1/V2/V3 sind Skeletons (kein latex_template_key)
  const v1Heading = page.locator("h3").filter({ hasText: "V1 — Leuchte / Spot" });
  await expect(v1Heading).toBeVisible({ timeout: 15000 });
  await v1Heading.scrollIntoViewIfNeeded();
  const v1Card = v1Heading.locator("xpath=ancestor::div[contains(@class,'glass-card')]");
  await expect(v1Card.getByText("Skeleton")).toBeVisible();
});

test("Datenblatt-Route rendert PDF mit Modern-Vorlage (200 + Content-Type)", async ({ request }) => {
  const res = await request.get(`/produkte/${SAMPLE_PRODUKT_ID}/datenblatt/raw`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const buf = Buffer.from(await res.body());
  expect(buf.length).toBeGreaterThan(10_000);
  // PDF-Magic-Bytes
  expect(buf.subarray(0, 4).toString()).toBe("%PDF");
});

test("Datenblatt-Route 'style=klassisch' umgeht das Vorlagen-System", async ({ request }) => {
  const res = await request.get(`/produkte/${SAMPLE_PRODUKT_ID}/datenblatt/raw?style=klassisch`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
});

test("Produkt-Detailseite zeigt Vorlagen-Auswahl mit Vorschau-Thumbnail", async ({ page }) => {
  await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}`);
  await expect(page.getByText("Datenblatt-Vorlage").first()).toBeVisible();

  // Modern-Vorlage muss auswaehlbar sein, mit Thumbnail
  const modernButton = page.getByRole("button", { name: /Modern Lichtengross/ });
  await expect(modernButton).toBeVisible();
  await expect(modernButton.locator(`img[alt*="Modern Lichtengross"]`)).toBeVisible();
});

test("Skeleton-Vorlagen erscheinen NICHT in der Produkt-Auswahl", async ({ page }) => {
  await page.goto(`/produkte/${SAMPLE_PRODUKT_ID}`);
  // Section + Modern-Vorlage muss erst geladen sein, bevor wir Negativ-Assertions machen
  await expect(page.getByRole("button", { name: /Modern Lichtengross/ })).toBeVisible();
  // V1/V2/V3 duerfen NICHT als Buttons in der Auswahl auftauchen
  const v1Buttons = page.getByRole("button", { name: /V1 — Leuchte/ });
  await expect(v1Buttons).toHaveCount(0);
});
