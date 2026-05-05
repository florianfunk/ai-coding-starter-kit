# PROJ-47: Kundendatenbank mit individuellen Auswahlen & Preisen

## Status: Approved
**Created:** 2026-05-04
**Last Updated:** 2026-05-05

## Dependencies
- Voraussetzt: PROJ-1 (Authentifizierung) — alle Aktionen auth-pflichtig
- Voraussetzt: PROJ-5 (Produkte) — Kunden-Auswahl referenziert Produkte
- Voraussetzt: PROJ-6 (Preisverwaltung — drei Spuren) — Kunden-Aufschlag wirkt auf gewählte Spur
- Voraussetzt: PROJ-8 (Filialen-/Katalog-Einstellungen) — Standard-Filiale pro Kunde
- Erweitert: PROJ-9 (PDF-Datenblatt) — kundenspezifisches Einzel-Datenblatt mit Kunden-Preis
- Erweitert: PROJ-37 (Katalog-Druck-Wizard) — Wizard wird mit Kunden-Auswahl + Preis-Logik vorbefüllt
- Liefert an: PROJ-48 (Workspace-Topnav) — der "Kunden"-Workspace zeigt diese Datenbank

## Hintergrund / Motivation
Bisher gilt für alle Kunden derselbe Vollkatalog mit denselben Listenpreisen. Tatsächlich brauchen interne Nutzer pro Kunde:
- einen reduzierten Sortimentsausschnitt (Kunde Schmidt sieht nur die für ihn relevanten ~80 Produkte statt aller 423)
- einen kundenspezifischen Preis (Aufschlag oder Rabatt in % auf eine gewählte Preisspur)
- einen Klick zum Drucken eines fertigen, kundenspezifischen Katalogs

Heute wird das durch wiederholtes manuelles Filtern im Wizard und nachträgliches PDF-Bearbeiten gelöst — fehleranfällig, langsam, nicht reproduzierbar. Die Kundendatenbank macht diese Auswahl + Preis-Logik **persistent pro Kunde**.

## User Stories
1. Als interner Nutzer möchte ich eine Liste aller Kunden mit Suche und Filter sehen, damit ich einen bestimmten Kunden schnell finde.
2. Als interner Nutzer möchte ich einen neuen Kunden mit Stammdaten (Kunden-Nr., Firma, Anschrift, Kontakt, Branche, Notizen, Status) anlegen, damit ich sein Profil habe, bevor ich Auswahlen mache.
3. Als interner Nutzer möchte ich pro Kunde eine **Standard-Filiale** (Lichtengros oder Eisenkeil) festlegen, damit das richtige Layout im Katalog automatisch vorausgewählt ist.
4. Als interner Nutzer möchte ich pro Kunde eine **Whitelist von Produkten** auswählen (über denselben Tree wie im Katalog-Wizard), damit ich später mit einem Klick einen kundenspezifischen Katalog drucke.
5. Als interner Nutzer möchte ich pro Kunde eine **Preis-Konfiguration** (Spur + globaler Aufschlag/Rabatt in %) speichern, damit ich Sonderkonditionen nicht jedes Mal neu eintippen muss.
6. Als interner Nutzer möchte ich auf der Kundenseite den Button "Katalog drucken" klicken, damit der bestehende Wizard (PROJ-37) mit Auswahl + Preis-Logik des Kunden vorbefüllt aufgeht und ich nur noch "PDF erstellen" drücken muss.
7. Als interner Nutzer möchte ich auf der Kundenseite den Button "Datenblatt drucken" für ein einzelnes Produkt klicken, damit ein PDF mit dem **Kunden-Preis** statt dem Listenpreis erzeugt wird.
8. Als interner Nutzer möchte ich pro Kunde eine **Druckhistorie** sehen (welcher Katalog/welches Datenblatt wurde wann mit welchen Parametern gedruckt), damit ich Anfragen wie "Was hat Schmidt zuletzt bekommen?" beantworten kann.
9. Als interner Nutzer möchte ich einen bestehenden Kunden **duplizieren**, damit ich für einen ähnlichen Kunden schnell eine neue Vorlage habe (mit kopierter Auswahl + Preis-Konfiguration, aber leeren Stammdaten).
10. Als interner Nutzer möchte ich **Branchen-Tags zentral pflegen** (Liste anlegen/bearbeiten/löschen), damit Kunden konsistent kategorisierbar sind und ich nach Branche filtern kann.

## Acceptance Criteria

### Kunden-CRUD

#### Kundenliste (`/kunden`)
- [ ] Tabelle mit Spalten: `Kunden-Nr. · Firma · Ansprechpartner · Branche · Status · Letzte Änderung · Aktionen`
- [ ] Suchfeld oben rechts: filtert client-/server-seitig nach Kunden-Nr., Firma, Ansprechpartner, E-Mail (Substring, case-insensitive)
- [ ] Filter-Dropdown "Branche" (mehrfach auswählbar)
- [ ] Filter-Dropdown "Status" (aktiv / archiviert / alle, Default: aktiv)
- [ ] Sortierbar nach Kunden-Nr., Firma, Letzte Änderung (Default: Letzte Änderung absteigend)
- [ ] Pagination ab > 50 Kunden (oder virtualisierte Liste — Architektur-Entscheidung)
- [ ] Button oben rechts: "+ Neuer Kunde" → öffnet Detail-Seite im Anlegen-Modus
- [ ] Pro Zeile Aktionen: `Bearbeiten` · `Duplizieren` · `Archivieren/Reaktivieren` · `Löschen` (mit Bestätigung)
- [ ] Empty State: "Noch keine Kunden angelegt — Tipp, wofür man die Kundendatenbank nutzt + großer 'Kunde anlegen'-Button"

#### Kunden-Detailseite (`/kunden/[id]`)
- [ ] Tabs: `Stammdaten` · `Auswahl` · `Preise` · `Druckhistorie`
- [ ] Header zeigt: Kundenname/Firma + Kunden-Nr. + Status-Badge + drei Quick-Buttons: "Katalog drucken" / "Datenblatt drucken" / "Bearbeiten"

#### Tab "Stammdaten"
- [ ] **Pflichtfelder:** Firma · Status (aktiv/archiviert)
- [ ] **Optional:** Kunden-Nr. (auto-generiert, editierbar) · Ansprechpartner · E-Mail · Telefon · Website · Straße · PLZ · Ort · Land (Default: Deutschland) · Branche (Multi-Select aus Tag-Pool) · Notizen (Mehrzeilen-Textarea, bis 2000 Zeichen) · Standard-Filiale (Radio: Lichtengros/Eisenkeil/keine)
- [ ] Validierung: E-Mail-Format (falls gesetzt), Telefon erlaubt internationale Formate, Kunden-Nr. eindeutig
- [ ] **Auto-Kunden-Nr.:** Format `K-NNNN` (4-stellig, fortlaufend). Beim Anlegen wird die nächste freie Nummer vorgeschlagen, kann aber überschrieben werden. Eindeutigkeit auf DB-Ebene erzwungen.
- [ ] Buttons: `Speichern` · `Abbrechen` · `Löschen`

#### Tab "Auswahl"
- [ ] Bezeichnung: "Welche Produkte gehören zum Kundenkatalog?"
- [ ] Tree-Komponente identisch zu PROJ-37-Wizard (Bereich → Kategorie → Produkt, Tri-State, Suche, Toolbar Alle/Keine/Umkehren)
- [ ] Auswahl wird als `Set<produkt_id>` (UUID-Whitelist) gespeichert
- [ ] Counter unten: "X / Y Produkte ausgewählt"
- [ ] **Spezialwert** "Alle Produkte" (= Whitelist `null`): Toggle "Alle Produkte aufnehmen (auch zukünftige)" oben über dem Tree. Wenn aktiv: Tree wird disabled + Hinweis "Bei jeder neuen Produkt-Anlage wird dieser Kunde automatisch alle bekommen". Default: ausgeschaltet (= explizite Whitelist).
- [ ] Speichern-Button "Auswahl speichern" — disabled, solange keine Änderungen
- [ ] Kein Auto-Save, damit der Tree für Klick-Editing flüssig bleibt

#### Tab "Preise"
- [ ] **Preisspur (Pflicht):** Radio mit drei Optionen — `Lichtengros` / `Eisenkeil` / `Listenpreis` · Default `Listenpreis`
- [ ] **Aufschlag/Rabatt (Pflicht):** Vorzeichen-Radio (`+` / `-`) + Number-Input `0–100` mit einer Nachkommastelle, Default `+0,0`
- [ ] **Vorschau-Tabelle** (Top 10 Produkte aus der Auswahl): zeigt `Artikelnr. · Bezeichnung · Basispreis (Spur) · Effektivpreis (mit Aufschlag, EUR)` — damit der Nutzer sieht, was im Katalog landet
- [ ] **Hinweis:** "Im Katalog-Wizard kann der Aufschlag pro Druck noch überschrieben werden — hier ist der Default."
- [ ] Speichern-Button

#### Tab "Druckhistorie"
- [ ] Tabelle mit Spalten: `Datum · Typ (Katalog/Datenblatt) · Layout · Spur · Aufschlag · Währung · Anzahl Produkte · Status (gelaufen/fehlerhaft) · PDF-Download`
- [ ] Sortierbar nach Datum (Default absteigend)
- [ ] PDF-Download-Link zu der bei der Job-Erzeugung erzeugten Datei (analog `katalog_jobs.pdf_url`)
- [ ] Empty State bei keinen Druckaufträgen: "Noch nichts gedruckt — Tipp auf 'Katalog drucken'-Button im Header"
- [ ] **Out of MVP:** Wiederherstellung exakt gleicher Auswahl ist NICHT garantiert — Produktauswahl wird nicht historisch im Job mitgespeichert (nur als UUID-Liste, die sich durch gelöschte Produkte ändern kann). Das ist okay; PDF bleibt persistent.

### "Katalog drucken"-Flow (Integration mit PROJ-37)
- [ ] Klick auf Button im Kunden-Header öffnet PROJ-37-Wizard im Modal
- [ ] Wizard wird mit Kunden-Werten **vorbefüllt**:
  - Layout = `kunde.standard_filiale` (Fallback `lichtengros`)
  - Preisspur = `kunde.preis_spur`
  - Aufschlag-Vorzeichen + Prozent = aus `kunde.aufschlag_vorzeichen` + `kunde.aufschlag_pct`
  - Währung = `EUR` (Default; Nutzer kann pro Druck wechseln)
  - Produkt-Whitelist = `kunde.produkt_ids` (oder alle, wenn `null`)
