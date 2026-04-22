# PROJ-35: Kategorie mit 4 Bildplatzhaltern (Katalog-Layout)

## Status: Deployed
**Created:** 2026-04-21
**Last Updated:** 2026-04-22
**Deployed:** 2026-04-22 — https://lichtengross.vercel.app (Commit `4e196fe`)

## Dependencies
- Requires: PROJ-4 (Kategorien verwalten)
- Requires: PROJ-10 (PDF-Export Gesamtkatalog)

## User Stories
- Als Nutzer möchte ich pro Kategorie bis zu 4 Bilder hochladen (Bild1 – Bild4), damit die Kategorie-Seite im Katalog dem FileMaker-Layout entspricht.
- Als Nutzer möchte ich im Formular eine Layout-Vorschau sehen, die mir zeigt, an welcher Position und mit welcher ungefähren Größe jedes Bild im Katalog erscheint.
- Als Nutzer möchte ich den Gesamtkatalog rendern können und die Bilder genau in der geplanten Anordnung (Bild1 breit links, Bild2 breit links unten, Bild3 hochkant rechts oben, Bild4 rechts unten) im PDF sehen.

## Acceptance Criteria
- [x] DB-Schema mit `bild1_path..bild4_path` (text, nullable). `vorschaubild_path` per Migration in `bild1_path` kopiert und danach gedroppt.
- [x] Formular `kategorie-form.tsx` bietet 4 separate Upload-Slots, jeder mit eigener Vorschau-Kachel.
- [x] Unter den 4 Slots wird eine Layout-Vorschau angezeigt, die die FileMaker-Anordnung abbildet (Bild1 + Bild2 = 15×3 cm breite Felder links, Bild3 + Bild4 = 5×3 cm Felder rechts).
- [x] Listen-Ansicht `/kategorien` nutzt `bild1_path` als Miniatur (Fallback auf nächstes verfügbares Bild).
- [x] Detail-Ansicht `/kategorien/[id]` zeigt alle 4 Bilder in der Katalog-Anordnung.
- [x] Katalog-PDF-Generator lädt alle 4 Bilder pro Kategorie und rendert sie in der FileMaker-Anordnung auf der Kategorie-Hauptseite.
- [x] Migration-Skripte (`migrate-from-dataapi.ts`, `migrate-filemaker.ts`) schreiben künftig in `bild1_path`.
- [x] Build + Typecheck grün.

## Edge Cases
- Einzelne Bilder können leer bleiben — Layout-Vorschau zeigt Platzhalter, PDF lässt Slot leer (kein Rahmen).
- Backfill: Bestandsdaten mit `vorschaubild_path` werden 1:1 nach `bild1_path` kopiert, damit nichts verloren geht.
- Ältere Uploads unter `kategorien/upload-*.jpg` bleiben erhalten (Storage wird nicht angefasst).

## Technical Notes
- Storage-Pfade bleiben im Bucket `produktbilder` unter `kategorien/upload-*.ext`.
- Layout-Vorschau ist pure CSS (flex/grid), keine weitere Lib.
- Im PDF werden alle 4 Bilder via `downloadImage()` geladen (maxWidth 500, quality 75 — gleich wie bisheriges Vorschaubild).
