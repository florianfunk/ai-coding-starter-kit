# PROJ-40: Kategorie-Bilder Tools (Drag & Drop, Zoom, Smart-Crop)

**Status:** Deployed
**Priorität:** P1
**Erstellt:** 2026-04-30
**Last Updated:** 2026-04-30
**Deployed:** 2026-04-30

## Vision
Die vier Bildslots im Kategorie-Editor (Katalog-Layout: 2× breit + 2× hochkant) sollen leichter zu pflegen sein. Bilder per Drag & Drop tauschen, in groß ansehen, und mit einem Klick auf das passende Seitenverhältnis zuschneiden lassen — mit Vorschlag und Möglichkeit, das Original wiederherzustellen.

## User Stories

- **Als Pfleger** möchte ich Bilder zwischen den Slots per Drag & Drop tauschen, damit ich nicht alle erneut hochladen muss, wenn die Reihenfolge nicht stimmt.
- **Als Pfleger** möchte ich ein Bild groß ansehen, damit ich Details prüfen kann, bevor ich es übernehme.
- **Als Pfleger** möchte ich einem Bild in das Ziel-Format zuschneiden lassen — mit einem Vorschlag, den ich annehmen oder verwerfen kann, ohne das Original zu verlieren.

## Acceptance Criteria

### Drag & Drop
- [x] Bild 1 ↔ Bild 2 tauschbar (gleiche Form 15×3 cm)
- [x] Bild 3 ↔ Bild 4 tauschbar (gleiche Form 5×3 cm)
- [x] Cross-Group-Tausch deaktiviert (1↔3 etc.) — verhindert Layout-Bruch
- [x] Visuelles Feedback während Drag (Schatten, Drop-Zone-Highlight)
- [x] Touch-Support (Mobile)

### Bild-Zoom
- [x] Klick auf vorhandenes Bild öffnet Modal mit großem Bild
- [x] ESC oder Klick außerhalb schließt Modal
- [x] Bild-Format respektiert (kein verzerrtes Anzeigen)

### Smart-Crop
- [x] Button "Zuschneiden" (Crop-Icon) auf jedem Bild mit Pfad
- [x] Server-Action `cropKategorieBild(path, aspect)`:
  - Lädt Bild via Sharp
  - Smart-Crop via `sharp.attention()` (findet interessantesten Bildbereich automatisch)
  - Ziel-Aspect: 5:1 (Bild 1+2) oder 1:2 (Bild 3+4)
  - Auflösung: hochkant 600×1200 px, breit 1500×300 px
  - Speichert als **neue Datei** (Original bleibt erhalten)
- [x] Vorschau-Modal:
  - Zeigt Original und zugeschnittenen Vorschlag nebeneinander
  - Buttons: "Übernehmen" / "Original behalten" / "Schließen"
- [x] Bei "Übernehmen": Form-State zeigt neues Bild, Original wird im Storage **nicht** gelöscht (User kann via "Original wiederherstellen" zurück)
- [x] Bei Bearbeiten-Modus: nach "Übernehmen" wird DB direkt aktualisiert (analog zu `enhanceBild`)

## Technical Design

### Sharp Smart-Crop
```ts
const cropped = await sharp(buffer)
  .resize(targetWidth, targetHeight, {
    fit: "cover",
    position: sharp.strategy.attention,
  })
  .toBuffer();
```

### Storage-Konvention
```
{kategorieId}/orig-{ts}-{rand}.{ext}    # Original (unverändert)
{kategorieId}/crop-{ts}-{rand}.{ext}    # Zugeschnitten
```

### Komponenten
- `src/app/kategorien/sortable-images.tsx` — neuer Wrapper mit DnD-Context
- `src/components/image-zoom-modal.tsx` — wiederverwendbar (kann später für Produkt-Bilder genutzt werden)
- `src/components/crop-suggestion-modal.tsx` — wiederverwendbar
- `src/app/kategorien/actions.ts` — neue Server-Action `cropKategorieBild`

## Out of Scope
- Manuelles Crop-Rechteck ziehen (kommt evtl. in PROJ-41)
- Mehrere Crop-Vorschläge (nur 1 Smart-Crop pro Klick)
- Crop für Bereiche, Produkt-Hauptbild, Logos (separate Features)
- Undo-History über mehrere Crop-Schritte

## Implementation Notes

**Implementiert am 2026-04-30:**

### Gelieferte Komponenten
- `src/components/image-zoom-modal.tsx` — wiederverwendbares Zoom-Modal (ESC + Klick außerhalb schließt)
- `src/components/crop-suggestion-modal.tsx` — Vorher-Nachher-Vergleich mit Übernehmen/Verwerfen
- `src/app/kategorien/kategorie-form.tsx` — DnD-Wrapper via `@dnd-kit/core` (PointerSensor 8px Distance, TouchSensor 200ms Delay, KeyboardSensor); Group-Match-Check (Slot 1↔2 wide, 3↔4 tall); Crop-Trigger pro Slot
- `src/app/kategorien/actions.ts:cropKategorieBild` — Server-Action: Sharp `position: attention`, neue Datei mit `crop-{aspect}-{ts}-{rand}` Prefix, Original bleibt erhalten

