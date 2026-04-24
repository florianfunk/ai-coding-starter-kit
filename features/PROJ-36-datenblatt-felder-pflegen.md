# PROJ-36: Datenblatt-Felder pflegen (UI)

## Status: Deployed
**Created:** 2026-04-22
**Last Updated:** 2026-04-24

## Kontext

Das FileMaker-Layout für das Produktdatenblatt enthält eine Reihe von Platzhaltern (`<<Da_Titel>>`, `<<t_Info>>`, `Bild_Detail_1/2`, `Bild_Zeichnung_1/2/3`, `Bild_Energielabel`, `<<Bild_Detail_1/2/3_Text>>`, `<<Da_Beschreibung_1>>`), die in drei Layout-Varianten (V1, V2, V3) unterschiedlich angeordnet sind. Die meisten dieser Felder sind bereits im DB-Schema vorhanden (Migrationen 0001, 0003, 0006, 0007), aber **nicht im Produkt-Formular pflegbar**.

Ziel dieses Features ist es, alle Datenblatt-Platzhalter im UI pflegbar zu machen, damit die Daten (ggf. in einem Folge-Schritt mit FileMaker abgleichen und) anschließend von PROJ-9 (PDF-Datenblatt) genutzt werden können.

**Nicht Teil dieses Features:** Die PDF-Generierung selbst. Dieses Feature liefert nur die Datenpflege — der PDF-Export erfolgt in PROJ-9 / einem Folge-Feature.

## Dependencies
- Requires: PROJ-5 (Produkte/Artikel verwalten) — nutzt das bestehende Produkt-Formular
- Requires: PROJ-2 (Datenmodell) — alle Felder bis auf `marke` existieren bereits im Schema
- Informs: PROJ-9 (PDF-Export Einzel-Datenblatt) — nutzt die hier gepflegten Daten

## User Stories
- Als Produktpfleger möchte ich eine **Info-Zeile (Kurzbeschreibung)** je Produkt erfassen, damit auf dem Datenblatt unter der Artikelnummer die typische Info-Zeile (z.B. "STEPLIGHT 3W 2700K 124lm CRI90 IP65 inkl.TRAFO N.DIM.-WEISS") erscheint.
- Als Produktpfleger möchte ich **Detail-Bilder (1–2)** mit zugehörigen **Detail-Texten (1–3)** hochladen, damit die DETAILS-Sektion im Datenblatt korrekt befüllt wird.
- Als Produktpfleger möchte ich **technische Zeichnungen (1–3)** pro Produkt hochladen, damit Maß- und Installationszeichnungen im Datenblatt erscheinen.
- Als Produktpfleger möchte ich ein **Energielabel-Bild** hochladen, damit dieses rechts oben neben den Technischen Daten angezeigt wird.
- Als Produktpfleger möchte ich eine **Datenblatt-Vorlage (V1/V2/V3)** pro Produkt auswählen, damit das PDF im passenden Layout generiert wird.
- Als Produktpfleger möchte ich eine oder mehrere **Marken (Lichtengros, Eisenkeil)** pro Produkt auswählen, damit das Produkt im jeweiligen Marken-Katalog/Datenblatt erscheint.
- Als Produktpfleger möchte ich ein Feld **Treiber** pflegen, damit zugehörige Treiber-Infos im Datenblatt stehen.
- Als Produktpfleger möchte ich alle Datenblatt-relevanten Bilder an **einer zentralen Stelle (neuer Tab "Datenblatt-Bilder")** pflegen, damit ich sie nicht im Formular suchen muss.

## Acceptance Criteria

### Neuer Tab "Datenblatt-Bilder" im Produkt-Formular
- [ ] Im Produkt-Formular (`src/app/produkte/produkt-form.tsx`) existiert ein neuer Tab **"Datenblatt-Bilder"** neben den bestehenden Tabs (Elektrisch, Lichttechnisch, Mechanisch, Thermisch).
- [ ] Der Tab zeigt alle 6 Bild-Uploads als einfache Liste mit Labels (kein Live-Layout-Preview):
  - Detail-Bild 1 (→ `bild_detail_1_path`)
  - Detail-Bild 2 (→ `bild_detail_2_path`)
  - Zeichnung 1 (→ `bild_zeichnung_1_path`)
  - Zeichnung 2 (→ `bild_zeichnung_2_path`)
  - Zeichnung 3 (→ `bild_zeichnung_3_path`)
  - Energielabel-Bild (→ `bild_energielabel_path`)