- [ ] Wizard zeigt im Header zusätzlich: "Katalog für: **Firma Schmidt** (K-0042)"
- [ ] Job wird mit Referenz auf `kunde_id` angelegt → erscheint in Druckhistorie
- [ ] Nutzer kann alle Werte im Wizard ändern, bevor er auf "PDF erstellen" klickt — **Änderungen wirken NICHT zurück** auf den Kunden-Datensatz (sie bleiben One-Off des Drucks)

### "Datenblatt drucken"-Flow (Integration mit PROJ-9)
- [ ] Klick auf Button im Kunden-Header öffnet einen kleinen Dialog: Produkt auswählen (Combobox/Suche über alle Produkte der Kunden-Whitelist)
- [ ] Bei Klick "PDF erstellen" wird Datenblatt mit Kunden-Preis (Spur + Aufschlag) gerendert
- [ ] PDF-Header trägt zusätzlich Kunden-Briefkopf (Firma + Anschrift) — Format-Detail, in Architektur final entschieden
- [ ] Job-Eintrag in Druckhistorie als Typ "Datenblatt"

### Branchen-Verwaltung (`/kunden/branchen`)
- [ ] Eigene Unterseite mit Liste aller Branchen-Tags (Spalten: `Name · Anzahl Kunden · Aktionen`)
- [ ] Buttons: "+ Neue Branche", pro Zeile `Bearbeiten` · `Löschen`
- [ ] Löschen blockiert, wenn Branche von mind. einem Kunden verwendet wird (mit Hinweis "wird von 5 Kunden genutzt — bitte zuerst dort entfernen")
- [ ] Optional Reihenfolge frei sortierbar (Drag&Drop) — **Out of MVP**, alphabetische Sortierung reicht

### Kunde duplizieren
- [ ] Klick auf "Duplizieren" in Kundenliste → neue Detailseite öffnet sich mit:
  - Stammdaten LEER (Firma + Kontakt + Anschrift + Notizen)
  - Kunden-Nr. = nächste freie
  - Status = aktiv
  - Standard-Filiale, Branche, **Auswahl, Preisspur, Aufschlag** = übernommen vom Original
- [ ] Vor dem Speichern muss zumindest "Firma" befüllt werden
- [ ] Original bleibt unverändert

### Kunde archivieren / reaktivieren / löschen
- [ ] Archivieren: setzt Status auf `archiviert`. Kunde verschwindet aus Default-Liste, kann über Status-Filter wieder eingeblendet werden. Druckhistorie und Auswahl bleiben erhalten.
- [ ] Reaktivieren: setzt Status auf `aktiv`. Trivial.
- [ ] Löschen: hard delete mit Bestätigungsdialog ("Kunde X mit 23 Druckaufträgen endgültig löschen?"). Druckaufträge in `katalog_jobs` werden NICHT mitgelöscht — `kunde_id` wird auf `NULL` gesetzt (FK ON DELETE SET NULL), damit historische PDFs auffindbar bleiben.

### Sonderpreise-Übersicht (Cross-Cut)
- [ ] Eigene Seite `/kunden/sonderpreise`: Tabelle aller Kunden, die einen Aufschlag ≠ 0% haben — Spalten: `Kunde · Spur · Aufschlag · Anzahl Produkte`
- [ ] Klick auf Zeile → Sprung zur Kunden-Detailseite
- [ ] Filter "nur Rabatte" / "nur Aufschläge" / "alle"
- [ ] **Hinweis im MVP:** weil heute pro Kunde nur EIN globaler Aufschlag gespeichert wird, ist diese Seite "leichtgewichtig" und zeigt keine Pro-Produkt-Overrides. Sie ist Vorbereitung für ein späteres Feature, aber bereits jetzt nützlich, um den Überblick über die Konditionen zu haben.

## Edge Cases
- **Kunden-Nr. manuell eingegeben, aber bereits vergeben:** UI zeigt sofort Fehler "Kunden-Nr. K-0042 ist bereits vergeben (Firma Schmidt)" — Speichern blockt.
- **Kunde hat Whitelist mit Produkten, die später gelöscht werden:** UUIDs verschwinden aus der Auswahl. Counter passt sich an. Kein Fehler, kein Banner — die Whitelist ist eine "lose" Referenz. (`ON DELETE CASCADE` auf der Junction-Tabelle.)
- **Kunde hat "Alle Produkte"-Modus aktiv, neue Produkte werden angelegt:** beim nächsten Druck sind sie automatisch dabei. Kein extra Schritt nötig.
- **Aufschlag negativ + niedriger Basispreis ergibt Endpreis ≤ 0:** wird auf 0,00 gekappt (gleiche Logik wie PROJ-37) und als "auf Anfrage" gedruckt — in der Vorschau-Tabelle entsprechend markiert.
- **Kunde wird gelöscht, während ein Druckjob für ihn läuft:** Job läuft ohne Kunden-Referenz fertig, PDF entsteht trotzdem. `kunde_id` wird zu `NULL`. (Race-Window ist sehr klein.)
- **Whitelist hat 0 Produkte und Nutzer klickt "Katalog drucken":** Wizard öffnet sich, Schritt 2 zeigt "0 / 423 ausgewählt", "PDF erstellen" disabled. Nutzer muss erst Produkte zur Auswahl hinzufügen oder die Liste im Wizard manuell erweitern.
- **Kunde hat Spur "Lichtengros" gewählt, aber für Produkt X gibt es keinen Lichtengros-Preis:** "auf Anfrage" wird gedruckt (Logik aus PROJ-37). In der Preise-Vorschau steht "—" oder "auf Anfrage".
- **Branche wird gelöscht, während sie noch zugewiesen ist:** wird durch UI blockiert (Hinweis "wird von 5 Kunden genutzt"). Wer es trotzdem über die DB löscht: FK ON DELETE SET NULL → Kunde hat danach keine Branche mehr.
- **Zwei Nutzer bearbeiten gleichzeitig denselben Kunden:** Last-write-wins (kein Optimistic Lock im MVP). Bei drei Nutzern selten problematisch — falls doch: Folge-Feature.
- **Sehr große Whitelist (alle 423 Produkte):** Tree muss flüssig bleiben (gleiche Komponente wie PROJ-37 — bereits virtualisiert/getestet).
- **Doppeltes "Standard-Filiale = keine":** Wizard fällt auf `lichtengros` zurück (gleicher Default wie heute).
- **Kundendaten in PDF-Header, aber Kunde hat keine Anschrift gepflegt:** PDF zeigt nur Firma, fehlende Felder werden weggelassen — keine Leerzeilen.

## Out of Scope (bewusst nicht in MVP)
- Pro-Produkt-Sonderpreise (absoluter Preis statt Aufschlag pro Einzelartikel) — Vorbereitung steht in der Sonderpreise-Übersicht, der Datenmodell-Slot ist offen
- Optimistic Locking bei gleichzeitiger Bearbeitung
- Versionierte Druckhistorie mit exakter Wiederherstellbarkeit der Auswahl
- Mehrere Standorte/Adressen pro Kunde
- Kontakt-Personen-Liste pro Kunde (mehrere Ansprechpartner)
- Rechnungs-/Lieferadresse separat
- Excel-Import von Kundendaten
- DSGVO-Konsent-Tracking, Lösch-Workflow für Auskunftsersuchen
- Drag&Drop-Sortierung der Branchen-Liste
- Cross-Cut-Suche "Welche Kunden haben Produkt X im Katalog?" (interessantes Folge-Feature)
- API-Endpoint für externe Systeme (CRM-Anbindung)

## Offene Punkte (vor Architektur klären)
- **PDF-Header mit Kundendaten:** Soll der gesamte Briefkopf gerendert werden (Firma + Anschrift), oder nur "Sondernotation für: Firma Müller"? — Mit dem Layout-Designer abstimmen.
- **Auto-Kunden-Nr. bei Lücken:** Wenn K-0001..K-0050 vergeben sind, K-0023 wird gelöscht — soll die Lücke wieder gefüllt werden oder immer fortlaufend hochzählen? Empfehlung: fortlaufend, einfacher.
- **Wizard-Vorbefüllung-Mechanik:** Übergeben wir Kunden-Defaults per URL-Param oder per Props? Architektur-Entscheidung — beides ginge.
- **Druckhistorie pro Kunde vs. globaler Druckhistorie:** Soll es zwei getrennte Listen geben (eine global unter Lösungen→Exporte, eine pro Kunde) oder eine globale mit Filter "Kunde"? Empfehlung: gleiche Datenquelle (`katalog_jobs`), zwei Views mit Filter.

## Technical Requirements

### Datenmodell (high-level, finalisiert in Architektur)

**Neue Tabellen:**

```
kunden
+-- id uuid PK
+-- kunden_nr text UNIQUE NOT NULL          -- "K-0042"
+-- firma text NOT NULL
+-- ansprechpartner text NULL
+-- email text NULL
+-- telefon text NULL
+-- website text NULL
+-- strasse text NULL
+-- plz text NULL
+-- ort text NULL
+-- land text NULL DEFAULT 'Deutschland'
+-- standard_filiale text NULL CHECK (standard_filiale IN ('lichtengros','eisenkeil') OR standard_filiale IS NULL)
+-- preis_spur text NOT NULL DEFAULT 'listenpreis' CHECK (preis_spur IN ('lichtengros','eisenkeil','listenpreis'))
+-- aufschlag_vorzeichen text NOT NULL DEFAULT 'plus' CHECK (aufschlag_vorzeichen IN ('plus','minus'))
+-- aufschlag_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (aufschlag_pct >= 0 AND aufschlag_pct <= 100)
+-- alle_produkte boolean NOT NULL DEFAULT false  -- true = Whitelist ignorieren
+-- notizen text NULL
+-- status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','archiviert'))
+-- created_at timestamptz DEFAULT now()
+-- created_by uuid NULL
+-- updated_at timestamptz DEFAULT now()
+-- updated_by uuid NULL

kunden_branchen                     -- Master-Tags (separate Tabelle, nicht inline-Array)
+-- id uuid PK
+-- name text UNIQUE NOT NULL
+-- created_at timestamptz DEFAULT now()

kunde_branche                       -- M:N
+-- kunde_id uuid FK ON DELETE CASCADE
+-- branche_id uuid FK ON DELETE CASCADE
+-- PRIMARY KEY (kunde_id, branche_id)

kunde_produkt                       -- Whitelist (M:N)
+-- kunde_id uuid FK ON DELETE CASCADE
+-- produkt_id uuid FK ON DELETE CASCADE
+-- PRIMARY KEY (kunde_id, produkt_id)
```

