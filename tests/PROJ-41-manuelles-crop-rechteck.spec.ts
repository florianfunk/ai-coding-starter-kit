import { test, expect } from "@playwright/test";

/**
 * E2E-Tests fuer PROJ-41 Manuelles Crop-Rechteck.
 *
 * Voraussetzungen:
 *   - Dev-Server auf localhost:3000
 *   - Auth deaktiviert
 *   - Mind. eine Kategorie mit gesetzten Bild-Slots
 *
 * Hinweis: Echte Crop-Drag-Geste mit react-image-crop ist in Playwright fragil
 *          (Pointer-Events). Wir testen die UI-Sichtbarkeit + Modus-Switch.
 */

const SAMPLE_KATEGORIE_ID = "dbf3ca3b-1b85-4c8e-bd5b-0411dce07641";

test("Kategorie-Bearbeiten-Seite laedt mit Bild-Slots fuer Crop-Test", async ({ page }) => {
  await page.goto(`/kategorien/${SAMPLE_KATEGORIE_ID}/bearbeiten`, { waitUntil: "networkidle" });
  await expect(page.getByText(/per drag.*drop getauscht/i)).toBeVisible({ timeout: 15000 });
  // Mind. ein Crop-Button (Crop-Icon) muss sichtbar sein
  const cropButtons = page.getByRole("button", { name: /zuschneiden|crop/i });
  await expect(cropButtons.first()).toBeVisible({ timeout: 15000 });
});

test("Crop-Modal oeffnet im Compare-Modus mit 'Manuell anpassen'-Button", async ({ page }) => {
  await page.goto(`/kategorien/${SAMPLE_KATEGORIE_ID}/bearbeiten`, { waitUntil: "networkidle" });
  await page.getByText(/per drag.*drop getauscht/i).waitFor({ timeout: 15000 });

  // Erster Crop-Button klicken
  const cropButton = page.getByRole("button", { name: /zuschneiden|crop/i }).first();
  await cropButton.scrollIntoViewIfNeeded();
  await expect(cropButton).toBeEnabled({ timeout: 15000 });
  await cropButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10000 });
  // Compare-Mode: Original + Vorschlag-Boxen sichtbar
  await expect(dialog.getByText(/original/i).first()).toBeVisible();
  await expect(dialog.getByText(/vorschlag/i).first()).toBeVisible();
  // Neuer "Manuell anpassen"-Button vorhanden
  await expect(dialog.getByRole("button", { name: /manuell anpassen/i })).toBeVisible();
});

test("Klick auf 'Manuell anpassen' wechselt in Editor-Modus", async ({ page }) => {
  await page.goto(`/kategorien/${SAMPLE_KATEGORIE_ID}/bearbeiten`, { waitUntil: "networkidle" });
  await page.getByText(/per drag.*drop getauscht/i).waitFor({ timeout: 15000 });

  const cropBtn = page.getByRole("button", { name: /zuschneiden|crop/i }).first();
  await cropBtn.scrollIntoViewIfNeeded();
  await expect(cropBtn).toBeEnabled({ timeout: 10000 });
  await cropBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15000 });

  // Wechsel in den Editor
  await dialog.getByRole("button", { name: /manuell anpassen/i }).click();

  // Editor-Mode: Crop-Bereich + Live-Vorschau-Labels sichtbar
  await expect(dialog.getByText(/crop-bereich/i)).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByText(/live-vorschau/i)).toBeVisible();
  // ReactCrop-Container im DOM
  await expect(dialog.locator(".ReactCrop")).toBeVisible();
  // Speichern-Button + Zurueck-Button
  await expect(dialog.getByRole("button", { name: /^speichern$|speichere/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /zurück zum vergleich/i })).toBeVisible();
});

test("'Zurueck zum Vergleich' fuehrt zurueck in Compare-Modus", async ({ page }) => {
  await page.goto(`/kategorien/${SAMPLE_KATEGORIE_ID}/bearbeiten`, { waitUntil: "networkidle" });
  await page.getByText(/per drag.*drop getauscht/i).waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: /zuschneiden|crop/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10000 });

  await dialog.getByRole("button", { name: /manuell anpassen/i }).click();
  await expect(dialog.getByText(/crop-bereich/i)).toBeVisible({ timeout: 10000 });

  // Zurueck
  await dialog.getByRole("button", { name: /zurück zum vergleich/i }).click();

  // Compare-Mode wieder aktiv
  await expect(dialog.getByText(/original/i).first()).toBeVisible({ timeout: 5000 });
  await expect(dialog.getByRole("button", { name: /manuell anpassen/i })).toBeVisible();
});