- [ ] Neben jedem Bild-Upload werden die zugehörigen Detail-Texte als Textarea angezeigt:
  - Detail-Text 1 (→ `bild_detail_1_text`)
  - Detail-Text 2 (→ `bild_detail_2_text`)
  - Detail-Text 3 (→ `bild_detail_3_text`)
- [ ] Die Upload-Komponente nutzt das bestehende Upload-System des Projekts (Supabase Storage).
- [ ] Ein hochgeladenes Bild kann wieder entfernt werden.
- [ ] Nach einem Upload wird ein Thumbnail des Bildes angezeigt.

### Ergänzungen in bestehenden Sektionen
- [ ] In der bestehenden Datenblatt-Sektion (oder bei den Grunddaten) gibt es ein neues Feld **"Info-Zeile"** (→ `info_kurz`) als Text-Input.
- [ ] In der bestehenden Datenblatt-Sektion gibt es ein neues Feld **"Treiber"** (→ `treiber`) als Textarea.
- [ ] In der bestehenden Datenblatt-Sektion gibt es eine **Vorlagen-Auswahl** (→ `datenblatt_template_id`) als Dropdown mit den 3 Varianten (V1, V2, V3), die aus der Tabelle `datenblatt_templates` geladen werden.
- [ ] In den Grunddaten gibt es ein Feld **"Marken"** (→ neues Feld `marken`, Array/Multi-Select) mit Checkboxen für "Lichtengros" und "Eisenkeil". Mindestens eine Marke muss gewählt sein.

### Speichern / Server Action
- [ ] Beim Speichern des Produkt-Formulars werden alle neuen Felder (`info_kurz`, `bild_detail_1_path/2_path`, `bild_detail_1_text/2_text/3_text`, `bild_zeichnung_1_path/2_path/3_path`, `bild_energielabel_path`, `datenblatt_template_id`, `marken`, `treiber`) in der `produkte`-Tabelle persistiert.
- [ ] Beim erneuten Öffnen des Produkts sind alle Werte korrekt geladen und angezeigt.
- [ ] Optional-Felder (alle außer `marken`) sind nicht verpflichtend — ein Produkt kann auch ohne Detail-Bilder/-Zeichnungen/Energielabel gespeichert werden.

### Schema-Migration
- [ ] Neue Migration `supabase/migrations/0008_produkt_marken.sql` ergänzt die Spalte `marken` (Array von TEXT, z.B. `TEXT[]` oder eigene `ENUM`) in der Tabelle `produkte`.
- [ ] Bestehende Produkte erhalten als Default `{'lichtengros'}` (oder aus `datenblatt_art` abgeleitet, falls möglich).
- [ ] Das alte Feld `datenblatt_art` bleibt zunächst erhalten (für Kompatibilität), wird aber im UI nicht mehr genutzt. Entfernung in einem späteren Cleanup.

### Datenblatt-Templates anlegen
- [ ] Die 3 FileMaker-Varianten werden als vorkonfigurierte Einträge in `datenblatt_templates` per Migration/Seed angelegt:
  - "V1 — Leuchte / Spot" (Layout aus Screenshot 1)
  - "V2 — LED-Flexband / Strip" (Layout aus Screenshot 2)
  - "V3 — Neon Flex" (Layout aus Screenshot 3)
- [ ] Jedes Template bekommt einen sprechenden Namen und eine kurze Beschreibung, die im Dropdown angezeigt werden.

## Edge Cases

