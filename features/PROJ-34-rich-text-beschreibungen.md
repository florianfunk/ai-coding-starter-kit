# PROJ-34: Rich-Text-Editor für Beschreibungsfelder

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Erfordert: PROJ-3 (Bereiche), PROJ-4 (Kategorien), PROJ-5 (Produkte) — alle umgesetzt
- Betrifft: PROJ-9 (PDF-Datenblatt), PROJ-10 (PDF-Gesamtkatalog)

## Kontext & Problem
Die Beschreibungs- und Datenblatt-Textfelder im Backend sind aktuell einfache `<textarea>`-Felder ohne Formatierungsmöglichkeiten. Aus FileMaker übernommene Texte enthalten typografische Aufzählungspunkte (•), aber Nutzer können neue Inhalte nicht visuell strukturieren — keine Hervorhebungen, keine echten Listen, keine Markenfarben für wichtige Hinweise.

Konkret betroffene Felder:
- `produkte.datenblatt_text`, `datenblatt_text_2`, `datenblatt_text_3` (drei Textblöcke im Datenblatt-Akkordeon)
- `kategorien.beschreibung`
- `bereiche.beschreibung`

Diese Texte fließen ins Einzel-Datenblatt-PDF ([src/lib/pdf/datenblatt-document.tsx](../src/lib/pdf/datenblatt-document.tsx)) und in den Gesamtkatalog ([src/lib/pdf/katalog-document.tsx](../src/lib/pdf/katalog-document.tsx)). Formatierung muss daher sowohl im Browser als auch im PDF korrekt rendern.

## User Stories

**US-1** — Als Produktpfleger möchte ich im Beschreibungsfeld Text fett, kursiv und unterstrichen machen, damit ich wichtige technische Werte hervorheben kann.

**US-2** — Als Produktpfleger möchte ich Aufzählungslisten (•) und nummerierte Listen erstellen, damit technische Daten sauber strukturiert sind statt nur als Plain-Text mit manuell getippten Bullet-Zeichen.

**US-3** — Als Produktpfleger möchte ich einzelne Wörter farbig (in einer von ~4 Markenfarben) hervorheben können, damit z.B. „Achtung 230V" optisch heraussticht.

**US-4** — Als Produktpfleger möchte ich Text in einer kleineren Größe formatieren können, damit Fußnoten oder ergänzende Hinweise sichtbar von Haupttext abgesetzt sind.

**US-5** — Als Produktpfleger möchte ich, dass meine bestehenden FileMaker-Beschreibungen (Plain-Text mit Zeilenumbrüchen und •-Bullets) automatisch im neuen Editor angezeigt werden, ohne dass ich 400+ Produkte manuell anfassen muss.

**US-6** — Als Produktpfleger möchte ich, dass meine Formatierungen im PDF-Datenblatt und im Gesamtkatalog **identisch** zur Bildschirm-Vorschau aussehen.

## Acceptance Criteria

