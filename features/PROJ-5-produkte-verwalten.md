# PROJ-5: Produkte/Artikel verwalten (CRUD)

## Status: In Progress
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-2 (Datenmodell)
- Requires: PROJ-3 (Bereiche)
- Requires: PROJ-4 (Kategorien)

## User Stories
- Als Nutzer möchte ich ein neues Produkt anlegen mit Artikelnummer (z.B. `BL13528-60-4.8-2700-90-20`), Bereich, Kategorie und allen technischen Daten, damit ich es ins Katalog-System aufnehmen kann.
- Als Nutzer möchte ich alle Daten wie in FileMaker in übersichtlichen Blöcken pflegen: Elektrotechnische, Lichttechnische, Mechanische, Thermische Daten, Sonstige Infos, Datenblatt-Texte, Galerie-Bilder.
- Als Nutzer möchte ich mehrere Galeriebilder für ein Produkt hochladen, die später im Datenblatt als Detail-Galerie erscheinen.
- Als Nutzer möchte ich ein Flag „Artikel bearbeitet" setzen, um unfertige Produkte zu markieren (greift in PROJ-7 als Filter „unbearbeitete Produkte").
- Als Nutzer möchte ich ein Produkt duplizieren können, um ähnliche Artikelvarianten schnell anzulegen.
- Als Nutzer möchte ich ein Produkt löschen können, inkl. Bestätigung.

## Acceptance Criteria
- [ ] Produktformular mit allen Bereichen aus FileMaker:
  - **Basis:** Artikelnummer (Pflicht, unique), Bereich (Dropdown), Kategorie (Dropdown, gefiltert nach Bereich), Sortierung, Flag „Artikel bearbeitet"
  - **Elektrotechnisch:** Leistung, Nennstrom, Nennspannung, Schutzklasse, Spannungsart, Gesamteffizienz
  - **Lichttechnisch:** Lichtstrom, Abstrahlwinkel, Energieeffizienzklasse, Farbtemperatur, Farbkonsistenz SDCM, Farbwiedergabeindex CRI, Farbkonsistenz SDCM, LED-Chip, Lichtverteilung, UGR
  - **Mechanisch:** Masse (L×B×H), Länge, Breite, Höhe, Außendurchmesser, Einbaudurchmesser, Gewicht, Gehäusefarbe, Montageart, Schlagfestigkeit, Schutzart IP, Werkstoff Gehäuse, Leuchtmittel, Sockel, Rollenlänge, maximale Länge, Anzahl LED pro Meter, Abstand LED zu LED, Länge der einzelnen Abschnitte, Kleinster Biegeradius
  - **Thermisch:** Lebensdauer, Temperatur Ta, Temperatur Tc
  - **Sonstiges:** Mit Betriebsgerät (Ja/Nein), Optional-Feld, Zertifikate (CE, RoHS…)
  - **Datenblatt:** Titel, Beschreibungstext (RichText/Markdown), Galerie-Bilder (mehrere), Hauptbild, Icon-Bildleiste (aus FileMaker: Watt/Volt/Farbtemp/SMD/mt/Lumen/Cutting/IP…)
- [ ] Listen-Ansicht aller Produkte mit Filter (Bereich, Kategorie, bearbeitet/unbearbeitet)
- [ ] Produkt-Detail-Seite zeigt alle Daten übersichtlich (Read + Edit im selben Layout möglich)
- [ ] Artikelnummer ist unique; bei Duplikat klare Fehlermeldung
- [ ] Änderungen per `updated_at`/`updated_by` protokolliert
- [ ] Bildupload zu Supabase Storage; Reihenfolge der Galeriebilder sortierbar
- [ ] Button „Duplizieren" legt Kopie mit Suffix „-copy" an (Artikelnummer), setzt „Artikel bearbeitet" auf false
- [ ] Löschen mit Bestätigungsdialog