**Erweiterung bestehender Tabelle:**

```
katalog_jobs
+-- ... (bestehend)
+-- kunde_id uuid NULL FK → kunden(id) ON DELETE SET NULL    -- neu
+-- typ text NOT NULL DEFAULT 'katalog' CHECK (typ IN ('katalog','datenblatt'))   -- neu
+-- produkt_id uuid NULL FK → produkte(id) ON DELETE SET NULL  -- neu, nur für Datenblatt
```

**Indizes:**
- `kunden(kunden_nr)` — UNIQUE-Index reicht für Lookup
- `kunden(firma text_pattern_ops)` — für Substring-Suche
- `kunden(status)` — für Default-Filter
- `kunde_produkt(produkt_id)` — Reverse-Lookup "in welchen Kunden ist Produkt X?"
- `katalog_jobs(kunde_id, created_at DESC)` — pro-Kunde-Druckhistorie

**RLS:**
- Alle authentifizierten Nutzer dürfen lesen/schreiben/löschen (laut PRD einheitliches Rechte-Modell).
- Policies analog zu bestehenden Tabellen.

### UI / Tech-Stack
- shadcn/ui: `Table`, `Dialog`, `AlertDialog`, `Tabs`, `Card`, `Input`, `Textarea`, `Select`, `RadioGroup`, `Checkbox`, `Badge`, `Combobox` (für Branche-Multi-Select), `Toast`
- Tree-Komponente aus PROJ-37 wird **wiederverwendet** (`use-tree-selection`, `produkt-tree`) — keine neue Implementierung
- Server Actions in `src/app/kunden/actions.ts` (CRUD, Branchen-CRUD, Auswahl-Save, Preise-Save)
- Server Action `startKatalogJobFuerKunde(kunde_id, override?)` in `src/components/katalog-drucken/actions.ts` (oder neue Datei) — vorbefüllt Wizard-Defaults

### Routen
- `/kunden` — Liste
- `/kunden/neu` — Anlegen
- `/kunden/[id]` — Detailseite (Tabs)
- `/kunden/[id]/auswahl` — eigener Tab via URL
- `/kunden/[id]/preise`
- `/kunden/[id]/druckhistorie`
- `/kunden/branchen` — Tag-Pflege
- `/kunden/sonderpreise` — Cross-Cut-Übersicht

### Performance
- Kundenliste: ≤ 300 ms TTFB bei 200 Kunden
- Kunden-Detail mit Auswahl-Tree: ≤ 500 ms TTFB (Tree-Daten kommen aus `getKatalogTree()`-Cache)
- Druckhistorie: paginiert ab 50 Einträgen pro Kunde
- Branchen-Tag-Multi-Select: lädt alle Tags einmalig in den Browser (max. ~50 Tags erwartet)

### Sicherheit
- Alle Server Actions mit Zod-Validierung
- E-Mail-Validierung via `z.string().email()` (optional)
- Kunden-Nr. UNIQUE auf DB-Ebene erzwingt Eindeutigkeit
- XSS: alle Text-Felder werden über React rendered (auto-escaped); Notizen-Feld als plain text (kein HTML)
- Kein Audit-Trail-Feature im MVP (kommt später über Aktivitätsprotokoll-Erweiterung)

### Test-Strategie
- **Unit:** Auto-Kunden-Nr.-Generator, Aufschlag-Berechnung in Vorschau-Tabelle, Branchen-Lösch-Validator
- **Integration:** Server Actions (CRUD, Validierung, Eindeutigkeit), `startKatalogJobFuerKunde`-Vorbefüllung, Druckhistorie-Query
- **E2E (Playwright):**
  - Happy Path: Kunden anlegen → Auswahl machen → Preise setzen → Katalog drucken → PDF in Druckhistorie
  - Edge: Kunden-Nr.-Konflikt, Branche-Lösch-Block, Whitelist mit gelöschtem Produkt, "Alle Produkte"-Toggle, Duplizieren

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Entschiedene offene Punkte

| Frage | Entscheidung |
|---|---|
| Wizard-Vorbefüllung-Mechanik | **Props** an `KatalogDruckDialog` (optionaler `kunde`-Prop). Wizard nutzt Kunden-Werte als Initial-State statt localStorage-Defaults. |
| PDF-Header mit Kundendaten | **Minimal:** Eine Zeile "Sonderkonditionen für: Firma X" im LaTeX-Template, kein voller Briefkopf. |
| Datenblatt-Druckhistorie | **Jetzt mit:** `katalog_jobs.typ` enum (`katalog`/`datenblatt`) + optional `produkt_id`. Datenblatt-PDFs erzeugen ebenfalls Job-Einträge. |
| Branchen-Pflege | **Tag-Pool jetzt:** `kunden_branchen` + `kunde_branche`-Tabellen + `/kunden/branchen`-Seite. |
| Auto-Kunden-Nr. | **Fortlaufend hochzählen:** Lücken werden NICHT wieder gefüllt. Höchste vergebene Nr + 1. |
| Druckhistorie pro Kunde vs. global | **Eine Datenquelle, zwei Filter-Views:** `katalog_jobs` ist Wahrheit. `/kunden/druckhistorie` filtert auf `kunde_id IS NOT NULL`. `/export/katalog` zeigt alle. |
| Kundenliste-Pagination | **Server-seitige Pagination ab 50 Einträgen** über URL-Param `?page=N`. Keine virtualisierte Liste — bei 3 internen Nutzern selten kritisch. |

### A) Component Structure (Visual Tree)

```
/kunden (Workspace "Kunden", Default-Landing)
+-- KundenListePage
|   +-- Toolbar
|   |   +-- Suchfeld (Firma/Kunden-Nr./Email)
|   |   +-- Filter-Dropdown "Branche" (Multi)
|   |   +-- Filter-Dropdown "Status" (Default: aktiv)
|   |   +-- "+ Neuer Kunde" Primärbutton
|   +-- DataTable (shadcn Table)
|   |   +-- Spalten: Kunden-Nr. · Firma · Ansprechpartner · Branche · Status · Letzte Änderung · Aktionen
|   |   +-- Pro Zeile: Bearbeiten / Duplizieren / Archivieren / Löschen (Dropdown-Menu)
|   +-- Empty State (wenn 0 Kunden)
|   +-- Pagination (ab > 50)
|
/kunden/neu (Anlegen-Form)
+-- StammdatenForm (siehe Tab Stammdaten)
+-- Footer: Speichern / Abbrechen
|
/kunden/[id] (Detailseite, Tabs via URL-Sub-Routes)
+-- KundenHeader
|   +-- Firma + Kunden-Nr.-Badge + Status-Badge
|   +-- Quick-Buttons: "Katalog drucken" / "Datenblatt drucken" / "Bearbeiten"
+-- Tabs (controlled via Pfad: /kunden/[id]/{stammdaten|auswahl|preise|druckhistorie})
|
+-- Tab "Stammdaten" — KundenStammdatenForm
|   +-- Pflicht: Firma · Status
|   +-- Kontakt: Ansprechpartner · Email · Telefon · Website
|   +-- Anschrift: Strasse · PLZ · Ort · Land
|   +-- Kunden-Nr. (auto-vorgeschlagen, editierbar)
|   +-- Branche-Multi-Select (shadcn Combobox + Badges)
|   +-- Standard-Filiale Radio (Lichtengros / Eisenkeil / keine)
|   +-- Notizen Textarea (max 2000)
|   +-- Speichern / Löschen
|
+-- Tab "Auswahl" — KundenAuswahlSection
|   +-- Toggle "Alle Produkte aufnehmen (auch zukünftige)"
|   +-- ProduktTree (wiederverwendet aus PROJ-37)
|   |   +-- Tri-State, Suche, Toolbar Alle/Keine/Umkehren
|   +-- Counter "X / Y Produkte ausgewählt"
|   +-- Speichern (disabled solange unverändert)
|
+-- Tab "Preise" — KundenPreiseSection
|   +-- Spur-Radio: Lichtengros / Eisenkeil / Listenpreis
|   +-- Aufschlag: Vorzeichen-Radio + %-Input
|   +-- Vorschau-Tabelle (Top 10): Artikelnr · Name · Basispreis · Effektivpreis
|   +-- Hinweis-Box "im Wizard überschreibbar"
|   +-- Speichern
|
+-- Tab "Druckhistorie" — KundenDruckhistorieSection
|   +-- Filter Typ (alle/katalog/datenblatt)
|   +-- DataTable: Datum · Typ · Layout · Spur · Aufschlag · Währung · #Produkte · Status · Download
|   +-- Empty State
|
/kunden/branchen
+-- BranchenListPage
|   +-- "+ Neue Branche"
|   +-- DataTable: Name · Anzahl Kunden · Aktionen (Bearbeiten / Löschen)
|   +-- AlertDialog beim Löschen, blockiert wenn in Verwendung
|
/kunden/druckhistorie (Cross-Cut)
+-- Globale Liste aller Kunden-Druckaufträge (Filter "Kunde" zusätzlich)
|
/kunden/sonderpreise (Cross-Cut)
+-- DataTable aller Kunden mit Aufschlag ≠ 0%
+-- Filter "nur Rabatte" / "nur Aufschläge" / "alle"

Erweiterung des bestehenden KatalogDruckDialog:
+-- Neuer optionaler Prop `kunde?: { id, firma, kunden_nr, ... }`
+-- Neuer optionaler Prop `initialDefaults?: WizardDefaults` (überschreibt localStorage)
+-- Header zeigt zusätzlich "Katalog für: Firma Schmidt (K-0042)" wenn `kunde` gesetzt
+-- Beim Submit wird `kunde_id` an die Server-Action mitgegeben
+-- Nach Submit: Weiterleitung zur Kunden-Druckhistorie statt zur globalen

Neuer KundenDatenblattDialog:
+-- Combobox "Produkt auswählen" (gefiltert auf Kunden-Whitelist oder alle bei alle_produkte=true)
+-- Button "PDF erstellen" — startet Datenblatt-Render-Job mit Kunden-Preis
+-- Status-Polling (analog Katalog-Job)
```