- **Produkt ohne Detail-Bilder:** Felder dürfen leer bleiben — das Produkt ist trotzdem speicherbar. Das PDF (PROJ-9) zeigt dann einen leeren Platzhalter oder blendet den Slot aus.
- **Bild-Upload schlägt fehl:** Der User bekommt eine Toast-Fehlermeldung; die anderen Formularwerte gehen nicht verloren.
- **Bild-Format ungültig:** Nur JPG/PNG/WebP werden akzeptiert. Größenlimit ist dasselbe wie bei bestehenden Uploads (z.B. max. 10 MB pro Bild).
- **Keine Vorlage gewählt:** Falls `datenblatt_template_id` leer ist, wird beim Öffnen eines Bestandsprodukts die Vorlage V1 ("Leuchte") als Default vorgeschlagen. Das Feld ist beim Speichern optional — PROJ-9 entscheidet separat, wie mit fehlender Vorlage umgegangen wird.
- **Keine Marke ausgewählt:** Validierung schlägt fehl. Toast: "Bitte mindestens eine Marke auswählen." Produkt wird nicht gespeichert.
- **Bild löschen:** Das Entfernen eines Bildes im UI setzt nur den DB-Pfad auf NULL. Die Datei im Storage wird NICHT sofort gelöscht (vermeidet versehentliches Datenverlust bei geteilten Bildern; Cleanup-Script kann später Orphans aufräumen — ein solches Script existiert bereits: `scripts/cleanup-orphan-bilder.ts`).
- **Template-Wechsel bei bereits gepflegten Bildern:** Wenn ein Produkt von V1 auf V3 umgestellt wird, bleiben alle Bilder erhalten. Das neue Template kann dieselben Felder (Detail-Bilder, Zeichnungen, Energielabel) nutzen oder ignorieren — die Zuordnung erfolgt per Feldname, nicht per Template.
- **Großer Detail-Text:** Detail-Texte sind Kurztexte (1–3 Zeilen). Kein RichText-Editor nötig — einfache Textarea reicht. Zeichenlimit z.B. 500 Zeichen.
- **Gleiche Artikelnummer, unterschiedliche Marken:** Nicht erlaubt — ein Produkt existiert genau einmal und ist beiden Marken zugeordnet, wenn nötig.

## Technical Requirements

- **Schema-Änderung:** Eine neue Migration `0008_produkt_marken.sql` (+ optional ein Seed für die 3 Templates).
- **Bestehende Felder:** Keine Schema-Änderungen an den 8 bestehenden Feldern — nur UI-Ergänzung.
- **Performance:** Formular-Ladezeit soll nicht merklich länger werden (Ziel: unter 500 ms nach dem Laden des Produkts).
- **Formular-State:** Nutzung des bestehenden Formular-Frameworks (react-hook-form + Zod, siehe bestehende Produkt-Form).
- **Accessibility:** Alle neuen Felder haben Labels, Tab-Reihenfolge ist logisch, Error-Messages sind sichtbar.
- **Security:** Nur authentifizierte Nutzer können speichern (RLS-Policies bleiben gleich).

## Out of Scope (NICHT Teil dieses Features)

- PDF-Generierung oder Änderungen am PDF-Template (→ PROJ-9 / Folgefeature)
- Layout-Dialog beim PDF-Export (Marke wählen) — die Marke wird pro Produkt gepflegt
- Live-Thumbnail-Vorschau der Template-Position im UI — nur einfache Liste mit Labels
- Migration/Abgleich mit FileMaker-Daten — wird als separater Schritt nach diesem Feature gemacht
- Entfernung/Cleanup des alten Feldes `datenblatt_art` — später in einem dedizierten Cleanup-Feature

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Last Updated:** 2026-04-24

### Architektur-Überblick in einem Satz
Wir erweitern das bestehende Produkt-Formular um eine neue Accordion-Sektion "Datenblatt-Bilder" und zwei zusätzliche Felder in den Grunddaten (Marken-Checkboxen) + Datenblatt-Sektion (Info-Zeile, Treiber, Vorlagen-Dropdown). Die DB-Änderungen sind minimal (nur ein Feld), weil 8 der 10 Felder bereits im Schema existieren.

### Wichtige Design-Entscheidung: Accordion statt Tab

