# PROJ-9: PDF-Export Einzel-Datenblatt

## Status: In Progress
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-5 (Produkte)
- Requires: PROJ-6 (Preise)
- Requires: PROJ-8 (Logos/Einstellungen)

## User Stories
- Als Nutzer möchte ich aus der Produkt-Detailseite per Klick auf „Datenblatt" ein PDF generieren und herunterladen, das optisch dem bestehenden FileMaker-Datenblatt entspricht.
- Als Nutzer möchte ich zwischen Layout „Lichtengros" und „Eisenkeil" wählen, damit der jeweilige Markenauftritt gedruckt wird.
- Als Nutzer möchte ich eine Vorschau sehen, bevor ich das PDF herunterlade.
- Als Nutzer möchte ich das PDF mit korrektem Dateinamen (z.B. `Datenblatt-BL13528-60-4.8-2700-90-20.pdf`) bekommen.
- Als Nutzer möchte ich, dass das Datenblatt alle relevanten Infos enthält: Header mit Logo, Artikelnummer, Produktname, Hauptbild, Icons-Leiste, Technische-Daten-Liste, Cutting-Diagramm (wo relevant), Detail-Galerie, Beschreibungstext, Footer mit Filiale + „Stand: Datum".

## Acceptance Criteria
- [ ] Button „Datenblatt" in Produkt-Detailseite öffnet Layout-Auswahl-Dialog (Lichtengros/Eisenkeil)
- [ ] PDF-Vorschau im Browser (embedded) vor Download
- [ ] PDF-Layout entspricht 1:1 der Vorlage `daten/Datenblatt.pdf`:
  - Kopfbereich: „PRODUKTDATENBLATT" (links), Logo (rechts)
  - Artikelnummer und Produkttitel
  - Hauptbild links, Technische-Daten-Liste rechts (Bullet-Liste aller gepflegten technischen Felder, leere Felder ausblenden)
  - Icon-Leiste (Watt, Volt, Farbtemperatur-Icon, SMD/mt, Lumen, Cutting, IP, RoHS, CE…)
  - Cutting-Diagramm bei LED-Strips (schematisch)
  - „DETAILS" mit Galerie-Bildern (3er-Raster)
  - Beschreibungstext (Fließtext)
  - Footer: Firmenname links, „Stand: DD.MM.YYYY" rechts
- [ ] Seitenformat A4 Hochformat
- [ ] Alle Schriftarten und Farben aus Vorlage übernommen
- [ ] Umlaute und Sonderzeichen korrekt dargestellt
- [ ] Download als PDF mit Dateiname `Datenblatt-{Artikelnummer}.pdf`
- [ ] Generierung < 3 s pro Datenblatt

## Edge Cases
- Was passiert, wenn Produktbild fehlt? → Platzhalter „Kein Bild"
- Was passiert, wenn technische Daten fehlen? → Feld wird in Liste weggelassen
- Was passiert, wenn kein Preis vorhanden? → Dargestellt ohne Preis (Datenblatt zeigt meist keinen Preis, nur der Katalog tut das) — im MVP: Datenblatt ohne Preis
- Was passiert bei sehr langem Beschreibungstext? → Seite 2 (mehrere Seiten pro Datenblatt erlaubt)
- Was passiert, wenn keine Galerie-Bilder vorhanden? → „DETAILS"-Bereich wird ausgeblendet
- Was passiert beim Wechsel des Layouts? → Andere Logos, Farben, Footer-Filialen-Daten
- Was passiert bei fehlendem Logo in Einstellungen? → Platzhalter + Warnung

## Technical Requirements
- PDF-Generierung server-seitig (z.B. Puppeteer auf Vercel Fluid Compute oder React-PDF)
- Rendering-Template als React-Komponente (wiederverwendbar für PROJ-10)
- Schriftarten eingebettet
- < 3 s Generierungszeit
- Output: application/pdf

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
Produkt-Detailseite
+-- Button "Datenblatt" -> öffnet LayoutDialog (Lichtengros / Eisenkeil)
+-- /produkte/[id]/datenblatt/preview?layout=...
|   +-- PDF-iframe mit server-generiertem PDF (Stream)
+-- Download-Button -> derselbe Endpoint mit Content-Disposition: attachment
```

### PDF-Template (server-gerenderte React-Komponente)
```
DatenblattDocument
+-- Header (Logo rechts, "PRODUKTDATENBLATT" links)
+-- TitleSection (Artikelnummer, Produkttitel, Untertitel)
+-- TopRow
|   +-- Hauptbild (links, 50%)
|   +-- TechnischeDaten-Liste (rechts, 50%, leere Felder weggelassen)
+-- IconBar (Watt, Volt, Kelvin-Badge, SMD/mt, Lumen/m, Cutting, IP, RoHS, CE)
+-- CuttingDiagram (optional, bei LED-Strips mit Cutting-Unit)
+-- DETAILS-Section
|   +-- 3er-Grid der Galeriebilder
+-- Beschreibungstext (Fließtext)
+-- Footer (Marke links, "Stand: DD.MM.YYYY" rechts)
```

### Tech-Entscheidungen
- **@react-pdf/renderer** statt Puppeteer: React-Komponenten → PDF, läuft in Node, keine Chromium-Binary, schnell (<1s), gut auf Vercel Fluid Compute.
- **Gemeinsames Template für Datenblatt UND Katalog** (PROJ-10): Wiederverwendung spart Zeit und garantiert visuelle Konsistenz.
- **Schriftarten eingebettet** (woff2-Dateien in `public/fonts`, per `Font.register()` geladen).
- **Endpoint als Next.js Route Handler** (`/api/datenblatt/[id]`) mit `Accept: application/pdf` Response.
- **Layout-Theme als Prop**: Lichtengros/Eisenkeil nur andere Farben + Logo, selbes Template.
- **Bilder werden server-seitig aus Supabase Storage geladen** (keine Auth-Probleme im PDF-Kontext, da der Server die Service-Role-Key nutzt).

### Abhängigkeiten
- `@react-pdf/renderer` — PDF-Erzeugung
- Schriftarten aus dem FileMaker-Layout (vermutlich Helvetica/Arial-Klone oder Inter; konkret nach Vorlage wählen)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