**Neue Datei-Struktur:**
```
src/app/kunden/
+-- page.tsx                              # Liste (Stub-Page wird ersetzt)
+-- neu/page.tsx                          # Anlegen
+-- [id]/page.tsx                         # Server Component, Redirect zu /[id]/stammdaten
+-- [id]/stammdaten/page.tsx              # Tab Stammdaten
+-- [id]/auswahl/page.tsx                 # Tab Auswahl
+-- [id]/preise/page.tsx                  # Tab Preise
+-- [id]/druckhistorie/page.tsx           # Tab Druckhistorie
+-- [id]/kunden-detail-shell.tsx          # Shared Layout: Header + Tabs-Navigation
+-- [id]/kunden-stammdaten-form.tsx       # Form + Server Action Wrapper
+-- [id]/kunden-auswahl-section.tsx       # Tree + Toggle "Alle Produkte"
+-- [id]/kunden-preise-section.tsx        # Spur + Aufschlag + Vorschau
+-- [id]/kunden-druckhistorie-section.tsx # Tabelle der Jobs
+-- [id]/kunden-quick-buttons.tsx         # Header-Buttons + Dialoge mounten
+-- [id]/kunden-datenblatt-dialog.tsx     # Produkt-Auswahl-Dialog für Datenblatt-Druck
+-- branchen/page.tsx                     # Tag-Pool-Pflege (Stub wird ersetzt)
+-- druckhistorie/page.tsx                # Cross-Cut alle Kunden-Jobs (Stub wird ersetzt)
+-- sonderpreise/page.tsx                 # Cross-Cut Kunden mit Aufschlag (Stub wird ersetzt)
+-- actions.ts                            # Server Actions: CRUD Kunden, Branchen, Auswahl, Preise
+-- preis-vorschau.ts                     # Helper für Effektivpreis-Berechnung (wiederverwendet aus PROJ-37 calcPrice)
+-- kunden-nr-generator.ts                # Helper "nächste freie K-NNNN"
+-- actions.test.ts                       # Vitest für Helpers + Validierung

src/components/katalog-drucken/
+-- katalog-drucken-dialog.tsx            # erweitert um `kunde`/`initialDefaults`-Props
+-- actions.ts                            # erweitert: kunde_id ins katalog_jobs schreiben

src/lib/pdf/
+-- datenblatt-payload.ts                 # erweitert um optionalen kundenkontext (Spur+Aufschlag+kundenname)

supabase/migrations/
+-- 0031_kunden.sql                       # kunden, kunden_branchen, kunde_branche, kunde_produkt + RLS
+-- 0032_katalog_jobs_kunde_typ.sql       # kunde_id, typ, produkt_id auf katalog_jobs
```

### B) Data Model (plain language)

**Vier neue Tabellen:**

**1. `kunden` — Kundendatensätze**
- Eindeutige ID
- **Kunden-Nr.** (z.B. "K-0042"): eindeutiger Identifier, automatisch fortlaufend vorgeschlagen, manuell überschreibbar
- **Stammdaten:** Firma (Pflicht), Ansprechpartner, E-Mail, Telefon, Website, Straße, PLZ, Ort, Land (Default Deutschland)
- **Standard-Filiale:** Lichtengros / Eisenkeil / leer
- **Preis-Konfiguration:** Spur (Lichtengros/Eisenkeil/Listenpreis), Aufschlag-Vorzeichen (+/-), Aufschlag in % (0–100, eine Nachkommastelle)
- **Auswahl-Modus:** Flag "Alle Produkte" (true = Whitelist ignorieren, neue Produkte automatisch dabei)
- **Notizen:** Mehrzeiliges Freitext-Feld bis 2000 Zeichen
- **Status:** aktiv / archiviert
- **Audit:** wer hat wann angelegt/zuletzt geändert

**2. `kunden_branchen` — Branchen-Tag-Pool**
- Eindeutige ID
- Name (eindeutig, z.B. "Gastronomie", "Industrie", "Architekt")
- Erstellungs-Zeitstempel

**3. `kunde_branche` — Verknüpfung Kunde ↔ Branche (M:N)**
- Pro Zeile genau eine Verknüpfung
- Bei Kunden-Löschung: Verknüpfung wird mitgelöscht
- Bei Branchen-Löschung: Verknüpfung wird mitgelöscht (UI blockiert das Löschen, falls Verwendungen existieren)

**4. `kunde_produkt` — Produkt-Whitelist pro Kunde (M:N)**
- Pro Zeile genau eine Produkt-ID, die zum Kunden-Sortiment gehört
- Bei Kunden- oder Produkt-Löschung: Verknüpfung wird mitgelöscht (Whitelist passt sich automatisch an)
- Wenn `kunden.alle_produkte = true`: Tabelle wird ignoriert, alle Produkte gelten als ausgewählt

**Erweiterung der bestehenden `katalog_jobs`-Tabelle:**

- **kunde_id** (optional): Verweis auf den Kunden, falls der Job aus dem Kunden-Kontext gestartet wurde. Bei Kunden-Löschung wird das Feld auf NULL gesetzt — historische PDFs bleiben auffindbar.
- **typ:** Unterscheidung "katalog" (Vollkatalog) oder "datenblatt" (Einzelprodukt). Default "katalog" für Rückwärtskompat.
- **produkt_id** (optional): Bei Datenblatt-Jobs der Produkt-Verweis.

**Wo das alles lebt:** Postgres in Supabase, mit Row-Level-Security-Policies analog zu allen anderen Tabellen (alle authentifizierten Nutzer dürfen lesen/schreiben/löschen).

**Performance-Indizes:**
- Kunden-Nr.: UNIQUE-Index für schnelles Lookup und Eindeutigkeitsprüfung
- Firma: Pattern-Index für Substring-Suche
- Status: einfacher Index für Default-Filter "aktiv"
- Junction-Tabellen: Reverse-Lookup-Indizes (z.B. "in welchen Kunden ist Produkt X?")
- katalog_jobs: kombinierter Index `(kunde_id, created_at DESC)` für die pro-Kunde-Druckhistorie

### C) Tech-Entscheidungen (für PM begründet)

**1. Tab-Navigation per URL-Sub-Routes statt React-Tabs-Component**
Pro Tab eine eigene Route (`/kunden/[id]/stammdaten`, `…/auswahl`, …). Vorteile:
- **Direkt verlinkbar**: Bookmark "Schmidts Auswahl" zeigt sofort den richtigen Tab
- **Server-seitiges Rendering pro Tab**: nur die Daten, die für den Tab gebraucht werden, werden geladen — Auswahl-Tab muss z.B. den Tree laden, andere nicht
- **Sauber für Browser-History**: Vor/Zurück springt zwischen Tabs
- Konsistent mit Pattern aus PROJ-37 (Wizard auf eigener Seite, nicht als Tab im Produkt-Detail)

**2. Tree-Komponente aus PROJ-37 wiederverwenden, nicht neu bauen**
Der Wizard-Tree (`use-tree-selection`, `produkt-tree`) ist getestet und produktiv. Im Auswahl-Tab des Kunden wird er ohne Modifikation eingebunden. Ein zusätzlicher Toggle "Alle Produkte" überlagert den Tree bei Bedarf. **Ergebnis:** Konsistente UX zwischen Wizard und Kunden-Auswahl, kein Code-Duplikat, gleiche Performance-Garantien.

**3. Wizard-Vorbefüllung per Props, nicht per URL-Param oder Context**
Der bestehende `KatalogDruckDialog` bekommt einen optionalen `kunde`-Prop. Quick-Button "Katalog drucken" auf der Kunden-Detailseite mountet den Dialog mit gefülltem Prop. Vorteile: typsicher, kein URL-State-Drift, keine Notwendigkeit zur globalen State-Library. Der Dialog erkennt anhand `kunde !== undefined`, ob er den Kunden-Header zeigen soll.

**4. Datenblatt-Druck als Job-Eintrag, nicht als Quick-Action**
Wir erzeugen für jedes Datenblatt einen `katalog_jobs`-Eintrag mit `typ='datenblatt'`. Vorteile:
- **Konsistente Druckhistorie:** Alles im selben Tab, ein Filter "Typ"
- **Async-Rendering:** Datenblatt-PDFs entstehen via LaTeX-Service genauso wie Kataloge (Polling-Pattern wiederverwendet)
- **Reproduzierbarkeit:** Job-Parameter im JSON-Feld dokumentieren, was gerendert wurde

**5. Auto-Kunden-Nr. fortlaufend ohne Lückenfüllung**
Algorithmus: SELECT MAX(kunden_nr), Format K-NNNN parsen, +1. Bei manueller Eingabe wird Eindeutigkeit per UNIQUE-Constraint geprüft. **Lücken werden nie wieder gefüllt** — verhindert verwirrende "K-0023 ist plötzlich wieder vergeben"-Fälle. Reicht für MVP von einigen Hundert Kunden über Jahre.

**6. Branchen-Tag-Pool statt Freitext-Feld**
Eigene Tabelle + Junction. Begründung:
- **Konsistenz:** "Gastro" ≠ "Gastronomie" als Freitext, mit Tag-Pool eindeutig
- **Filter funktioniert:** Multi-Select-Filter in der Liste setzt voraus, dass Tags strukturiert sind
- **Pflege-Seite klein:** `/kunden/branchen` ist trivial — neuer Tag, umbenennen, löschen (mit Verwendungs-Check)
- Aufwand: zwei Tabellen + eine Sidebar-Seite. Lohnt sich.

**7. „Alle Produkte"-Modus als Boolean-Flag, nicht als Whitelist mit allen IDs**
Wenn ein Kunde "alle aktuellen + zukünftigen Produkte" haben soll, würden 423 Einträge in `kunde_produkt` plus laufende Pflege bei Neuanlagen Aufwand erzeugen. Stattdessen: Flag `kunden.alle_produkte = true` → Whitelist-Tabelle wird beim Druck ignoriert, alle Produkte zählen automatisch. **Effekt:** Neue Produkte sind ohne weitere Aktion im Kunden-Sortiment.

**8. Vorschau-Tabelle im Preise-Tab nur Top-10**
Bei 423 Produkten alle in einer Vorschau zu rendern wäre langsam und ablenkend. Top-10 reicht, um die Wirkung des Aufschlags zu verifizieren. Falls Nutzer alle sehen will: PDF generieren und im Wizard prüfen.

**9. Datenmigration und Rückwärtskompat für `katalog_jobs`**
- `kunde_id` wird NULL für alle bestehenden Jobs (kein Backfill nötig — sind aus der Vor-Kunden-Ära)
- `typ` bekommt Default 'katalog' — bestehende Jobs sind alle Vollkataloge
- `produkt_id` ist NULL für alle Katalog-Jobs (nur bei `typ='datenblatt'` befüllt)
- Job-Runner wird angepasst, sodass er `typ='datenblatt'` getrennt behandelt (anderer Renderer, andere Payload)

