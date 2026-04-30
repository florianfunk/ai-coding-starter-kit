# PROJ-41: Manuelles Crop-Rechteck für Kategorie-Bilder

## Status: Architected
**Created:** 2026-04-30
**Last Updated:** 2026-04-30

## Dependencies
- Requires: PROJ-40 (Kategorie-Bilder Tools — Smart-Crop, ImageZoomModal, CropSuggestionModal)
- Requires: PROJ-4 (Kategorien verwalten)

## Kontext / Problemstellung
PROJ-40 hat Smart-Crop via `sharp.attention()` ausgeliefert. Die Strategie findet meist den richtigen Bildbereich, versagt aber bei Bildern, in denen das Wesentliche nicht der „interessanteste" Pixelbereich ist (z.B. Produktbild mit Modell darüber, Abstrakter Hintergrund mit Detail in der Ecke). Heute hat der Pfleger nur die Wahl „Smart-Crop übernehmen" oder „Original behalten" — keinen Mittelweg.

Ziel: Wenn der Smart-Crop-Vorschlag nicht passt, soll der Pfleger das Crop-Rechteck per Maus oder Touch selbst ziehen können — mit Aspect-Ratio-Lock auf den Slot. Volle Kontrolle, ohne externe Tools.

## User Stories
- Als Pfleger möchte ich nach einem unpassenden Smart-Crop-Vorschlag das Crop-Rechteck manuell anpassen, damit ich nicht das Bild extern bearbeiten und neu hochladen muss.
- Als Pfleger möchte ich beim manuellen Crop sofort sehen, wie das Endergebnis im Slot-Format aussehen wird, damit ich nicht nach dem Speichern überrascht werde.
- Als Pfleger möchte ich, dass das Aspect-Verhältnis fest am Slot hängt (5:1 oder 1:2), damit ich keinen Layout-Bruch im Katalog produzieren kann.

## Acceptance Criteria

### Workflow
- [ ] Im bestehenden `CropSuggestionModal` (PROJ-40) gibt es zusätzlich zum „Übernehmen"-Button einen Button **„Manuell anpassen"**.
- [ ] Klick auf „Manuell anpassen" wechselt das Modal vom Vorher-Nachher-Vergleich in den **Crop-Editor**.
- [ ] Crop-Editor wird mit den Koordinaten des Smart-Crop-Vorschlags als **Startwert** vorbelegt — Pfleger sieht: Smart-Crop war hier, ich passe es jetzt an.

### Crop-Editor
- [ ] Crop-Rechteck ist auf das Slot-Aspect-Ratio gelockt (5:1 für Slot 1+2, 1:2 für Slot 3+4) — kein Toggle zum Lösen.
- [ ] Pfleger kann das Rechteck per Drag verschieben.
- [ ] Pfleger kann die Größe an den Eck-/Rand-Handles ziehen — Aspect bleibt gelockt.
- [ ] Touch-Support (Mobile): Pinch ist nicht nötig, aber Drag + Resize über Handles muss auf Touch funktionieren.
- [ ] **Live-Preview** rechts neben dem Editor zeigt das Endergebnis im Slot-Format (skaliert auf passende Anzeige-Höhe ~120 px).
- [ ] Buttons: „Speichern" / „Zurück zum Vergleich" / „Schließen".
- [ ] „Zurück zum Vergleich" wechselt zurück in die Vorher-Nachher-Ansicht des `CropSuggestionModal`, ohne den Crop-Editor zu speichern.

### Speichern
- [ ] „Speichern" sendet die Crop-Koordinaten (`x`, `y`, `width`, `height` in **Pixel relativ zum Original**) an die Server-Action `cropKategorieBildManuell`.
- [ ] Server-Action lädt das Original via Sharp, extrahiert das Rechteck (`sharp.extract()`), skaliert auf Ziel-Auflösung (1500×300 / 600×1200), speichert als neue Datei mit Prefix `crop-{aspect}-{ts}-{rand}` (gleiche Konvention wie Smart-Crop).
- [ ] Original bleibt unangetastet — Pfleger kann jederzeit zurück.
- [ ] Form-State (oder bei Bearbeiten-Modus die DB) wird nach erfolgreichem Speichern aktualisiert, analog zu Smart-Crop.