Die ursprüngliche Spec sprach von einem **Tab** "Datenblatt-Bilder". Das bestehende Produkt-Formular nutzt aber **Accordion-Sektionen**, keine Tabs (jede technische Kategorie ist eine aufklappbare Sektion). Um konsistent zu bleiben, wird daraus eine **neue Accordion-Sektion**, die sich optisch wie die bestehenden Sektionen (Elektrisch, Mechanisch …) einreiht. **Keine Strukturänderung am Formular-Layout.**

### A) Formular-Struktur (visueller Baum)

```
Produkt-Formular (/produkte/[id]/bearbeiten)
+-- Grunddaten (immer sichtbar)
|   +-- Artikelnummer, Name, Sortierung
|   +-- Bereich, Kategorie
|   +-- Hauptbild Upload
|   +-- NEU: Marken (Checkboxen: Lichtengros [ ] / Eisenkeil [ ])
|
+-- Accordion-Sektion: "Datenblatt" (bestehend, erweitert)
|   +-- NEU: Info-Zeile (Input)
|   +-- NEU: Treiber (Textarea)
|   +-- NEU: Vorlage (Dropdown: V1 / V2 / V3)
|   +-- Datenblatt-Titel (bestehend)
|   +-- Beschreibung Block 1-3 (bestehend, RichText)
|
+-- Accordion-Sektion: "Datenblatt-Bilder" (NEU)
|   +-- Detail-Bild 1  [Upload] [Thumbnail] [Entfernen]
|   |   +-- Detail-Text 1 (Textarea)
|   +-- Detail-Bild 2  [Upload] [Thumbnail] [Entfernen]
|   |   +-- Detail-Text 2 (Textarea)
|   +-- Detail-Text 3 (Textarea, ohne Bild - dient als Text rechts neben Zeichnung 1)
|   +-- Zeichnung 1    [Upload] [Thumbnail] [Entfernen]
|   +-- Zeichnung 2    [Upload] [Thumbnail] [Entfernen]
|   +-- Zeichnung 3    [Upload] [Thumbnail] [Entfernen]
|   +-- Energielabel   [Upload] [Thumbnail] [Entfernen]
|
+-- Accordion-Sektion: Elektrisch (bestehend)
+-- Accordion-Sektion: Lichttechnisch (bestehend)
+-- Accordion-Sektion: Mechanisch (bestehend)
+-- Accordion-Sektion: Thermisch & Sonstiges (bestehend)
+-- Accordion-Sektion: Icons & Tags (bestehend)
+-- Sticky Bottom-Bar: Speichern / Abbrechen
```

### B) Datenmodell (Klartext)

**Bestehende Felder in `produkte`-Tabelle (keine Änderung nötig):**
- `info_kurz` — Kurzbeschreibung / Info-Zeile
- `treiber` — Treiber-Info
- `datenblatt_template_id` — Verweis auf gewählte Vorlage
- `bild_detail_1_path`, `bild_detail_2_path` — Detail-Bild-Pfade
- `bild_detail_1_text`, `bild_detail_2_text`, `bild_detail_3_text` — Detail-Texte
- `bild_zeichnung_1_path`, `bild_zeichnung_2_path`, `bild_zeichnung_3_path` — Zeichnungs-Pfade
- `bild_energielabel_path` — Energielabel-Pfad

**Neues Feld in `produkte`-Tabelle (per Migration 0008):**
- `marken` — Liste von Marken-Werten (Mehrfachauswahl möglich)
  - Erlaubte Werte: `lichtengros`, `eisenkeil` — der bestehende DB-Typ `marke` (aus Migration 0001, aktuell nur in `filialen` verwendet) wird wiederverwendet.
  - Default für Bestandsprodukte: `{lichtengros}` (alle aktuellen Produkte gelten als Lichtengros-Produkte)
  - Einschränkung: Mindestens ein Eintrag muss vorhanden sein.