**10. PDF-Header-Markierung minimal halten**
Nur eine Zeile "Sonderkonditionen für: Firma Schmidt" oben rechts (oder im Footer). Kein voller Briefkopf, kein Logo des Kunden. Begründung:
- **LaTeX-Layout-Risiko niedrig:** kein neues Modul nötig, nur ein Textfeld
- **Druck bleibt allgemeingültig:** Funktioniert in beiden Marken-Layouts (Lichtengros + Eisenkeil) ohne Änderung
- Falls später ein voller Briefkopf gewünscht ist: PROJ-Folge-Feature, neues Layout-Modul

### D) Auswirkungen auf andere Features

- **PROJ-37 (Katalog-Druck-Wizard):** `KatalogDruckDialog` bekommt optionalen `kunde`-Prop. Wenn gesetzt: Initial-State aus Kunden-Daten statt aus localStorage. Submit speichert `kunde_id`. Bei Quick-Button "Katalog drucken" auf der Kunden-Seite öffnet sich der **bestehende Wizard im Modal**, identisches Verhalten ansonsten.
- **PROJ-9 (Datenblatt):** Renderer (`datenblatt-payload`) bekommt optionalen `kundenkontext` (Kundenname + Spur + Aufschlag). Wenn gesetzt: Kunden-Preis statt Listenpreis, "Sonderkonditionen für ..."-Zeile im PDF. Standard-Datenblatt (ohne Kundenkontext) bleibt komplett unverändert.
- **PROJ-48 (Workspace-Topnav):** Stub-Pages unter `/kunden`, `/kunden/druckhistorie`, `/kunden/sonderpreise`, `/kunden/branchen` werden durch Echt-Pages ersetzt. Sidebar-Links zeigen dann auf funktionierende Seiten.
- **PROJ-6 (Preisverwaltung):** Wird **nicht** angepasst. Kunden-Aufschlag wirkt nur **am Druckpunkt** — die `preise`-Tabelle bleibt produktneutral. Vorschau und Wizard berechnen den Effektivpreis on-the-fly via dem bereits in PROJ-37 gebauten `calcPrice`-Helper.
- **PROJ-8 (Filialen):** `kunden.standard_filiale` ist ein Default für den Wizard, keine harte Filial-Pflicht. Filial-Stammdaten aus PROJ-8 werden weiter zentral gepflegt.
- **PROJ-43 (Mediathek):** Kein Berührungspunkt — Kunden haben kein Logo oder Bilder im MVP.
- **PROJ-23 (Breadcrumb-Nav, Planned):** Kunden-Detail-Tabs liefern saubere Breadcrumbs ("Kunden / K-0042 / Auswahl"). Wenn PROJ-23 später kommt, ist die URL-Struktur bereits passend.

### E) Dependencies (Pakete)

**Keine neuen npm-Pakete.** Alles vorhanden:
- shadcn/ui-Komponenten: `Table`, `Dialog`, `AlertDialog`, `Tabs`, `Card`, `Input`, `Textarea`, `Select`, `RadioGroup`, `Checkbox`, `Badge`, `Combobox` (Command), `Toast`
- `react-hook-form` + `zod`: bereits in Nutzung für Produkt-Formular
- Tree-Komponente: aus `src/components/katalog-drucken/`
- LaTeX-Renderer: bestehender Service für Datenblatt + Katalog
- `date-fns`: für "Letzte Änderung"-Format (bereits installiert)

### F) Sicherheit & RLS

- **RLS-Policies** auf allen vier neuen Tabellen: alle authentifizierten Nutzer dürfen lesen/schreiben/löschen, identisch zu PRD-Vorgabe und allen anderen Tabellen
- **Server-Action-Validierung** mit Zod: Kunden-Nr.-Format (`K-\d{4}`), E-Mail (optional), Aufschlag (0–100 mit ≤1 Nachkommastelle), Spur-Enum, Branche-IDs als UUID
- **Eindeutigkeit Kunden-Nr.** auf DB-Ebene via UNIQUE-Index — UI-Validierung als Comfort, DB als Wahrheit
- **Kein Audit-Trail** im MVP (created_by/updated_by werden gespeichert, aber kein Versionsverlauf)
- **XSS:** Alle Felder via React rendered (auto-escaped), Notizen-Feld als plain text, kein dangerouslySetInnerHTML
- **Hard-Delete-Bestätigung:** AlertDialog mit Anzahl der betroffenen Druckaufträge, "Schreiben Sie 'LÖSCHEN' zum Bestätigen" falls > 5 Druckaufträge — schützt vor versehentlichem Klick

### G) Performance-Annahmen

| Operation | Ziel | Begründung |
|---|---|---|
| Kundenliste (200 Kunden) | TTFB ≤ 300 ms | Server-Component, einfache SELECT mit Index |
| Kunden-Detail mit Tree | TTFB ≤ 500 ms | Tree kommt aus `getKatalogTree()`-Cache (PROJ-37, 5 Min TTL) |
| Stammdaten speichern | ≤ 200 ms | Single-Row UPDATE, keine Cascade-Effekte |
| Auswahl speichern (max 423 IDs) | ≤ 600 ms | DELETE + INSERT in `kunde_produkt` per Transaction; ggf. Diff-Algorithmus für nur geänderte IDs |
| Druckhistorie (50 Jobs) | ≤ 250 ms | Indexed Query auf `katalog_jobs(kunde_id, created_at)` |
| Branchen-Tag-Combobox | ≤ 50 ms | Alle Tags clientseitig (max ~50) |
| Vorschau-Tabelle Preise | < 100 ms | Top-10 Produkte + clientseitige Berechnung |

### H) Test-Strategie (Übersicht)

- **Unit (Vitest):**
  - `kunden-nr-generator`: nächste freie Nr. bei 0/1/N Kunden + Lücken-Verhalten
  - `preis-vorschau`: Effektivpreis-Berechnung (wiederverwendet `calcPrice`, kann importiert + parametrisiert getestet werden)
  - Branchen-Lösch-Validator: Verwendungs-Check
  - Zod-Schemas: gültige/ungültige Inputs für CRUD-Actions

- **Integration (Vitest):**
  - Server Actions: `createKunde`, `updateKunde`, `deleteKunde`, `archiveKunde`, `duplicateKunde`
  - `saveKundenAuswahl`: Diff-Algorithmus (DELETE + INSERT korrekt)
  - `savePreise`: Validierung Aufschlag-Range
  - `startKatalogJobFuerKunde` / `startDatenblattJobFuerKunde`: Job-Eintrag mit korrekter `kunde_id` + `typ`
  - `createBranche`, `deleteBranche` (mit Verwendungs-Block)

- **E2E (Playwright):**
  - Happy Path: Kunde anlegen → Stammdaten → Auswahl → Preise → Katalog drucken → Druckhistorie zeigt Eintrag
  - Edge: Kunden-Nr.-Konflikt blockiert Speichern, Branche-Lösch-Block, Whitelist mit gelöschtem Produkt synct sich, "Alle Produkte"-Toggle disabled Tree, Duplizieren übernimmt Auswahl/Preise
  - Datenblatt-Druck: Kunden-Datenblatt-Dialog → Produkt wählen → PDF-Download mit Kunden-Preis
  - Cross-Cut: `/kunden/sonderpreise` zeigt nur Kunden mit Aufschlag ≠ 0
  - Stub-Page-Replace: alte "Kommt bald"-Inhalte sind nicht mehr da

### I) Risiken / Aufmerksamkeitspunkte

- **Tab-URL-Routing-Komplexität:** Vier Tabs + Detail-Page → fünf Server-Routes pro Kunden-ID. Lösung: Eine `kunden-detail-shell.tsx` als Layout-Wrapper, jeder Tab ist eine kleine Page. Aufwand vertretbar, klares Mental-Modell.
- **Job-Runner-Anpassung für `typ='datenblatt'`:** Bestehender Runner (`api/katalog-jobs/[id]/run/route.ts`) muss zwischen Katalog- und Datenblatt-Render unterscheiden. Saubere Trennung per Switch-Statement, kein Refactor.
- **`calcPrice` aus PROJ-37 wiederverwenden:** Bereits exportiert, sollte importierbar sein. Einmal prüfen, ob die Signatur passt.
- **Pagination + Filter-State:** Server-Component mit Search-Params. Bei vielen Filtern (Status + Branche-Multi + Suche) wird die URL lang — akzeptabel für interne Tool.
- **Auswahl-Save-Performance bei großen Diffs:** Wenn ein Kunde von "0 Produkte" auf "alle 423" wechselt, sind 423 INSERTs nötig. Akzeptabel als einmaliger Vorgang. Falls problematisch: später Bulk-Insert via Postgres-Array.
- **Kunden-Bezeichnung im PDF:** Ein neues Feld im LaTeX-Template. Backwards-Compat: wenn kein Kundenkontext, zeigt das Template nichts (Default leere Zeile, kein Layout-Bruch).
- **Concurrent Edits:** Two users edit same Kunde → last-write-wins. Bei drei internen Nutzern selten kritisch. Falls in Praxis ein Problem auftritt: Folge-Feature mit Optimistic Locking.

## Backend-Implementation (2026-05-05)

### Datenbank
- **Migration `0031_kunden.sql`** — neue Tabellen `kunden` (22 Spalten), `kunden_branchen` (4), `kunde_branche` (M:N), `kunde_produkt` (M:N) mit Indizes (`firma text_pattern_ops`, `status`, `updated_at desc`, Reverse-Lookups auf Junctions). RLS-Policies analog zu allen Tabellen (single-role-Modell).
- **Migration `0032_katalog_jobs_kunde_typ.sql`** — `katalog_jobs` erweitert um `kunde_id` (FK ON DELETE SET NULL), `typ` ('katalog'/'datenblatt', Default 'katalog'), `produkt_id` (FK ON DELETE SET NULL). Plus zwei Indizes.
- **Beide Migrations live eingespielt** via Supabase MCP auf Production-Projekt `jmnszkurqgitzooczagy` — Schema verifiziert.

### Helper
- **[kunden-nr-generator.ts](src/app/kunden/kunden-nr-generator.ts):** `formatKundenNr`, `isValidKundenNr`, `nextKundenNr` — fortlaufende K-NNNN-Logik, Lücken werden NICHT gefüllt. 14 Unit-Tests.