### Editor (Frontend)
- [ ] Toolbar enthält: **Fett**, *Kursiv*, <u>Unterstrichen</u>, Aufzählungsliste, nummerierte Liste, Textgröße (Normal/Klein), Farbe (4 vordefinierte Markenfarben + „Standard")
- [ ] Tastenkürzel funktionieren: Cmd/Ctrl+B (Fett), Cmd/Ctrl+I (Kursiv), Cmd/Ctrl+U (Unterstrichen)
- [ ] Editor zeigt Inhalt WYSIWYG: Fett im Editor sieht aus wie Fett im PDF
- [ ] Editor speichert sauberes HTML (whitelist: `<p>`, `<strong>`, `<em>`, `<u>`, `<ul>`, `<ol>`, `<li>`, `<br>`, `<span style="color:..."`>, `<span class="text-sm">`)
- [ ] Editor ist als Drop-in-Ersatz für die bestehenden `<Textarea>`-Felder eingebaut: gleicher Platzbedarf, gleiches `name`-Attribut, FormData-kompatibel
- [ ] Plain-Text-Inhalt aus DB wird beim Laden korrekt im Editor dargestellt: `\n` → `<br>`, `• ` am Zeilenanfang → `<ul><li>` (heuristisch)
- [ ] Eingefügter Text aus Word/Browser wird auf erlaubtes Subset gestrippt (kein `<font>`, kein inline-CSS außer Farbe, keine Klassen außer `text-sm`)

### Datenmodell
- [ ] DB-Spalten bleiben `text` (kein neuer Typ) — HTML wird als String gespeichert
- [ ] Bestehende Daten bleiben unverändert lesbar (Plain-Text wird beim Anzeigen automatisch konvertiert)
- [ ] Server-seitige Sanitisierung beim Speichern: nur erlaubte Tags/Attribute überleben (XSS-Schutz)

### PDF-Rendering
- [ ] Einzel-Datenblatt-PDF rendert die HTML-Formatierungen korrekt: fett, kursiv, unterstrichen, Listen, Farben, kleine Textgröße
- [ ] Gesamtkatalog-PDF rendert Beschreibungen mit identischer Formatierung
- [ ] Plain-Text-Beschreibungen (Bestandsdaten) rendern weiterhin korrekt — kein Regression

### Migration
- [ ] Keine Datenbank-Migration nötig (Spalten bleiben `text`)
- [ ] Bestehende Beschreibungen werden lazy beim ersten Öffnen im Editor in HTML konvertiert (nicht persistent — bleibt als Plain-Text in DB, bis der Nutzer speichert)

### Tests
- [ ] Unit-Test für `plainTextToHtml`-Heuristik (Bullets, Zeilenumbrüche)
- [ ] Unit-Test für HTML-Sanitizer (XSS-Vektoren werden gestrippt)
- [ ] Unit-Test für `htmlToPdfNodes`-Konverter (deckt alle erlaubten Tags ab)
- [ ] Manuelle QA: alle 5 betroffenen Formulare (Bereich, Kategorie, Produkt × 3 Textblöcke) speichern und neu laden — Formatierung erhalten
- [ ] Manuelle QA: PDF-Datenblatt mit formatiertem Text exportieren — Formatierung sichtbar

## Tech-Auswahl

**Editor:** [Tiptap v2](https://tiptap.dev/) auf Basis von ProseMirror.
- Headless React-Komponente, mit shadcn/ui-Toolbar gestylt
- Standard-Extensions: StarterKit (Bold, Italic, Listen, Paragraph), Underline, TextStyle + Color, FontSize (custom), Placeholder
- Bundle-Größe: ~80 KB gzipped — akzeptabel, lazy-loaded nur in Bearbeiten-Seiten

**HTML-Sanitizer (Server + Client):** [`isomorphic-dompurify`](https://www.npmjs.com/package/isomorphic-dompurify)
- Funktioniert in Server-Actions UND im Browser
- Whitelist-Konfig zentral in `src/lib/rich-text/sanitize.ts`

**HTML→react-pdf-Konverter:** Custom-Parser in `src/lib/pdf/html-to-pdf.tsx`
- Nutzt `htmlparser2` (~30 KB) zum Parsen
- Mappt Tags auf `<Text>` mit react-pdf-Styles
- Whitelist-driven — unbekannte Tags werden zu Plain-Text degradiert

**Begründung:** Tiptap statt Lexical/Slate, weil reife Community, gute Doku, modulare Extensions. DOMPurify, weil Industrie-Standard für HTML-Sanitisierung. Custom-PDF-Konverter, weil bestehende Lösungen (`react-pdf-html`) zu schwer und nicht mit unserem v4-Renderer kompatibel sind.

## Out of Scope
- Bilder im Rich-Text (geht über separate Felder)
- Tabellen im Rich-Text (Katalog-Tabellen werden weiterhin über `kategorien.spalten` gesteuert)
- Links (kein Use-Case im internen PDF)
- Überschriften H1/H2/H3 (Datenblatt-Layout hat eigene Titel-Felder)
- Free-Color-Picker (nur 4 Markenfarben — verhindert Wildwuchs im Katalog)
- Migration der Bestandsdaten in HTML in der DB (bleibt Plain-Text bis zum nächsten Edit)

## Offene Fragen
- Welche 4 Markenfarben? (Vorschlag: Schwarz/Standard, Lichtengros-Rot, Eisenkeil-Akzent, Warnung-Orange) — final beim Frontend-Schritt entscheiden
- Soll „Klein" auch im Katalog-Tabellen-Rendering gelten oder nur im Datenblatt? — final beim PDF-Schritt entscheiden