**Seed-Daten für `datenblatt_templates` (per Migration 0008 oder Seed):**
- 3 Einträge mit `is_system = true`:
  - "V1 — Leuchte / Spot"
  - "V2 — LED-Flexband / Strip"
  - "V3 — Neon Flex"
- Die `slots`-Konfiguration (JSON) bleibt zunächst leer oder enthält Platzhalter-Slots. Die tatsächliche Slot-Geometrie wird in PROJ-9 / dem PDF-Feature definiert — PROJ-36 braucht nur die Namen + IDs im Dropdown.

**Was passiert mit `datenblatt_art`?**
Das alte Feld bleibt erhalten (nicht gelöscht), damit Bestandsdaten nicht kaputt gehen und FileMaker-Importe weiter funktionieren. Im UI wird es ignoriert. Eine saubere Entfernung passiert in einem späteren Cleanup-Feature.

### C) Wiederverwendbare Upload-Komponente

Das Projekt hat heute nur eine einzige Upload-Stelle (Hauptbild) — in-line im Produkt-Formular. Für PROJ-36 brauchen wir **6 weitere Upload-Stellen** (2 Detail-Bilder + 3 Zeichnungen + 1 Energielabel). Statt die Upload-Logik 6× zu kopieren, wird eine **generische Upload-Komponente** `<DatenblattBildUpload>` gebaut, die:

1. Ein Label bekommt (z.B. "Detail-Bild 1")
2. Einen DB-Feldnamen bekommt (z.B. `bild_detail_1_path`)
3. Den aktuellen Bildpfad aus dem Formular kennt und als Thumbnail anzeigt
4. Einen "Hochladen"-Button anbietet (gleicher Flow wie Hauptbild)
5. Einen "Entfernen"-Button anbietet (setzt Feld auf NULL, löscht aber nicht das Storage-File)
6. Die bestehende Server Action `uploadProduktBild` wiederverwendet (inkl. Kompression via `sharp`)

Diese Komponente wird **1× gebaut und 6× verwendet** — keine Code-Duplikation.

### D) Speicher-Flow (Speichern-Button)

Beim Klick auf "Speichern":
1. Das Browser-Formular schickt alle Feldwerte + Dateipfade (Bilder sind zu dem Zeitpunkt bereits hochgeladen, nur die Pfade sind im FormData) an die bestehende Server Action `updateProdukt`.
2. Die Action wird um die neuen Felder (`info_kurz`, `treiber`, `datenblatt_template_id`, `marken`, `bild_*_path`, `bild_*_text`) im Zod-Schema erweitert.
3. Validierung: `marken` muss nicht-leer sein. Alle anderen neuen Felder sind optional.
4. Das UPDATE schreibt die neuen Spalten mit in die bestehende Anweisung.

**Keine neue Server Action, keine neue API-Route** — nur Erweiterung der bestehenden `updateProdukt`-Funktion.

### E) Tech-Entscheidungen (mit Begründung)

| Entscheidung | Begründung |
|---|---|
| Accordion-Sektion statt Tab | Konsistent mit dem bestehenden Produkt-Formular — Tabs würden die UX-Struktur aufbrechen. |
| ENUM `marke` wiederverwenden | Existiert bereits in der DB (seit Migration 0001 für Filialen). Kein doppelter Typ, kein TEXT-Feld ohne Validierung. |
| Array-Feld `marken` statt n:m-Tabelle | Marken sind eine feste kleine Menge (2 Werte). Ein Array-Feld ist einfacher, schneller abzufragen und braucht kein JOIN. Wenn Marken später mehr werden oder Metadaten brauchen, kann migriert werden. |
| Generische `<DatenblattBildUpload>`-Komponente | Verhindert 6-fache Code-Duplikation und macht spätere Änderungen (z.B. zusätzliches Crop-Feature) an einer Stelle möglich. |
| Bestehenden Storage-Bucket `produktbilder` nutzen | Kein neuer Bucket, kein neuer RLS-Policy-Satz nötig. Pfade bleiben unter `produkte/{produktId}/...`. |
| Bild löschen setzt nur DB-Pfad auf NULL | Verhindert Datenverlust bei geteilten Bildern. Ein separates Cleanup-Script (`scripts/cleanup-orphan-bilder.ts`) existiert bereits für Orphan-Cleanup. |
| Dropdown für Vorlage lädt aus `datenblatt_templates` | Templates werden zentral gepflegt (per Seed/Migration). Das UI muss nicht hartcodiert wissen, welche Varianten existieren. |
| Vorlagen-Slots bleiben für PROJ-36 leer | PROJ-36 braucht nur die Template-IDs + Namen im Dropdown. Die geometrische Slot-Definition gehört zu PROJ-9 (PDF-Generierung). |