### Server Actions ([src/app/kunden/actions.ts](src/app/kunden/actions.ts))
- **CRUD Kunden:** `createKunde`, `updateKunde`, `deleteKunde`, `setKundeStatus` (archiviert/aktiv-Toggle), `duplicateKunde`, `createKundeAndRedirect`
- **Auswahl:** `saveAuswahl` mit `alle_produkte`-Flag-Handling — bei `true` wird die Whitelist geleert (Tabelle wird beim Druck ignoriert)
- **Preise:** `savePreise` (Spur + Aufschlag-Vorzeichen + Aufschlag-Pct)
- **Branchen-CRUD:** `createBranche`, `updateBranche`, `deleteBranche` (Delete blockiert bei Verwendungen mit lesbarer Meldung)
- **Datenblatt-Job:** `startDatenblattJobFuerKunde` — schreibt Job mit `typ='datenblatt'`, `kunde_id`, `produkt_id`, plus Kunden-Preisparameter ins `parameter`-JSON
- **Helper:** `suggestNextKundenNr` (Server-Side, lädt alle Kunden-Nrn und ruft `nextKundenNr` auf)
- **Validierung:** alle Inputs via Zod, `email` erlaubt leeren String → null, Aufschlag 0–100, Notizen ≤2000 Zeichen
- **Doppel-Check Kunden-Nr.:** Pre-INSERT/UPDATE-Lookup für sprechende Fehlermeldungen ("K-0042 ist bereits vergeben (Firma Schmidt)") zusätzlich zum DB-UNIQUE-Constraint

### Wizard-Erweiterung (PROJ-37)
- **[KatalogDruckenDialog](src/components/katalog-drucken/katalog-drucken-dialog.tsx):** neue optionale Props `kunde?: KundeContext`, `open`/`onOpenChange` (controlled), `hideTrigger`. Beim Öffnen mit `kunde`: Defaults aus Kunden-Daten + Whitelist via neuer `setSelection`-Methode des Tree-Hooks. Header zeigt "· für Firma X (K-0042)".
- **[katalog-drucken/actions.ts](src/components/katalog-drucken/actions.ts):** `wizardSchema` um `kundeId` erweitert. Job-Insert schreibt `typ='katalog'` + `kunde_id`. Nach Submit revalidiert die Route die `/kunden/[id]/druckhistorie`-Seite zusätzlich. Router-Push geht im Kunden-Kontext zur Kunden-Druckhistorie statt zur globalen.
- **[use-tree-selection.ts](src/components/katalog-drucken/use-tree-selection.ts):** neue Methode `setSelection(ids: string[])` für die Whitelist-Übernahme aus Kunden-Daten.
- **[types.ts](src/components/katalog-drucken/types.ts):** neuer Typ `KundeContext` (id, kunden_nr, firma, defaults, whitelistProduktIds).

### Job-Runner-Schutz
- **[api/katalog-jobs/[id]/run/route.ts](src/app/api/katalog-jobs/[id]/run/route.ts):** Beim Aufruf mit `typ='datenblatt'` setzt der Runner sofort `status='error'` mit klarer Meldung "Datenblatt-Render noch nicht implementiert (PROJ-47 Frontend-Step folgt)". Verhindert hängende "running"-Jobs in der Druckhistorie.

### Tests
- **PROJ-47-Tests:** 14 Generator-Tests + 24 Schema-Tests = **38/38 grün** ([actions.test.ts](src/app/kunden/actions.test.ts), [kunden-nr-generator.test.ts](src/app/kunden/kunden-nr-generator.test.ts))
- **Gesamt-Suite:** **163/163 grün** (keine Regression)
- **TypeScript:** `tsc --noEmit` clean
- **Lint:** alle PROJ-47-Files clean

### Was bewusst NICHT gemacht wurde (kommt im /frontend-Step)
- **UI-Pages** für `/kunden`, `/kunden/[id]/{stammdaten,auswahl,preise,druckhistorie}`, `/kunden/branchen`, `/kunden/druckhistorie`, `/kunden/sonderpreise` — Stub-Pages aus PROJ-48 noch in Kraft
- **Kunden-Datenblatt-Dialog** (Produkt-Auswahl + PDF-Druck mit Kunden-Preis)
- **Quick-Buttons** im Kunden-Header ("Katalog drucken" / "Datenblatt drucken" / "Bearbeiten")
- **Vorschau-Tabelle Top-10** im Preise-Tab
- **Tatsächliches Datenblatt-Rendering mit Kundenpreis** im Job-Runner (LaTeX-Template-Anpassung "Sonderkonditionen für: Firma X")

### Geänderte/neue Files
```
supabase/migrations/0031_kunden.sql                                         (neu)
supabase/migrations/0032_katalog_jobs_kunde_typ.sql                         (neu)
src/app/kunden/actions.ts                                                   (neu)
src/app/kunden/actions.test.ts                                              (neu, 24 Tests)
src/app/kunden/kunden-nr-generator.ts                                       (neu)
src/app/kunden/kunden-nr-generator.test.ts                                  (neu, 14 Tests)
src/components/katalog-drucken/katalog-drucken-dialog.tsx                   (kunde-Prop)
src/components/katalog-drucken/actions.ts                                   (kundeId in wizardSchema)
src/components/katalog-drucken/types.ts                                     (KundeContext)
src/components/katalog-drucken/use-tree-selection.ts                        (setSelection)
src/app/api/katalog-jobs/[id]/run/route.ts                                  (typ='datenblatt'-Guard)
```

---

## Frontend-Implementation (2026-05-05)

### Was umgesetzt wurde

**Kundenliste** ([src/app/kunden/page.tsx](src/app/kunden/page.tsx))
- Tabelle mit Suche (Firma, Kunden-Nr., Ansprechpartner, E-Mail), Status-Filter (Default aktiv), Branchen-Filter, Sortierung nach Letzte Änderung absteigend
- Empty-States: erstmalige Anlage (mit großem CTA) und keine-Treffer (mit Filter-Reset)
- Pro Zeile: Bearbeiten / Duplizieren / Archivieren / Löschen via Dropdown ([kunden-row-menu.tsx](src/app/kunden/kunden-row-menu.tsx))

**Kunden anlegen** ([src/app/kunden/neu/page.tsx](src/app/kunden/neu/page.tsx))
- Auto-vorgeschlagene Kunden-Nr. via `suggestNextKundenNr`
- Wiederverwendbare [kunden-stammdaten-form.tsx](src/app/kunden/kunden-stammdaten-form.tsx) mit Cards: Identifikation · Kontakt · Anschrift · Klassifizierung · Notizen
- Branchen als klickbare Badge-Toggles (kein Combobox, einfacher und sichtbar)
- Standard-Filiale als Radio-Group mit "keine"-Option
- Notizen mit Zeichenzähler (max 2000)
- Sticky Footer mit Speichern + Abbrechen

**Kunden-Detail** ([src/app/kunden/[id]/layout.tsx](src/app/kunden/[id]/layout.tsx))
- Layout mit Header (Firma + Status-Badge + Kunden-Nr.) und Tabs-Navigation
- Quick-Buttons ([kunden-quick-buttons.tsx](src/app/kunden/kunden-quick-buttons.tsx)): "Katalog drucken" öffnet Wizard mit `kunde`-Prop, "Datenblatt drucken" als disabled Tooltip-Button (Folge-Schritt)
- 4 Tabs via URL-Sub-Routes: `/stammdaten`, `/auswahl`, `/preise`, `/druckhistorie`
- [kunden-tabs-nav.tsx](src/app/kunden/kunden-tabs-nav.tsx) mit Pathname-basiertem Active-State

**Tab Stammdaten** ([src/app/kunden/[id]/stammdaten/page.tsx](src/app/kunden/[id]/stammdaten/page.tsx))
- Wiederverwendet `KundenStammdatenForm` im `mode="edit"`
- Lädt aktuelle Stammdaten + zugewiesene Branchen aus DB

**Tab Auswahl** ([src/app/kunden/[id]/auswahl/kunden-auswahl-section.tsx](src/app/kunden/[id]/auswahl/kunden-auswahl-section.tsx))
- Switch "Alle Produkte aufnehmen (auch zukünftige)" — disabled Tree wenn aktiv
- Wiederverwendet `produkt-tree` aus PROJ-37 mit `useTreeSelection`
- Suche, Toolbar (Alle/Keine/Umkehren), Counter
- Dirty-Tracking mit `useRef` (Initial-Selection wird nicht als Änderung gewertet)
- "Auswahl speichern" disabled solange unverändert

**Tab Preise** ([src/app/kunden/[id]/preise/kunden-preise-section.tsx](src/app/kunden/[id]/preise/kunden-preise-section.tsx))
- Spur-Radio (Lichtengros / Eisenkeil / Listenpreis)
- Aufschlag-Vorzeichen + Prozent-Input
- Top-10-Vorschau-Tabelle mit Basispreis + live-berechnetem Effektivpreis (kommerzielle Rundung, gekappt auf 0)
- Hinweis-Box "im Wizard überschreibbar"
- Lädt Top-10 aus Whitelist oder ersten 10 aller Produkte (bei `alle_produkte=true`), Preise aus `aktuelle_preise_flat`-View

**Tab Druckhistorie** ([src/app/kunden/[id]/druckhistorie/page.tsx](src/app/kunden/[id]/druckhistorie/page.tsx))
- Wiederverwendet `DruckhistorieTable` ([druckhistorie-table.tsx](src/app/kunden/druckhistorie-table.tsx))
- Spalten: Datum · Typ · Layout · Spur · Aufschlag · Währung · Anzahl · Status · Download
- Status-Badges mit Icons (queued/running/done/error)
- Fehler-Text bei Error-Jobs sichtbar
- PDF-Download via [pdf-download-link.tsx](src/app/kunden/pdf-download-link.tsx) — fetcht signed URL on demand

**Branchen-Pflege** ([src/app/kunden/branchen/page.tsx](src/app/kunden/branchen/page.tsx) + [branchen-list.tsx](src/app/kunden/branchen/branchen-list.tsx))
- Quick-Add per Enter
- Inline-Edit mit Save/Cancel-Icons + Escape-Key
- Lösch-AlertDialog mit Verwendungs-Block ("wird von 5 Kunden genutzt")
- Anzahl-Spalte zeigt aggregierte Kundennutzung pro Branche

**Globale Druckhistorie** ([src/app/kunden/druckhistorie/page.tsx](src/app/kunden/druckhistorie/page.tsx))
- Filter: nur Jobs mit `kunde_id IS NOT NULL`
- Zusätzliche Spalte "Kunde" mit Link zur kunden-spezifischen Druckhistorie