### Validierung & Quellbild
- [ ] Wenn Quellbild kleiner ist als Ziel-Auflösung: trotzdem speichern, Sharp skaliert hoch (`withoutEnlargement: false`). Konsistent mit Smart-Crop-Verhalten.
- [ ] Crop-Koordinaten serverseitig validieren: `x ≥ 0`, `y ≥ 0`, `x+width ≤ origWidth`, `y+height ≤ origHeight`. Bei Verstoß `400`.
- [ ] Aspect-Toleranz auf Server: `|cropAspect - targetAspect| < 0.02`. Schützt vor Client-Manipulation.

## Edge Cases
- **Crop-Rechteck größer als Bild**: UI lässt das nicht zu (gelocktes Rechteck snappt an Bildkanten).
- **Pfleger zieht Rechteck auf Mindestgröße**: Mindestgröße = 50 px in der kürzesten Achse, sonst bricht Sharp ab.
- **Pfleger schließt Modal mitten im Editor**: Crop-State wird verworfen, Original bleibt unverändert.
- **Mehrfaches manuelles Crop in Folge**: Jedes Crop erzeugt eine neue Datei, Vorgänger werden nicht gelöscht (analog zu Smart-Crop).
- **Crop auf bereits gecropptem Bild**: Server-Action akzeptiert jeden Pfad — Pfleger kann ein gecropptes Bild erneut zuschneiden, der neue Pfad wird zum Form-State. Originalkette wird nicht getrackt.
- **Sehr großes Original (z.B. 8000×6000 px)**: Crop-Editor lädt das Bild mit `<img>`-Element, Browser handhabt Decoding. Bei wirklich extremen Größen (>50 MB) langsam, aber funktional.
- **Touch-Geräte mit kleinem Display**: Crop-Editor sollte responsiv sein — auf < 600 px Breite eventuell vertikales Layout (Editor oben, Preview unten).

## Technical Requirements
- **Performance**: Crop-Render in Server-Action < 2 s für Bilder bis 4000×3000 px.
- **Bibliothek**: `react-image-crop` (~10KB, etabliert, gute Touch-Support, Aspect-Lock built-in).
- **Backwards-Compat**: Smart-Crop-Workflow aus PROJ-40 bleibt der Default. Manuelles Crop ist ergänzend, nicht ersetzend.
- **Sicherheit**: Crop-Koordinaten via Zod validiert, Aspect-Toleranz prüft Client-Manipulation, Sharp `failOn: "none"` schluckt korrupte Bilder.

## Non-Goals
- Filter / Helligkeit / Kontrast-Anpassungen im Editor (separates Feature).
- Rotation außerhalb von EXIF-Auto-Rotation.
- Mehrere Crop-Versionen gleichzeitig vorhalten (UI zeigt immer nur die letzte).
- Aspect-Ratio-Lock lösen (bewusst nicht erlaubt — Layout-Konsistenz).
- Crop für Bereiche, Produkt-Hauptbild, Logos, Datenblatt-Slot-Bilder (jeweils eigene Features, falls gewünscht).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architektur-Idee in einem Satz
Wir erweitern das bestehende Crop-Modal aus PROJ-40 um einen zweiten Modus: einen interaktiven Crop-Editor mit live-aktualisierter Vorschau. Der Server-seitige Crop-Pfad bleibt — nur die Auswahl-Logik wird vom „attention"-Algorithmus zum Pfleger verschoben.

### Was sich für den Nutzer ändert
- Der bekannte Smart-Crop-Vorschlag erscheint wie heute. Daneben gibt es jetzt einen zusätzlichen Button **„Manuell anpassen"**.
- Klickt der Pfleger darauf, blendet sich der Vorher-Nachher-Vergleich aus und ein Crop-Editor erscheint:
  - Links das Bild mit einem verschiebbaren Crop-Rechteck (Smart-Crop-Position als Startwert)
  - Rechts daneben eine Live-Vorschau im finalen Slot-Format (5:1 oder 1:2), die sich beim Ziehen synchron aktualisiert