## Edge Cases
- Was passiert bei doppelter Artikelnummer? → Harter Block mit Fehlermeldung
- Was passiert, wenn ein Zahlenfeld (z.B. Leistung) nicht-numerisch befüllt wird? → Validierungsfehler mit Hinweis
- Was passiert beim Wechsel der Kategorie eines bestehenden Produkts? → Erlaubt, Warnung „Kategorie-spezifische Icons bleiben unverändert"
- Was passiert beim Löschen eines Produkts mit Preis-Einträgen? → Kaskadenlöschung der Preise, Bestätigungsdialog weist darauf hin
- Was passiert bei sehr vielen Galeriebildern? → Limit z.B. 12 Bilder pro Produkt, darüber Warnung
- Was passiert, wenn Pflichtfelder leer sind? → Formular blockiert Speichern, Feldmarkierung rot
- Was passiert, wenn der Nutzer das Formular mit ungespeicherten Änderungen verlässt? → Dialog „Änderungen verwerfen?"

## Technical Requirements
- Datenblatt-Text: entweder Markdown-Editor oder einfacher RichText (TipTap o.ä.)
- Formular-Validierung mit Zod + react-hook-form
- Formularseite < 1 s Ladezeit
- Auto-Save-Draft optional (MVP: nur manuell speichern)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
/produkte (Liste)
+-- SuchLeiste (wird in PROJ-7 erweitert)
+-- Filter (Bereich, Kategorie, bearbeitet-Flag)
+-- ProdukteTable (Artikelnummer, Name, Bereich, Kategorie, Preis, bearbeitet)

/produkte/[id]
+-- ProduktHeader (Artikelnummer, Titel, Duplizieren, Löschen, Datenblatt-Button)
+-- Tabs
|   +-- Tab "Basis" (Artikelnummer, Bereich, Kategorie, Sortierung, bearbeitet-Flag, Hauptbild)
|   +-- Tab "Elektrotechnisch" (Leistung, Spannung, Strom, Schutzklasse...)
|   +-- Tab "Lichttechnisch" (Lumen, Abstrahlwinkel, Kelvin, CRI, SDCM, LED-Chip...)
|   +-- Tab "Mechanisch" (Maße, Länge, Breite, IP, Montage, Sockel, Rollenlänge...)
|   +-- Tab "Thermisch" (Lebensdauer, Ta, Tc)
|   +-- Tab "Datenblatt-Inhalt" (Titel, Text-Editor, Icon-Leiste, Galerie)
|   +-- Tab "Preise" (ausgelagert an PROJ-6)
+-- SaveBar (sticky unten, Speichern/Verwerfen)
```

### Data Model
Alle technischen Felder flach in `produkte`-Tabelle (siehe PROJ-2). Galeriebilder in separater Tabelle `produkt_bilder` mit Sortier-Feld. Icon-Leiste (im Datenblatt oben) in `produkt_icons` (n:m).

**Dirty-State-Handling**: Das Formular merkt sich geänderte Felder und warnt beim Verlassen, wenn nicht gespeichert.

### Tech-Entscheidungen
- **Tabs-Layout statt ein Mega-Formular**: Das FileMaker-Layout hat ~50 Felder — Tabs reduzieren kognitive Last und entsprechen auch der FileMaker-Gruppierung.
- **react-hook-form + zod** für Validierung aller Feld-Typen (Zahl, Text, Bool).
- **Server Action `updateProdukt`** mit Partial-Update — nur geänderte Felder werden geschrieben.
- **Rich-Text-Editor: TipTap** (headless, shadcn-kompatibel) für Datenblatt-Text mit Markdown-Ausgabe. Fettdruck, Absätze, Listen — mehr braucht das Datenblatt nicht.
- **Galerie-Upload**: Mehrfach-Drop, Vorschau-Grid, Drag-Sort via `@dnd-kit`.
- **Artikelnummer-unique-Prüfung** per DB-Constraint + Live-Check beim Tippen (debounced).

### Abhängigkeiten
- `@tiptap/react`, `@tiptap/starter-kit` — Rich-Text
- `@dnd-kit/core`, `@dnd-kit/sortable` — Drag & Drop für Galerie

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