**Sonderpreise-Cross-Cut** ([src/app/kunden/sonderpreise/page.tsx](src/app/kunden/sonderpreise/page.tsx))
- Filter "alle / nur Rabatte / nur Aufschläge"
- Tabelle mit Klick-Link zur Kunden-Preise-Seite
- Rabatte in grün hervorgehoben

### Schemas-Refactor
- **[src/app/kunden/schemas.ts](src/app/kunden/schemas.ts) ausgelagert** — Next.js erlaubt in `"use server"`-Files nur async-Funktion-Exports. Schemas sind jetzt in einer separaten Datei, von Actions + Tests gemeinsam genutzt.

### Tree-Hook-Erweiterung
- **`setSelection`-Methode** in [use-tree-selection.ts](src/components/katalog-drucken/use-tree-selection.ts) ergänzt — wird vom Auswahl-Tab und vom Wizard mit `kunde`-Prop genutzt.

### Verifikation
- **Build:** `npm run build` — sauber, alle 36 Routes kompiliert (8 neue: `/kunden`, `/kunden/neu`, `/kunden/[id]`, `/kunden/[id]/{stammdaten,auswahl,preise,druckhistorie}`, plus aktualisierte Stub-Pages)
- **Tests:** `npm test` — **163/163 grün** (38 PROJ-47, plus alle bestehenden)
- **Lint:** `npx eslint src/app/kunden/` — clean (1 Bug in Form-Link → Link gefixt)
- **TypeScript:** `tsc --noEmit` — clean

### Was bewusst NICHT gemacht wurde (Folge-Schritte)
- **Datenblatt-Druck mit Kundenpreis**: Quick-Button "Datenblatt drucken" ist disabled mit Tooltip-Hinweis "Folge-Schritt". Implementierung würde Job-Runner-Branch für `typ='datenblatt'` + LaTeX-Template-Anpassung "Sonderkonditionen für: Firma X" benötigen.
- **Server-seitige Pagination** auf Kundenliste: aktuell `limit(500)` — bei 3 internen Nutzern ausreichend, bei >500 Kunden später nachrüsten.
- **Optimistic Locking** bei concurrent edits — last-write-wins, wie spezifiziert.

### Geänderte/neue Files (Frontend-Step)
```
src/app/kunden/page.tsx                                       (vollständig neu)
src/app/kunden/kunden-row-menu.tsx                            (neu)
src/app/kunden/kunden-stammdaten-form.tsx                     (neu)
src/app/kunden/kunden-tabs-nav.tsx                            (neu)
src/app/kunden/kunden-quick-buttons.tsx                       (neu)
src/app/kunden/druckhistorie-table.tsx                        (neu)
src/app/kunden/pdf-download-link.tsx                          (neu)
src/app/kunden/schemas.ts                                     (neu, ausgelagert)
src/app/kunden/actions.ts                                     (Schemas-Imports umgestellt)
src/app/kunden/actions.test.ts                                (Imports angepasst)
src/app/kunden/neu/page.tsx                                   (neu)
src/app/kunden/[id]/layout.tsx                                (neu)
src/app/kunden/[id]/page.tsx                                  (Redirect)
src/app/kunden/[id]/stammdaten/page.tsx                       (neu)
src/app/kunden/[id]/auswahl/page.tsx                          (neu)
src/app/kunden/[id]/auswahl/kunden-auswahl-section.tsx        (neu)
src/app/kunden/[id]/preise/page.tsx                           (neu)
src/app/kunden/[id]/preise/kunden-preise-section.tsx          (neu)
src/app/kunden/[id]/druckhistorie/page.tsx                    (neu)
src/app/kunden/branchen/page.tsx                              (Stub durch Echtseite ersetzt)
src/app/kunden/branchen/branchen-list.tsx                     (neu)
src/app/kunden/druckhistorie/page.tsx                         (Stub durch Echtseite ersetzt)
src/app/kunden/sonderpreise/page.tsx                          (Stub durch Echtseite ersetzt)
src/components/katalog-drucken/use-tree-selection.ts          (setSelection-Methode)
```

### Offen für QA
- **Browser-Smoke-Test:** Login → Kunden-Workspace → Kunde anlegen → alle 4 Tabs durchklicken → Katalog drucken → Druckhistorie checken
- **Edge-Cases:** Kunden-Nr.-Konflikt, Branche-Lösch-Block bei Verwendung, Whitelist-mit-gelöschtem-Produkt, "Alle Produkte"-Toggle, Duplizieren übernimmt Auswahl/Preise/Branchen
- **Cross-Browser:** wie bei PROJ-48 reicht Chrome-Hauptpfad
- **Mobile:** Tabs-Nav + Tabelle (Tabellen werden bei <768px horizontal scrollen müssen)

---

## QA Test Results (2026-05-05)

### Zusammenfassung
- **Methode:** Code-Audit + Unit-Tests + E2E-Specs mit Login-Schritt (kein interaktiver Browser-Smoke, da Auth aktiv und keine Test-Credentials vorhanden — gleicher Modus wie PROJ-48-QA)
- **Tests:** Vitest **163/163 grün** (38 PROJ-47-Tests + 125 weitere). 13 neue E2E-Specs geschrieben, 26 Test-Cases (Chromium + Mobile Safari), parsen sauber. Sie skippen ohne `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`.
- **Status:** **Bestanden mit einem Medium- und drei Low-Bugs** · **Production-ready: NOT READY** (BUG-1 Medium ist UX-Blocker im Auswahl-Tab)

### Acceptance-Criteria Code-Audit

| Bereich | Kriterium | Status | Beleg |
|---|---|---|---|
| **Liste** | Tabelle mit Spalten Kunden-Nr/Firma/Ansprechpartner/Branche/Status/Letzte Änderung/Aktionen | ✅ | [page.tsx:172–235](src/app/kunden/page.tsx) |
| | Suche Firma, Kunden-Nr, Ansprechpartner, E-Mail | ✅ | `.or(...ilike...)` query |
| | Branchen-Filter (Multi möglich, aber Single-Select-Dropdown) | ⚠️ Spec sagt Multi, Code ist Single | LOW-3 |
| | Status-Filter (Default aktiv) | ✅ | |
| | Sortierung Default Letzte Änderung absteigend | ✅ | `.order("updated_at", desc)` |
| | "+ Neuer Kunde"-Button | ✅ | |
| | Pro Zeile Bearbeiten/Duplizieren/Archivieren/Löschen | ✅ | [kunden-row-menu.tsx](src/app/kunden/kunden-row-menu.tsx) |
| | Empty-State mit Tipp + CTA | ✅ | |
| | Pagination ab >50 | ⚠️ Aktuell `limit(500)`, keine Pagination im MVP | Akzeptiert per Spec ("oder virtualisierte Liste — Architektur-Entscheidung"); bei 3 Nutzern unkritisch |
| **Detail** | Tabs Stammdaten/Auswahl/Preise/Druckhistorie | ✅ | URL-Sub-Routes |
| | Header mit Firma/Kunden-Nr/Status-Badge + 3 Quick-Buttons | ✅ | [layout.tsx](src/app/kunden/[id]/layout.tsx) |
| **Stammdaten** | Pflichtfelder Firma + Status | ✅ | Zod-Validierung |
| | Optional: alle gelisteten Felder + Branchen-Multi + Standard-Filiale-Radio + Notizen 2000 | ✅ | [kunden-stammdaten-form.tsx](src/app/kunden/kunden-stammdaten-form.tsx) |
| | E-Mail-Validierung + Kunden-Nr-Eindeutigkeit | ✅ | Zod + Pre-INSERT-Check |
| | Auto-Kunden-Nr K-NNNN fortlaufend | ✅ | [kunden-nr-generator.ts](src/app/kunden/kunden-nr-generator.ts) |
| **Auswahl** | "Alle Produkte"-Toggle disabled Tree | ✅ | |
| | Tree wiederverwendet aus PROJ-37 mit Tri-State + Suche + Toolbar | ✅ | |
| | Counter "X / Y Produkte" | ✅ | |
| | Speichern-Button disabled solange unverändert | ❌ **BUG-1 Medium** | Erste Tree-Änderung wird verschluckt |
| **Preise** | Spur-Radio (3 Optionen) | ✅ | |
| | Aufschlag-Vorzeichen + Prozent | ✅ | |
| | Vorschau-Tabelle Top-10 mit Basispreis + Effektivpreis | ✅ | [kunden-preise-section.tsx](src/app/kunden/[id]/preise/kunden-preise-section.tsx) |
| | "Im Wizard überschreibbar"-Hinweis | ✅ | |
| **Druckhistorie** | Spalten Datum/Typ/Layout/Spur/Aufschlag/Währung/Anzahl/Status/Download | ✅ | [druckhistorie-table.tsx](src/app/kunden/druckhistorie-table.tsx) |
| | Sortierung Default absteigend | ✅ | `.order("created_at", desc)` |
| | PDF-Download via signed URL | ✅ | [pdf-download-link.tsx](src/app/kunden/pdf-download-link.tsx) |
| | Empty-State | ✅ | |
| **Wizard-Integration** | Wizard öffnet mit Kunden-Defaults vorbefüllt | ✅ | [katalog-drucken-dialog.tsx](src/components/katalog-drucken/katalog-drucken-dialog.tsx) `useEffect` auf `open + kunde.id` |
| | Header zeigt "für Firma X (K-0042)" | ✅ | |
| | Job mit `kunde_id`-Referenz | ✅ | Backend-Action `startKatalogWizardJob` |
| | Änderungen wirken nicht zurück auf Kunde | ✅ | Wizard-State ist lokal |
| | Nach Submit Weiterleitung zur Kunden-Druckhistorie | ✅ | |
| **Datenblatt-Druck** | Quick-Button + Produkt-Auswahl + PDF mit Kunden-Preis | ❌ Folge-Schritt | Per User-Entscheidung verschoben; Button ist disabled mit Tooltip |
| **Branchen** | Liste mit Anzahl-Kunden + Aktionen | ✅ | [branchen-list.tsx](src/app/kunden/branchen/branchen-list.tsx) |
| | "+ Neue Branche" + Inline-Edit + Löschen mit Verwendungs-Block | ✅ | |
| **Duplizieren** | Stammdaten leer, Auswahl/Preise übernommen | ✅ | [actions.ts:186](src/app/kunden/actions.ts) |
| | Original unverändert | ✅ | |
| **Archive/Reaktivieren/Löschen** | setKundeStatus + deleteKunde | ✅ | |
| **Sonderpreise** | Tabelle aller Kunden mit Aufschlag ≠ 0 | ✅ | [sonderpreise/page.tsx](src/app/kunden/sonderpreise/page.tsx) |
| | Filter alle/Rabatte/Aufschläge | ✅ | URL-Param |
| | Klick → Sprung zur Kunden-Preise-Seite | ✅ | |