- „Speichern" verarbeitet den Crop wie bisher, „Zurück zum Vergleich" wechselt zurück, ohne zu speichern.

### Komponenten-Struktur

```
CropSuggestionModal (bestehend, wird erweitert)
└── Modus 1: Vorher-Nachher-Vergleich (aktuell)
│   ├── Original-Bild
│   ├── Smart-Crop-Vorschlag
│   └── Buttons: Übernehmen | Manuell anpassen ← NEU | Schließen
│
└── Modus 2: Manueller Crop-Editor (NEU)
    ├── Crop-Bereich
    │   └── Bild mit interaktivem Rechteck (react-image-crop)
    │       ├── Aspect-gelocktes Rechteck (5:1 oder 1:2)
    │       ├── Drag-Handles an Ecken + Rändern
    │       └── Verschieben über Klick & Ziehen im Inneren
    ├── Live-Vorschau-Box
    │   └── CSS-basierter Ausschnitt im Slot-Format
    └── Buttons: Speichern | Zurück zum Vergleich | Schließen

Server-Action `cropKategorieBildManuell` (NEU, parallel zu cropKategorieBild)
└── Empfängt: Pfad + Aspect + Crop-Koordinaten (x, y, width, height in Pixel)
    ├── Validierung (Zod + Aspect-Toleranz < 0.02)
    ├── Lädt Original aus Storage
    ├── Schneidet exakt das Rechteck aus (statt sharp.attention)
    ├── Skaliert auf Ziel-Auflösung (1500×300 oder 600×1200)
    └── Speichert als neue Datei mit `crop-{aspect}-…`-Pfad
```

### Daten-Modell
**Keine DB-Änderungen.** Das Feature arbeitet vollständig auf bestehenden Strukturen:
- Crop-Koordinaten werden nur transient zwischen Client und Server-Action ausgetauscht
- Storage-Pfade folgen der Konvention von PROJ-40 (`crop-{aspect}-{ts}-{rand}.{ext}`)
- Original wird wie bei Smart-Crop nicht überschrieben — der bisherige Pfad bleibt erhalten, der Pfleger kann jederzeit zurück

### Tech-Entscheidungen mit Begründung

**`react-image-crop` als UI-Library**
Etablierte React-Komponente, ~10 KB, gute Touch-Unterstützung, native Aspect-Ratio-Lock. Alternative wäre Eigenbau mit Canvas API — riskant für Mobile-Touch-Handling, viel Code, kein Mehrwert.

**Server-seitiges Crop statt Canvas-Export im Browser**
Das gecroppte Bild wird im Server mit Sharp erzeugt, nicht im Browser via Canvas. Vorteile:
- **Bessere Bildqualität**: Sharp nutzt mozjpeg-Optimierung; Canvas-JPEG ist dem deutlich unterlegen
- **Konsistente Pipeline**: Smart-Crop und manueller Crop gehen denselben Weg, gleiche Resultatsqualität
- **Kleinere Payloads**: Client schickt nur Koordinaten (paar Bytes), nicht das Bild
- **Sicherheit**: Server kann Crop-Koordinaten validieren — Client könnte sonst manipulieren

**Aspect-Ratio hart gelockt, kein Toggle**
Der Layout-Konsistenz im Katalog gegenüber. Lockern könnte verzerrte Bilder erzeugen, die später schwer zu finden und zu korrigieren sind. Bewusste Designentscheidung gegen Flexibilität, für Robustheit.

**Smart-Crop-Position als Startwert**
Der Pfleger startet immer von einem sinnvollen Crop, nicht von Null. Selbst wenn der Smart-Crop daneben lag, ist der Anfang besser als ein leeres Rechteck oder ein zentriertes Standard-Crop.

