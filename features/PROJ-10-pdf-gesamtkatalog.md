# PROJ-10: PDF-Export Gesamtkatalog

## Status: Architected
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-3 (Bereiche)
- Requires: PROJ-4 (Kategorien)
- Requires: PROJ-5 (Produkte)
- Requires: PROJ-6 (Preise)
- Requires: PROJ-8 (Logos/Einstellungen)
- Requires: PROJ-9 (Rendering-Bausteine wiederverwenden)

## User Stories
- Als Nutzer möchte ich den kompletten Produktkatalog als PDF generieren, damit ich ihn an Kunden schicken oder drucken lassen kann — im Layout identisch zum bestehenden `Katalog.pdf`.
- Als Nutzer möchte ich vor der Generierung Katalog-Parameter einstellen: Layout (Lichtengros/Eisenkeil), Preisauswahl (Listenpreis/EK), Preisänderung (plus/minus %), Währung (EUR/CHF), Sprache (DE — nur Deutsch im MVP).
- Als Nutzer möchte ich eine Fortschrittsanzeige sehen, da der Katalog groß ist (133 MB Referenz-PDF).
- Als Nutzer möchte ich, dass der Katalog in dieser Reihenfolge aufgebaut ist: Cover → Inhaltsverzeichnis → für jeden Bereich: Bereichsseite → Kategorie-Seiten (mit Artikel-Tabelle) → Datenblatt-Seiten der Artikel → … → Copyright-Rückseite.
- Als Nutzer möchte ich, dass die Seitenzahlen und Start-/Endseiten aus den Bereich-Einstellungen korrekt erzeugt werden.

## Acceptance Criteria
- [ ] Seite `/export/katalog` mit Parameter-Formular (entspricht FileMaker-Dialog „KATALOGPARAMETER"):
  - Layout: Radio (Eisenkeil / Lichtengros)
  - Preisauswahl: Dropdown (Listenpreis / EK)
  - Preisänderung: Radio (plus / minus)
  - Preisänderung in %: Zahl (Default 0,0 %)
  - Währung: Radio (Euro / CHF)
  - Sprache: Dropdown (Deutsch) — nur DE im MVP
- [ ] Button „als PDF speichern" startet Generierung
- [ ] Fortschrittsanzeige mit aktuellem Bereich/Kategorie
- [ ] Katalog-Struktur:
  - Cover vorne (aus PROJ-8)
  - Inhaltsverzeichnis
  - Pro Bereich: Bereichs-Startseite (Bild + Name) + alle zugehörigen Kategorien (Kategorie-Seite mit Artikel-Tabelle, Icons, Vorschaubild)
  - Datenblatt-ähnliche Produktdetails pro Artikel (wiederverwendete Template aus PROJ-9)
  - Preis pro Artikel: (Listenpreis ± %) in gewählter Währung
  - Abschluss: Copyright-Text, Filialenliste, Cover hinten
- [ ] Sortierung strikt nach Bereich-Sortierung → Kategorie-Sortierung → Produkt-Sortierung
- [ ] Seitennummerierung läuft durchgängig
- [ ] Output: ein einziges PDF, Download mit Dateiname `Katalog-{Layout}-{Datum}.pdf`
- [ ] EUR↔CHF: Listenpreis wird zum in Einstellungen hinterlegten Wechselkurs umgerechnet

## Edge Cases
- Was passiert bei sehr vielen Produkten (>1000)? → Batch-Generierung, evtl. Hintergrund-Job mit Benachrichtigung
- Was passiert, wenn ein Produkt keinen Preis hat? → Darstellung als „auf Anfrage" oder „—"
- Was passiert bei Abbruch/Timeout der Generierung? → Fehlermeldung + Option „Neu starten"
- Was passiert bei Preisänderung +X % mit Rundung? → Rundung auf 2 Nachkommastellen, ggf. kommerziell (0,5 auf)
- Was passiert, wenn ein Bereich keine Kategorien/Produkte hat? → Bereich wird ausgelassen oder als leere Seite gezeigt (Nutzerentscheidung — MVP: auslassen)
- Was passiert bei Generierungsdauer > 60 s? → Hintergrund-Job, Nutzer erhält Link/Benachrichtigung bei Fertigstellung
- Was passiert bei fehlenden Bildern? → Platzhalter + Warnung im Generierungs-Report

## Technical Requirements
- Server-seitige PDF-Generierung (Puppeteer auf Vercel Fluid Compute mit 300 s Timeout, oder React-PDF für schnellere Generierung)
- Gemeinsames Rendering-Template mit PROJ-9
- Streaming/Chunked-Generierung bei großen Katalogen
- Speicherung fertiger PDFs in Supabase Storage mit TTL (z.B. 7 Tage)
- Generierungszeit-Ziel: < 2 min für aktuellen Katalog-Umfang

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
/export/katalog
+-- KatalogParameterForm
|   +-- Layout Radio (Lichtengros / Eisenkeil)
|   +-- Preisauswahl Dropdown (Listenpreis / EK)
|   +-- Preisänderung Radio (plus / minus) + % Input
|   +-- Währung Radio (EUR / CHF)
|   +-- Sprache Dropdown (Deutsch, später mehr)
|   +-- Button "Katalog generieren"
+-- JobStatus
    +-- ProgressBar (Phase: Cover -> Bereich 1/20 -> ...)
    +-- Download-Link, sobald fertig
```

### Katalog-Dokumenten-Struktur
```
KatalogDocument (A4, hochkant)
+-- CoverPage (vorne, aus Einstellungen)
+-- TableOfContents (generiert aus Bereich-/Kategorie-Titeln + Seitenzahlen)
+-- Pro Bereich (sortiert):
|   +-- BereichStartPage (Name + Großes Bild)
|   +-- Pro Kategorie:
|       +-- KategoriePage (Icons, Beschreibung, Artikel-Tabelle mit Preis)
|       +-- Pro Produkt: ProduktDatenblatt-Seite (reused aus PROJ-9, inkl. Preis)
+-- CopyrightPage (Filialenliste + Copyright-Text)
+-- CoverPage (hinten)
```

### Tech-Entscheidungen
- **Gleiche Engine wie PROJ-9: `@react-pdf/renderer`**: ein Katalog-Dokument als einzelne React-Komponente, rendert hunderte Seiten.
- **Background Job Pattern**: Bei erwartbaren 1-2 min Generierung läuft das in einer **Vercel Function mit 300 s Timeout** (Fluid Compute-Default). Ergebnis-PDF wird in Supabase Storage abgelegt und per signed URL zum Download angeboten.
- **Job-Zustand** in Tabelle `katalog_jobs` (id, status, progress, pdf_url, started_by, created_at) — so kann der Client pollen.
- **Preisberechnung zentral** in einer Server-Funktion: `finalPrice = basis * (1 ± faktor) * wechselkurs` — einmal definiert, im Template nur Anzeige.
- **Seitenzahlen** werden von react-pdf automatisch vergeben; TOC wird im Second-Pass befüllt.
- **Bilder aggressiv komprimiert** (sharp auf max. 1600 px lange Kante) vor PDF-Einbettung, sonst wird das PDF 133 MB+ wie die FileMaker-Variante.

### Abhängigkeiten
- `@react-pdf/renderer` (shared mit PROJ-9)
- `sharp` — Bildkompression vor PDF-Einbindung

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