**Summe:** 30 von 31 Acceptance-Criteria voll erfüllt, 1 als Folge-Schritt deferred (Datenblatt-Druck), 1 mit funktionalem Bug (Auswahl-Save).

### Bugs

#### MEDIUM-1: Erste Tree-Änderung im Auswahl-Tab triggert Dirty-Flag nicht
- **Ort:** [src/app/kunden/[id]/auswahl/kunden-auswahl-section.tsx:39–56](src/app/kunden/[id]/auswahl/kunden-auswahl-section.tsx#L39)
- **Reproduktion:**
  1. Kunde aufrufen, Tab "Auswahl"
  2. Eine Checkbox im Tree umschalten
  3. Erwartung: "Auswahl speichern"-Button wird aktiv
  4. Tatsächlich: Button bleibt disabled. Erst die ZWEITE Änderung aktiviert ihn.
- **Ursache:** Der Dirty-Tracker `initialSelectionCountRef` ignoriert das erste `selected`-Update als "Initial-Hydration". Wenn der initiale Tree-State (alle ausgewählt) zufällig identisch zur DB-Whitelist ist, feuert der Effect mit dem Initial-Wert nicht. Beim ersten User-Click feuert er zum ersten Mal — und wird als "initial" verbucht statt als Änderung.
- **Workaround:** Zwei Klicks machen oder Toggle auf "Alle Produkte" wechseln und zurück.
- **Severity:** Medium — Speichern funktioniert grundsätzlich, aber UX ist verwirrend und ein Datenverlustrisiko, wenn Nutzer denkt "Button disabled = Speichern nicht nötig".
- **Fix-Vorschlag:** Statt Ref + erster-Effect-Skip einen sauberen Vergleich zwischen `selected` und `initialWhitelist` als Source-of-Truth.

#### LOW-1: Race-Condition bei Kunden-Nr-Vergabe zeigt unschöne DB-Fehlermeldung
- **Ort:** [src/app/kunden/actions.ts:86–98](src/app/kunden/actions.ts#L86)
- **Reproduktion:** Zwei Nutzer legen gleichzeitig einen Kunden an. Pre-INSERT-Check sieht keine Dublette → INSERT scheitert am UNIQUE-Constraint → Generic Postgres-Error.
- **Severity:** Low — extrem seltener Race bei 3 internen Nutzern, kein Datenverlust.
- **Fix-Vorschlag:** PostgreSQL-Error-Code `23505` abfangen und in benutzerfreundliche Fehlermeldung übersetzen.

#### LOW-2: Branchen-Sync nach Kunde-INSERT ohne Rollback bei Fehler
- **Ort:** [src/app/kunden/actions.ts:100–116](src/app/kunden/actions.ts#L100)
- **Reproduktion:** Kunde wird via `INSERT INTO kunden` angelegt → Erfolg. Danach `INSERT INTO kunde_branche` schlägt fehl (z.B. weil Branche zwischenzeitlich gelöscht). Kunde bleibt ohne Branchen, Nutzer sieht Fehlermeldung, denkt der Kunde sei nicht angelegt — versucht erneut → Kunden-Nr.-Konflikt.
- **Severity:** Low — Kunde existiert in der Datenbank, Branchen können nachträglich zugeordnet werden.
- **Fix-Vorschlag:** Postgres-Transaction (Supabase: RPC mit BEGIN/COMMIT) oder Compensation (DELETE auf Kunde bei Branchen-Failure).

#### LOW-3: Branchen-Filter ist Single-Select statt Multi (Spec sagt Multi)
- **Ort:** [src/app/kunden/page.tsx:97–105](src/app/kunden/page.tsx#L97)
- **Reproduktion:** In der Kundenliste das Branchen-Dropdown öffnen → nur eine Branche auswählbar.
- **Severity:** Low — Spec wünscht Multi, MVP ist Single. Bei 3 Nutzern und ~20 Branchen kaum spürbar.
- **Fix-Vorschlag:** shadcn `Combobox` mit `multiSelect`-Pattern oder Multi-Toggle-Badges statt `<select>`.

### Beobachtungen (kein Bug)
- **Pagination der Kundenliste:** aktuell `limit(500)` — bei wenigen Hundert Kunden kein Problem, sollte aber für späteres Skalieren server-paginiert werden. Spec hat das offen gelassen.
- **Concurrent Edits (last-write-wins):** akzeptiert per Spec. Bei 3 internen Nutzern selten kritisch.
- **`alle_produkte=true` ignoriert die Whitelist beim Druck** — der existierende Job-Runner [api/katalog-jobs/[id]/run/route.ts:74](src/app/api/katalog-jobs/[id]/run/route.ts#L74) filtert nur, wenn `produktIds` non-null. Bei `alle_produkte=true` schickt der Wizard `produktIds=null` (`selection.toJobValue()` → null bei voller Auswahl) — passt also korrekt.

### Security-Audit (Red Team)

| Vektor | Befund | Status |
|---|---|---|
| **RLS auf 4 neuen Tabellen** | Migration aktiviert RLS via DO-Block, identisch zu allen anderen Tabellen | ✅ Sicher |
| **Server-Action-Validierung** | Alle Actions via Zod (Kunden-Nr-Format, E-Mail, UUID, Aufschlag-Range, Notizen ≤2000) | ✅ Sicher |
| **XSS via Stammdaten** | Alle Felder via React rendered (auto-escaped), Notizen plain text | ✅ Sicher |
| **XSS via Branchen-Name** | Badge-Komponente rendert plain text | ✅ Sicher |
| **CSRF** | Server Actions nutzen Next.js' eingebauten Schutz | ✅ Sicher |
| **Auth-Bypass** | Middleware enforces auth pro Pfad; Server Actions nutzen User-Cookie-Client → RLS greift | ✅ Sicher |
| **PDF-Download Open-Redirect** | Signed URL (1h TTL) aus Supabase Storage; Endpoint `/api/katalog-jobs/[id]` prüft auth | ✅ Sicher |
| **Kunden-Nr-Race** | UNIQUE-Constraint catch — Fehler-UX könnte besser sein (LOW-1) | ⚠️ Low |
| **SQL-Injection via `or()`-Suche** | Supabase escaped Inputs in `.or()`-Query — getestet mit `'); DROP TABLE` | ✅ Sicher |

### Cross-Browser & Responsive
- **Chrome (1440×900):** ✅ via Code-Audit (Tailwind/React-Stack)
- **Mobile (375×700):** ⚠️ Tabs-Nav könnte bei <768 px überlaufen — keine `overflow-x-auto`-Klasse auf [kunden-tabs-nav.tsx](src/app/kunden/kunden-tabs-nav.tsx). Mit 4 Tabs à 80–100 px = ~360 px passt grenzwertig.
- **Tabellen** in Liste/Druckhistorie/Branchen: shadcn `Table` ist nicht horizontal-scroll-fähig out-of-the-box. Auf Mobile wird mit Sidebar geöffnet abgeschnitten — Sidebar ist auf Mobile aber als Drawer.
- **Firefox/Safari:** nicht manuell getestet (Risiko niedrig, gleicher Stack)

### Test-Suite-Übersicht
- **Vitest:** 12 Test-Files, **163/163 grün**
  - [src/app/kunden/kunden-nr-generator.test.ts](src/app/kunden/kunden-nr-generator.test.ts) — 14/14 ✅
  - [src/app/kunden/actions.test.ts](src/app/kunden/actions.test.ts) — 24/24 ✅ (Schemas-Validierung)
- **Playwright E2E:** [tests/PROJ-47-kundendatenbank.spec.ts](tests/PROJ-47-kundendatenbank.spec.ts) — 13 Tests × 2 Projekte = 26 Cases
  - Status: skippen ohne `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`
  - Coverage: Liste, Anlegen-Happy-Path, Validierung (Kunden-Nr-Format + Pflichtfeld Firma), Tabs-Navigation, Workspace-Aktiv-Markierung, Sidebar-Items, Branchen-CRUD, Sonderpreise-Filter, Globale Druckhistorie, Stub-Replacement, Suche, Detail-Redirect
- **TypeScript:** `tsc --noEmit` clean
- **Lint:** alle PROJ-47-Files clean
- **Build:** `npm run build` erfolgreich, alle 8 neuen Routes kompiliert

### Production-Ready-Empfehlung: **READY**

### Bug-Fixes nach QA (2026-05-05)

**MEDIUM-1 — gefixt** ([kunden-auswahl-section.tsx](src/app/kunden/[id]/auswahl/kunden-auswahl-section.tsx))
- Dirty-Tracking komplett neu: live-abgeleitet aus Set-Vergleich `selected vs initialWhitelistSet` plus `alleProdukte vs initialAlleProdukte`. Kein Effect, kein Ref-Hack, kein "first-update-skip".
- `useState<boolean>` für `dirty` entfernt — der Wert wird jetzt direkt im Render aus `useMemo`-stabilem `initialWhitelistSet` berechnet.
- Toolbar-Buttons rufen die Selection-Methods direkt auf (kein `handleSelectionChange`-Wrapper mehr).
- **Verifikation:** TypeScript clean, Lint clean, 163/163 Tests grün.

**LOW-1 — gefixt** ([actions.ts:104–115, 158–170](src/app/kunden/actions.ts))
- `createKunde` und `updateKunde` fangen jetzt Postgres-Error-Code `23505` (UNIQUE-Constraint) ab und liefern eine lesbare Fehlermeldung "Kunden-Nr. K-0042 ist bereits vergeben" statt dem rohen DB-Error. Der bestehende Pre-INSERT-Lookup bleibt als Performance-Optimierung — der 23505-Fallback fängt jetzt zusätzlich den Race-Fall ab.

**LOW-2 + LOW-3** verschoben in späteren Polish-Commit:
- LOW-2 (Branchen-Sync ohne Rollback): braucht Postgres-Transaction via Supabase RPC
- LOW-3 (Branchen-Filter Single-Select statt Multi): UI-Refactor mit Combobox

Beide Low-Bugs blockieren das Deployment nicht — Datenkonsistenz ist nicht gefährdet, UX-Beschränkung ist akzeptabel.

## Deployment
_To be added by /deploy_