**Live-Vorschau via CSS, nicht via Server-Roundtrip**
Während des Ziehens muss kein Server angefragt werden — die Vorschau ist eine CSS-Transformation auf dem bereits geladenen Original. Sofortiges Feedback, null Server-Last bis zum „Speichern".

**Eigene Server-Action neben Smart-Crop, nicht erweitern**
`cropKategorieBild` (Smart-Crop) bleibt unverändert. Die manuelle Variante ist eine separate Server-Action mit anderem Schema (Crop-Koordinaten statt nur Aspect). Sauber getrennt — bei Bug-Fixes greift man nicht versehentlich in den anderen Pfad.

### Backend-Anpassungen
- **Eine neue Server-Action** in `src/app/kategorien/actions.ts`
- Validiert Koordinaten mit Zod (alle vier Werte müssen positiv sein, Crop muss innerhalb des Bilds liegen, Aspect muss zur Ziel-Aspect passen mit Toleranz)
- Nutzt Sharp `extract` + `resize` statt `attention`-Strategy
- Gleiche Storage-Konvention, gleiche RLS, gleicher Auth-Status wie Smart-Crop

### Frontend-Anpassungen
- **`CropSuggestionModal`** (bestehend) bekommt einen Modus-Switch (Vergleich / Editor)
- Im Editor-Modus rendert eine neue innere Komponente, die `react-image-crop` einbindet
- Live-Vorschau ist eine kleine, separate UI-Komponente, die das Original mit CSS-Transformationen ausschnittweise darstellt
- `kategorie-form.tsx` braucht eine zusätzliche Funktion analog zu `acceptCrop`, die mit den manuellen Koordinaten arbeitet

### Sicherheits-Aspekte
- Crop-Koordinaten werden serverseitig validiert: keine Pixel außerhalb des Bilds, kein negatives Width/Height, Aspect-Toleranz schützt vor Client-Manipulation
- Sharp `failOn: "none"` schluckt korrupte/manipulierte Bilder ohne Server-Crash
- Pfad geht direkt an Supabase Storage (bucket-scoped, kein Filesystem-Zugriff)
- Wie alle Server-Actions im Projekt aktuell ohne Auth-Check (Pre-existing, gehört in PROJ-1)

### Migration / Backwards-Compat
- **Keine Migration nötig**.
- Smart-Crop-Workflow aus PROJ-40 läuft unverändert weiter.
- Bestehende Kategorie-Bilder werden nicht angefasst.
- Wenn das Feature live geht, sehen Pfleger nur einen zusätzlichen Button — kein Verhalten ändert sich automatisch.

### Dependencies (eine neue Package)
| Package | Größe | Zweck |
|---|---|---|
| `react-image-crop` | ~10 KB gzipped | Aspect-gelocktes Crop-Rechteck mit Touch-Support |

Sharp und alle anderen Libs sind bereits installiert.

### Risiken & Gegenmaßnahmen
| Risiko | Gegenmaßnahme |
|---|---|
| Mobile-Touch fühlt sich unkomfortabel an (Handles zu klein) | Min-Touch-Target 44 px erzwingen, große Anfasser auf Mobile |
| Großes Original (z.B. 8000 px) lädt langsam im Editor | Browser-Decoding ist asynchron — Loading-State + Hinweis bei sehr großen Dateien |
| Pfleger speichert Crop, ist unzufrieden, Original ist „weg" | Original bleibt im Storage erhalten — UI-Hinweis im Erfolgs-Toast „Original bleibt erhalten" |
| Client manipuliert Aspect-Ratio per DevTools | Server prüft Aspect-Toleranz < 0.02; bei Verstoß 400 |
| Feature wird unbenutzt (Smart-Crop reicht meistens) | Wir tracken nichts aktiv — falls in 3 Monaten unbenutzt, Code stehen lassen, weil günstig zu pflegen, oder per Rückfrage entfernen |

### Out of Scope (erinnert)
Filter, Helligkeit, Rotation, Crop für andere Bildtypen (Bereiche, Produkt, Datenblatt-Slots) — alles eigene Features, falls gewünscht.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