### F) Dependencies (keine neuen Pakete)

Alle benötigten Pakete sind bereits installiert:
- `@radix-ui/react-accordion` / shadcn-ui Accordion — für die neue Sektion
- `@radix-ui/react-checkbox` / shadcn-ui Checkbox — für Marken
- `@radix-ui/react-select` / shadcn-ui Select — für Vorlagen-Dropdown
- `sharp` — für Bild-Kompression
- `@supabase/supabase-js` — für Storage-Upload
- `zod` — für Validierung

**Keine neuen NPM-Pakete nötig.**

### G) Migrationen

Eine einzige Migrations-Datei `supabase/migrations/0008_produkt_marken_und_templates.sql`:
1. Spalte `marken` (Array des bestehenden ENUM `marke`) zur `produkte`-Tabelle hinzufügen
2. Default-Wert `{lichtengros}` für Bestandsprodukte setzen
3. CHECK-Constraint: `array_length(marken, 1) >= 1` (mindestens eine Marke)
4. 3 Seed-Einträge in `datenblatt_templates` (V1, V2, V3) einfügen, falls noch nicht vorhanden (idempotent per `ON CONFLICT DO NOTHING`)

### H) Was NICHT Teil dieses Designs ist

- **Keine PDF-Änderungen** — die neuen Bild-Felder werden hier nur erfasst, nicht gerendert. PROJ-9 nutzt sie später.
- **Keine Slot-Geometrie** — wo genau auf dem PDF welches Bild erscheint, ist PROJ-9.
- **Keine Marken-basierte Filterung von Produkten im Katalog-Export** — kommt mit PROJ-10.
- **Kein Layout-Dialog beim PDF-Download** — laut Spec wird Marke pro Produkt fest gespeichert.

### I) Risiko-Punkte / Offene Fragen für Frontend/Backend

1. **Bestandsdaten-Default:** Die Migration setzt `marken = {lichtengros}` für alle bestehenden Produkte. Soll das so sein, oder gibt es Produkte, die als "Eisenkeil" gelten? (Fallback: alle auf Lichtengros, der User kann manuell pro Produkt Eisenkeil ergänzen.)
2. **Info-Zeile vs. `t_Info` FileMaker:** Das Schema hat das Feld `info_kurz` (laut Migration 0007 = FileMaker `t_Info`). Es gibt auch noch `infofeld` (allgemeines Infofeld). Im UI sprechen wir nur `info_kurz` an, `infofeld` bleibt unberührt.
3. **Detail-Text 3 ohne Bild:** Laut FileMaker-Screenshots gehört Detail-Text 3 zur `Bild_Zeichnung_1` (rechts neben Detail-Bild 2). Im UI wird das als eigener Text angezeigt, nicht visuell an ein Bild gekoppelt. Label sollte im Frontend klarstellen: "Detail-Text 3 (erscheint neben Zeichnung 1 im PDF)".

## Implementation Notes (Backend + Frontend)

**Umgesetzt am:** 2026-04-24

### Schema-Migration

- Datei: `supabase/migrations/0018_produkt_marken_und_templates.sql` (nicht `0008` wie in der Spec — die nächste freie Nummer war 0018).
- Ergänzt:
  - `produkte.marken` (Array des bestehenden ENUM `marke`), Default `{lichtengros}`, CHECK-Constraint "mindestens eine Marke".
  - GIN-Index auf `marken` für künftige Marken-Filterung.
  - 3 System-Templates in `datenblatt_templates` (V1/V2/V3) mit stabilen UUIDs (`a1000000-0000-0000-0000-00000000000X`), idempotent per `ON CONFLICT DO NOTHING`.