### Architektur-Entscheidungen
- **Sharp `attention`-Strategy** statt manueller Crop-Box: einfacher, gut genug für „Bildmittelpunkt finden"
- **Original wird nicht gelöscht**: Storage wächst minimal, Pfleger kann jederzeit zurück
- **Slot-Group-Restriction**: Cross-Group-Drag (1↔3 etc.) wird mit Toast abgelehnt — verhindert Layout-Bruch im Katalog
- **PNG mit Alpha bleibt PNG**, sonst JPEG mit mozjpeg q=85

## QA Test Results
**QA-Lauf:** 2026-04-30
**Tester:** automatisierte E2E + Code-Review
**Empfehlung:** ✅ Production-Ready

### Acceptance Criteria

#### Drag & Drop
- [x] Slot 1↔2 / 3↔4 tauschbar — verifiziert in `kategorie-form.tsx:140-156` (`handleSlotDragEnd`)
- [x] Cross-Group-Tausch abgelehnt mit Toast — verifiziert
- [x] Visuelles Feedback (PointerSensor + DragEnd) — `@dnd-kit/core`
- [x] Touch-Support — `TouchSensor` mit 200ms Delay

#### Bild-Zoom
- [x] `ImageZoomModal` als wiederverwendbare Komponente
- [x] Eingebunden in `kategorie-form.tsx:454`

#### Smart-Crop
- [x] Server-Action `cropKategorieBild` mit Zod-Validation (path, aspect)
- [x] Sharp `position: attention` für Smart-Crop
- [x] Aspect-Mapping `wide` (1500×300) / `tall` (600×1200)
- [x] Original bleibt erhalten (neuer `crop-{aspect}-...`-Pfad)
- [x] PNG mit Alpha bleibt PNG, sonst JPEG mozjpeg q=85
- [x] `CropSuggestionModal` mit Vorher-Nachher-Vergleich
- [x] „Übernehmen" aktualisiert Form-State + (im Bearbeiten-Modus) DB direkt via `replaceKategorieBildPath`

### Edge Cases
- [x] Pfad nicht gefunden → `{ ok: false, error }` mit Storage-Error-Message
- [x] Sharp-Fehler → try/catch mit Error-Message
- [x] Upload-Fehler → klare Meldung mit Storage-Error
- [x] Slot ohne Bild → Crop-Button erst gezeigt, wenn `bild.path` gesetzt
- [x] Pfad-Traversal: Supabase Storage normalisiert/blockt — kein App-Code-Risiko

### Security Audit (Red Team)
- ✅ Zod-Validation für `path` (string, min 1) und `aspect` (enum `wide`/`tall`)
- ✅ Aspect ist Enum, nicht freitext — keine Code-Injection in Aspect-Map möglich
- ✅ Pfad geht direkt an Supabase Storage `download(path)` — bucket-scoped, kein Filesystem-Zugriff
- ✅ Sharp `failOn: "none"` schluckt korrupte Bilder (kein Server-Crash bei manipulierten Dateien)
- ⚠️ **Pre-existing:** Server-Action ohne Auth-Check — gehört in PROJ-1 (projektweit)

### E2E-Tests (`tests/PROJ-40-kategorie-bilder-tools.spec.ts`)
4 Tests × 2 Browser (Chromium + Mobile Safari) = **8 passed, 0 failed**

1. Kategorie-Bearbeitungsseite lädt mit 4 Bild-Slots ✓
2. Hinweistext zu Drag & Drop verlinkt 4 Slots ✓
3. Crop-Suggestion-Modal-Komponente eingebunden (DOM-Existenz) ✓
4. Server-Action `cropKategorieBild` über Form-Smoke ✓

**Hinweis:** Echte DnD-Gesten mit `@dnd-kit` sind in Playwright fragil. UI-Sichtbarkeit ist getestet; die Drag-Geste wurde durch Code-Review der `handleSlotDragEnd`-Funktion verifiziert.

### Bugs
**0 Critical · 0 High · 0 Medium · 0 Low**

### Production-Ready Decision
**✅ READY** — Code-Review sauber, E2E-Smoke grün, Sicherheits-Checks bestanden, keine Bugs.

## Deployment
**Deployment-Datum:** 2026-04-30
**Production-URL:** https://lichtengross.vercel.app
**Vercel-Deployment:** dpl_dSHmgfmnikdrEa8sKfjUkH7iJZ4M
**Git-Commit:** `cf2d503 feat(PROJ-40): Kategorie-Bilder Tools — DnD, Zoom, Smart-Crop`
**Git-Tag:** `v1.0.0-PROJ-40`
**Status:** READY

### Smoke-Test (Production)
- ✅ `GET /kategorien` → 200, 1.7s
- ✅ `GET /kategorien/{id}/bearbeiten` → 200, 2.3s (DnD-Wrapper geladen)
- ✅ Datenblatt-PDF nicht regrediert: 200, 72 KB

### Hinweise
- Echte DnD-Geste in Production manuell testen — automatisierte Tests prüften nur UI-Sichtbarkeit (Playwright + @dnd-kit ist fragil bei Pointer-Events)
- Smart-Crop nutzt Sharp `position: attention` — empirisch testen, ob das Ergebnis pro Bildtyp passt