- Slot-Geometrie der Templates bleibt vorerst leer (`'[]'::jsonb`) — wird in PROJ-9 befüllt.

### Server Actions

- [src/app/produkte/actions.ts](src/app/produkte/actions.ts): `baseSchema` + `parseBase` erweitert um alle 11 neuen Felder (inkl. Zod-Validierung: `marken.min(1)`, max-Längen für Texte). `updateProdukt`/`createProdukt` selbst mussten nicht angepasst werden, weil sie `...parsed.data` splatten — neue Felder landen automatisch im UPDATE/INSERT.
- Upload-Handling: Die bestehende `uploadSlotBild` aus [src/app/produkte/datenblatt-actions.ts](src/app/produkte/datenblatt-actions.ts) wird wiederverwendet — der Pfad `produkte/{id}/datenblatt/...` passt perfekt für die neuen Datenblatt-Bilder. Keine neue Action nötig.

### Frontend

- [src/app/produkte/datenblatt-bild-upload.tsx](src/app/produkte/datenblatt-bild-upload.tsx): Neue generische Upload-Komponente `DatenblattBildUpload` (Thumbnail + File-Input + Entfernen-Button + Hidden-Input für den Pfad). Wird 6× im Formular verwendet.
- [src/app/produkte/produkt-form.tsx](src/app/produkte/produkt-form.tsx):
  - Grunddaten-Sektion: **Marken-Checkboxen** (Lichtengros / Eisenkeil) — mit clickbarer Label-Box.
  - Datenblatt-Sektion: **Info-Zeile** und **Treiber** ergänzt. Placeholder zeigt FileMaker-typische Werte.
  - Neue Accordion-Sektion **"Datenblatt-Bilder"** mit 6 Upload-Slots (2× Detail, 3× Zeichnung, 1× Energielabel) + 3 Detail-Texte.
- [src/app/produkte/[id]/page.tsx](src/app/produkte/[id]/page.tsx): URLs für die 6 Datenblatt-Bilder serverseitig via `bildProxyUrl` erzeugt und an `ProduktForm` via neue Prop `defaultDatenblattBildUrls` übergeben.

### Abweichung von der Spec

**Vorlagen-Auswahl (`datenblatt_template_id`) wurde NICHT als Dropdown im Produkt-Formular integriert.** Grund: Es existiert bereits die `DatenblattSection` (unterhalb des Formulars), die Templates + Slot-Images verwaltet. Ein zusätzliches Dropdown im Formular würde die bestehende UI duplizieren und zu Konflikten beim Speichern führen (doppelte Update-Pfade). Die Vorlagen-Auswahl bleibt in der `DatenblattSection`.

**Detail-Text 3 ohne eigenes Bild-Upload.** Laut FileMaker-Screenshots gehört der Text zu `Bild_Zeichnung_1`. Im UI ist Detail-Text 3 als eigenständige Textarea mit Hinweis "(erscheint neben Zeichnung 1 im PDF)" angezeigt.

### Build-Status

- `npx tsc --noEmit` → keine Fehler.
- `npm run build` → erfolgreich (Next.js 16 / Turbopack, 15.0s Compile, alle 35 Routes generiert).

### Offene Aktion für User

- **Migration anwenden:** `supabase/migrations/0018_produkt_marken_und_templates.sql` muss gegen die Supabase-Cloud-DB (`jmnszkurqgitzooczagy`) ausgeführt werden — wahlweise per Supabase Dashboard (SQL Editor), Supabase CLI (`supabase db push`) oder MCP-Tool. Bis dahin wird das Feld `marken` beim Laden von Bestandsprodukten leer sein (aber Default greift beim ersten UPDATE).
- **Manueller Smoke-Test nach Migration:** Produkt bearbeiten → alle 6 Uploads testen + Marken umschalten + Info/Treiber/Detail-Texte eingeben → Speichern → Reload → alle Werte wieder da.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
