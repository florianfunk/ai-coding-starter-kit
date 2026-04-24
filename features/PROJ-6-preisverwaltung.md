# PROJ-6: Preisverwaltung pro Produkt

## Status: In Progress
**Created:** 2026-04-16
**Last Updated:** 2026-04-24

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-2 (Datenmodell) — Schema-Änderung: `preise`-Tabelle muss um `spur` + `quelle` erweitert werden, Spalten `ek`/`listenpreis` als Einzel-Zeile pro Spur aufgeteilt
- Requires: PROJ-5 (Produkte)
- Liefert an: PROJ-10 (PDF-Gesamtkatalog) — wählt im Export-Dialog eine der drei Preisspuren aus
- Liefert an: PROJ-9 (PDF-Datenblatt) — nutzt standardmäßig die Listenpreis-Spur
- Verwandt: PROJ-17 (Excel/CSV-Import für Preise) — pflegt die drei Spuren befüllt über Import

## Kontext / Neukonzeption
Diese Spec ersetzt das bisherige Modell (eine Zeile mit drei Preisspalten und einem globalen Status). Grund: Jedes Produkt hat **drei unabhängige Preise** (Lichtengros, Eisenkeil, Listenpreis), die separat über Excel-Importe gepflegt werden. Eine kombinierte Zeile verhindert saubere Historie und saubere Imports.

**Neues Modell:** Jede Preisänderung einer Spur = eine eigene Zeile in der `preise`-Tabelle. Spalten: `produkt_id | spur | gueltig_ab | preis | quelle | created_at`. Eine "aktuell"-Markierung berechnet sich pro Spur aus dem jüngsten Eintrag mit `gueltig_ab ≤ heute`.

## User Stories
- Als Nutzer möchte ich pro Produkt drei getrennte Preis-Spuren pflegen (Lichtengros, Eisenkeil, Listenpreis), damit ich je nach Kundenkanal den richtigen Preis im Katalog ausweisen kann.
- Als Nutzer möchte ich pro Spur die komplette Preishistorie sehen, damit ich Preisentwicklungen nachvollziehen kann.
- Als Nutzer möchte ich, dass immer automatisch der jüngste Eintrag einer Spur (mit `gültig ab ≤ heute`) als aktueller Preis dieser Spur gilt, damit ich nicht manuell alte Preise auf "inaktiv" setzen muss.
- Als Nutzer möchte ich zukünftige Preisänderungen mit `gültig ab` in der Zukunft hinterlegen können (Status "geplant"), damit angekündigte Preiserhöhungen schon im System stehen, aber erst zum Stichtag wirksam werden.
- Als Nutzer möchte ich manuell einen neuen Preis in einer einzelnen Spur hinzufügen, damit ich Einzelkorrekturen ohne Excel-Import machen kann.
- Als Nutzer möchte ich einen Preis-Eintrag bearbeiten oder löschen, damit ich Fehleinträge korrigieren kann.
- Als Nutzer möchte ich beim Katalog-Druck (PROJ-10) auswählen, welche der drei Spuren im Katalog abgebildet wird.

## Acceptance Criteria

### Darstellung (Produkt-Detailseite, Tab "Preise")
- [ ] Oben drei Kacheln nebeneinander: **Lichtengros | Eisenkeil | Listenpreis** — jede zeigt den aktuellen Preis (oder "— noch kein Preis") und das zugehörige `gültig ab`-Datum.
- [ ] Darunter **eine Tabelle, nach Spur gruppiert** (Reihenfolge: Lichtengros → Eisenkeil → Listenpreis). Jede Gruppe hat einen Header mit Spurnamen und aktuellem Preis.
- [ ] Spalten pro Zeile: `Gültig ab | Preis | Status | Quelle | Aktionen`
- [ ] Innerhalb jeder Gruppe absteigend nach `gültig_ab` sortiert (neueste zuerst).
- [ ] Status-Badge pro Zeile:
  - **aktuell** — jüngster Eintrag der Spur mit `gültig_ab ≤ heute`
  - **geplant** — `gültig_ab > heute`
  - **historie** — alle älteren Einträge
- [ ] Spalte "Quelle" zeigt Herkunft (z.B. Import-Dateiname + Datum oder "manuell").
- [ ] Leere Spur: Gruppe wird trotzdem angezeigt, mit Hinweis "noch kein Preis hinterlegt" und "+ Preis anlegen"-Button.

### Manuelle Pflege
- [ ] Button "+ Neuer Preis" öffnet Dialog mit Feldern: `Spur` (Pflicht, Select: LG / EK / Listenpreis), `Gültig ab` (Pflicht, Default: heute), `Preis` (Pflicht, EUR, 2 Nachkommastellen). `Quelle` wird automatisch auf "manuell" gesetzt.
- [ ] Zeilen können bearbeitet werden (Edit-Icon pro Zeile): alle Felder außer `Spur` änderbar. Import-Einträge dürfen bearbeitet werden, bekommen aber eine Quelle-Ergänzung "manuell geändert".
- [ ] Zeilen können gelöscht werden (Papierkorb-Icon + Bestätigungsdialog), unabhängig von der Quelle. Beim Löschen der aktuellen Zeile rutscht der nächstältere Eintrag in "aktuell" nach.

### Validierung
- [ ] Preis ≥ 0 (negative Preise nicht erlaubt → Fehlermeldung).
- [ ] Preis = 0 erlaubt (z.B. für "auf Anfrage"-Produkte), zeigt aber Warnhinweis.
- [ ] `Gültig ab` darf in der Zukunft liegen (Status "geplant").
- [ ] Zwei Einträge mit gleichem `gültig_ab` in derselben Spur sind erlaubt; der spätere `created_at` gewinnt als "aktuell".
- [ ] Duplikate (gleicher Preis, gleiche Spur, aufeinanderfolgend) werden als eigene History-Zeile angelegt — keine Deduplizierung.

### Logik "aktueller Preis"
- [ ] Pro Spur genau ein "aktueller Preis": jüngster Eintrag mit `gültig_ab ≤ heute`. Tie-Breaker: höchstes `created_at`.
- [ ] Keine Spur befüllt → Spur hat keinen aktuellen Preis; wird in Kacheln als "—" dargestellt.
- [ ] Nur Zukunftspreise vorhanden → kein aktueller Preis (zeigt "—", ältester Zukunftspreis als "geplant" sichtbar).
- [ ] Berechnung live aus DB, kein redundantes Flag.

### Integration mit anderen Features
- [ ] PROJ-9 (Einzel-Datenblatt): nutzt Listenpreis-Spur als Default.
- [ ] PROJ-10 (Gesamtkatalog): Export-Dialog hat Auswahl `Preisspur: [Lichtengros | Eisenkeil | Listenpreis]`. Wenn für ein Produkt die gewählte Spur leer ist, wird "auf Anfrage" gedruckt.
- [ ] PROJ-17 (Excel-Import): schreibt beim Import in genau eine Spur, erzeugt pro Produkt eine neue Zeile mit `quelle = <Dateiname>` und `gueltig_ab = <aus Excel oder heute>`.

## Edge Cases
- **Mehrere Einträge mit gleichem `gültig_ab` in derselben Spur** → Erlaubt, letzter `created_at` gewinnt als "aktuell".
- **Zukunftspreis importiert, bevor heutiger Preis existiert** → Heutige Kachel zeigt "—", zukünftige Zeile ist sichtbar als "geplant".
- **Aktueller Preis wird gelöscht** → Nächstälterer Eintrag der Spur mit `gültig_ab ≤ heute` wird neuer "aktuell"; falls keiner existiert → Kachel "—".
- **Produkt ohne jeglichen Preis** → Alle drei Kacheln zeigen "—", im Katalog-Export erscheint "auf Anfrage".
- **Derselbe Preis mehrfach hintereinander importiert** → Jeder Import = neue History-Zeile (Bestätigung, dass Preis am Importdatum noch gültig war).
- **Import überschreibt fälschlich mit falscher Spur** → Nutzer löscht Zeile manuell; alter Preis wird wieder "aktuell".
- **`Gültig ab` wird bearbeitet, sodass ein anderer Eintrag "aktuell" wird** → Neuberechnung erfolgt automatisch, Kachel aktualisiert sich.
- **Preis-Spur hat nur "geplante" Einträge (alle Zukunft)** → Kachel "— (ab TT.MM.JJJJ: X,XX €)".

## Technical Requirements
- **Tabelle `preise`** (ersetzt altes Schema aus PROJ-2):
  - `id uuid PK`
  - `produkt_id uuid FK → produkte(id) ON DELETE CASCADE`
  - `spur enum('lichtengros', 'eisenkeil', 'listenpreis')` — NOT NULL
  - `gueltig_ab date` — NOT NULL
  - `preis numeric(10,2)` — NOT NULL, CHECK ≥ 0
  - `quelle text` — NOT NULL, default `'manuell'`, sonst z.B. `'import:preise_lichtengros_2026q2.xlsx'`
  - `created_at timestamptz` — default now()
  - `created_by uuid` — optional FK auf user
  - Index: `(produkt_id, spur, gueltig_ab DESC)`
- **SQL-View `aktuelle_preise`**: liefert pro `(produkt_id, spur)` genau die "aktuelle" Zeile (jüngste `gueltig_ab ≤ current_date`, Tie-Breaker `created_at DESC`). View wird von PROJ-9/10 und der Kacheldarstellung genutzt.
- **Migration aus altem Schema**: Bestehende `preise`-Zeilen werden in bis zu drei neue Zeilen aufgespalten (eine pro befüllter Spalte `ek_lichtengros`/`ek_eisenkeil`/`listenpreis`). Quelle = `'migration:old-schema'`.
- **Performance**: Preise-Tab lädt ≤ 300 ms bei bis zu 100 History-Einträgen pro Produkt.
- **UI**: shadcn/ui `Table`, `Dialog`, `Badge`, `Card` (für Kacheln), `DatePicker`, `Input` (currency via `react-number-format`).
- **Rechte**: alle authentifizierten Nutzer dürfen lesen/schreiben/löschen (einheitliches Rechte-Modell laut PRD).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Der bisherige Preise-Bereich speichert pro Zeile alle drei Preise nebeneinander (Spalten `ek`, `ek_eisenkeil`, `listenpreis`) plus einen globalen `status`. Das passt nicht zu Excel-Importen, die nur eine Spur befüllen, und verfälscht die Historie. Das neue Design macht **jede Preisänderung einer Spur zu einer eigenen Zeile**. "Aktuell" wird nicht mehr gespeichert, sondern aus dem Gültig-ab-Datum berechnet.

### Component Structure (UI)

```
Tab "Preise" auf der Produkt-Detailseite
+-- Drei Kacheln oben, nebeneinander
|   +-- Kachel "Lichtengros"  → aktueller Preis + gültig-ab-Datum
|   +-- Kachel "Eisenkeil"    → aktueller Preis + gültig-ab-Datum
|   +-- Kachel "Listenpreis"  → aktueller Preis + gültig-ab-Datum
|       (bei leerer Spur: "— noch kein Preis" + "+ Preis anlegen"-Button)
+-- Button "+ Neuer Preis"  → öffnet Dialog (Spur-Auswahl + Datum + Preis)
+-- Historie-Tabelle, nach Spur gruppiert
    +-- Gruppe "Lichtengros"
    |   +-- Zeile: Gültig ab · Preis · Status-Badge · Quelle · Aktionen
    |   +-- (weitere Historien-Zeilen, absteigend nach Datum)
    +-- Gruppe "Eisenkeil"
    |   +-- (Zeilen)
    +-- Gruppe "Listenpreis"
        +-- (Zeilen)

Status-Badges pro Zeile:
  · "aktuell"  → jüngster Eintrag der Spur mit gültig_ab ≤ heute
  · "geplant"  → gültig_ab liegt in der Zukunft
  · "historie" → alle älteren Einträge
```

### Data Model (plain language)

**Was gespeichert wird — pro Preis-Eintrag:**
- Eindeutige ID
- Zugehöriges Produkt
- **Spur** — eine von drei: Lichtengros, Eisenkeil, Listenpreis
- **Gültig ab** — Datum, ab dem der Preis gilt (darf auch in der Zukunft liegen)
- **Preis** — Euro-Betrag, zwei Nachkommastellen, nicht negativ
- **Quelle** — Herkunft des Eintrags: entweder "manuell" oder der Dateiname des Excel-Imports (z. B. `import:preise_lichtengros_2026q2.xlsx`)
- Erstellungs-Zeitstempel und Erzeuger (für Audit und als Tie-Breaker)

**Wie "aktueller Preis" ermittelt wird:**
Der aktuelle Preis einer Spur ist kein Feld, sondern eine Berechnung: aus allen Einträgen der Spur wird der jüngste gewählt, dessen Gültig-ab-Datum nicht in der Zukunft liegt. Dafür gibt es eine Datenbank-Sicht (`aktuelle_preise`), die pro Produkt und Spur genau diese eine Zeile liefert. Weder Frontend noch PDF-Export müssen die Regel selbst kennen.

**Was wegfällt:**
- Das Feld "Status" (aktiv/inaktiv) — ersetzt durch die berechneten Badges
- Das automatische "alte Preise auf inaktiv setzen" — nicht mehr nötig, weil nur das Datum zählt
- Die Checkbox "alte deaktivieren" im Dialog

**Gespeichert in:** PostgreSQL (Supabase) — wie bisher. Nur die Tabellen-Struktur wird umgebaut.

### Migration vom alten Modell

Einmalige Migration als neue SQL-Migration (Datei `0019_preise_drei_spuren.sql`):

1. **Neue Spalten einführen:** `spur` (enum: Lichtengros/Eisenkeil/Listenpreis) und `quelle` (Text).
2. **Bestehende Zeilen aufsplitten:** Jede existierende Zeile wird zu bis zu drei neuen Zeilen — je eine pro befüllter Preis-Spalte:
   - Wenn `listenpreis` gesetzt → neue Zeile mit Spur "Listenpreis"
   - Wenn `ek` gesetzt → neue Zeile mit Spur "Lichtengros"
   - Wenn `ek_eisenkeil` gesetzt → neue Zeile mit Spur "Eisenkeil"
   Alle drei erben dasselbe `gültig_ab` und bekommen `quelle = "migration:alt-schema"`.
3. **Status verwerfen:** Der alte `status`-Wert (aktiv/inaktiv) wird nicht übernommen. Inaktive Zeilen werden normal Teil der Historie — der jüngste Eintrag pro Spur mit Datum ≤ heute gilt automatisch als aktuell.
4. **Alte Spalten entfernen:** `ek`, `ek_eisenkeil`, `listenpreis`, `status` werden aus der Tabelle gelöscht. Dafür bleibt `preis` als einzige Preisspalte.
5. **View neu aufbauen:** Die View `aktuelle_preise` wird ersetzt, sodass sie pro Produkt und Spur genau eine Zeile zurückgibt (bisher: nur eine Zeile pro Produkt).
6. **Rollback-Plan:** Ein Export der alten `preise`-Tabelle wird vor der Migration als Backup-Dump erstellt.

### Tech-Entscheidungen (Begründung für PM)

- **Eine Zeile pro Preisänderung einer Spur**, nicht eine Zeile mit drei Spalten. Grund: Excel-Imports bedienen nur eine Spur; gemischte Zeilen erzeugen widersprüchliche Zustände und unleserliche Historie.
- **"Aktuell" wird berechnet, nicht gespeichert.** Grund: Wenn ein Status mitgepflegt werden müsste, entstehen Inkonsistenzen — das sieht man im aktuellen UI-Screenshot, wo zwei Einträge gleichzeitig "aktiv" sind. Ein berechnetes Feld kann nicht veralten.
- **Zukunftspreise erlaubt** (Status "geplant"). Grund: Excel-Listen für Preiserhöhungen kommen oft Wochen vorher — das System kennt sie dann schon, aktiviert sie aber erst zum Stichtag.
- **Keine Deduplizierung bei gleichem Preis.** Grund: Jeder Import ist eine Bestätigung, dass der Preis zu diesem Zeitpunkt noch gilt. Diese Info wäre verloren, wenn wir gleiche Preise zusammenfassen.
- **Gruppierte Tabelle statt drei separater Tabs.** Grund: Alle drei Spuren auf einen Blick, weniger Klicks, weniger Kontextwechsel bei der Pflege.
- **Quelle als Freitext-Feld**, nicht als starre Relation auf eine Import-Tabelle. Grund: Import-Historie ist für PROJ-17 relevant, hier reicht ein lesbarer Hinweis ("manuell" / Dateiname).
- **Katalog-Auswahl gehört zu PROJ-10**, nicht hierher. Hier wird nur sichergestellt, dass die Daten für alle drei Spuren abrufbar sind.

### Auswirkungen auf andere Features

- **PROJ-9 (Einzel-Datenblatt):** liest aus der View den "aktuellen Listenpreis" — praktisch unverändert, nur Query leicht anders.
- **PROJ-10 (Gesamtkatalog):** Export-Dialog bekommt Auswahl "Preisspur". Die View liefert pro Spur den richtigen Wert; fehlende Spur → "auf Anfrage".
- **PROJ-17 (Excel-Import):** Import schreibt pro Zeile einen neuen Eintrag in die gewählte Spur, mit Quelle = Dateiname. Kein "alte deaktivieren" mehr nötig.
- **Dashboard / Suche:** Komponenten, die bisher die alte `aktuelle_preise`-View nutzen, müssen auf die neue View angepasst werden (die jetzt mehrere Zeilen pro Produkt liefert). Betroffen: ggf. die Materialized View aus `0013_perf_views.sql`.

### Abhängigkeiten (zu installierende Pakete)
Keine neuen Pakete. Alles ist bereits im Projekt:
- `react-number-format` — Währungs-Eingabe (bereits vorgesehen in alter Spec)
- `@radix-ui/react-dialog`, `@radix-ui/react-select` — via shadcn/ui bereits vorhanden
- `zod` — Input-Validierung (bereits in Nutzung)

### Sicherheit & Rechte
- **RLS-Policies** auf der `preise`-Tabelle bleiben bestehen: alle authentifizierten Nutzer dürfen lesen/schreiben/löschen (laut PRD einheitliches Rechte-Modell).
- **Input-Validierung** mit Zod-Schema: Spur-Enum, Datum-Format, Preis ≥ 0.
- **Audit-Trail:** `created_at` + `created_by` bleiben unverändert erhalten und werden für jede Zeile gesetzt.

### Performance
- Index auf `(produkt_id, spur, gültig_ab DESC)` sorgt dafür, dass die Abfrage "aktueller Preis pro Spur" in konstant wenigen Millisekunden läuft.
- View `aktuelle_preise` nutzt `DISTINCT ON (produkt_id, spur)` — auf Produkt-Listen mit 400+ Einträgen weiterhin < 50 ms.

## Implementation Notes (Backend, 2026-04-24)

### Was wurde umgesetzt
- **DB-Migration** `supabase/migrations/0020_preise_drei_spuren.sql`:
  - Enum `preis_spur ('lichtengros','eisenkeil','listenpreis')` angelegt
  - Neue Spalten `spur`, `quelle`, `preis` auf `preise`
  - Alte Spalten `listenpreis`, `ek`, `ek_lichtengros`, `ek_eisenkeil`, `status` gedroppt
  - Enum `preis_status` gedroppt (war nur noch in `preise.status` referenziert)
  - Index `preise_produkt_spur_gueltig` auf `(produkt_id, spur, gueltig_ab DESC)`
  - CHECK constraint `preis >= 0`
  - View `aktuelle_preise` neu: eine Zeile pro `(produkt_id, spur)` via `DISTINCT ON`
  - View `aktuelle_preise_flat` zusätzlich: eine Zeile pro Produkt mit `listenpreis`, `ek_lichtengros`, `ek_eisenkeil`, `ek`-Alias (Pivot via `FILTER`) — Rückwärts-Kompat für Export/Vergleich/Kategorie/Katalog-PDF
  - Views `v_produkt_listing`, `v_dashboard_stats`, `mv_produkt_completeness` neu aufgebaut mit Source `aktuelle_preise_flat`
  - GRANT SELECT auf neue Views für `authenticated` und `service_role`
- **Datenwiederherstellung:** Die erste Backfill-Regel in der Migration war fehlerhaft (`listenpreis IS NOT NULL` griff auch bei `listenpreis = 0.00`) und hat die 304 EK-Lichtengros-Werte fälschlich als "listenpreis mit Preis 0" klassifiziert. Behebung via `scripts/restore-preise-from-fm.ts` — liest die Original-FM-Zeilen über die Data API, mapped pro Zeile die korrekte Spur, überschreibt via `ON CONFLICT (external_id)`. Endstand: 415 Listenpreis, 361 Lichtengros, 361 Eisenkeil.
- **Server Actions** `src/app/produkte/preise-actions.ts` komplett neu: `addPreis`, `updatePreis`, `deletePreis` mit Zod-Validierung (`spur`, `gueltig_ab`, `preis ≥ 0`). Quelle = "manuell" bei Neuanlage, bei Update von Import-Zeilen wird "(manuell geändert)" angehängt.
- **UI** `src/app/produkte/[id]/preise-section.tsx` neu: drei Kacheln oben (aktueller Preis pro Spur), darunter eine nach Spur gruppierte Historie-Tabelle. Status-Badges `aktuell`/`geplant`/`historie` clientseitig aus Datum abgeleitet. shadcn/ui `Dialog` für Neuanlage, `AlertDialog` für Löschbestätigung, `Select` für Spur-Auswahl, `Badge` für Status.
- **Produkt-Detailseite** `page.tsx`: Preise-Query sortiert jetzt nach `spur, gueltig_ab DESC, created_at DESC`. `hasActivePrice` aus `status='aktiv'` ersetzt durch `gueltig_ab ≤ heute`.
- **Import-Actions** `src/app/produkte/actions.ts`: `matchArtikelnummern` liest aus `aktuelle_preise_flat` (keine `status`-Filterung mehr). `importPreise` erzeugt pro Excel-Zeile bis zu 3 Insert-Einträge (eine pro gesetztem Preis), Quelle `import:preis-wizard`. `deactivateOld`-Flag wird ignoriert mit TODO-Kommentar auf PROJ-17.
- **View-Consumer** umgestellt: `vergleich/page.tsx`, `kategorien/[id]/page.tsx`, `export-actions.ts`, `api/katalog-jobs/[id]/run/route.ts` — alle nutzen jetzt `aktuelle_preise_flat`.

### Verifikation
- `npx tsc --noEmit` — grün
- `npm run build` — grün (alle 36 Routes kompiliert)
- Runtime-Queries gegen `preise`, `aktuelle_preise`, `aktuelle_preise_flat`, `v_dashboard_stats`, `v_produkt_listing` — alle liefern korrekte Daten (1137 Zeilen gesamt, 415/361/361 pro Spur)

### Offene Punkte
- **Migration nicht im Supabase-Ledger**: `supabase_migrations.schema_migrations` hat keinen Eintrag für 0020, weil sie direkt via `execute_sql` eingespielt wurde. Vor dem Deploy auf ein frisches Env muss der Ledger-Eintrag nachgezogen werden, oder die Migration über die Supabase-CLI importiert.
- **PROJ-17 Excel-Import** muss noch komplett auf Drei-Spuren umgestellt werden (Wizard wählt aktuell noch drei Spalten gleichzeitig). Siehe TODO im Code.
- **PROJ-10 Katalog-Export** braucht noch die Preisspur-Auswahl im Dialog (aktuell hartkodiert auf `listenpreis`/`ek`).
- **Feinschliff UI**: Edit-Funktion pro Zeile, Dark-Header-Styling für die Preise-Section, responsive Optimierung der drei Kacheln auf Mobile — gehört in eine `/frontend`-Runde.
- **Fix für Migrationsscript**: In `0020_preise_drei_spuren.sql` müsste die Backfill-Regel korrigiert werden (`COALESCE(ek_lichtengros, ek) > 0` hat Priorität über `listenpreis IS NOT NULL`), damit Re-Runs auf anderen Environments nicht wieder denselben Fehler produzieren.

### Geänderte Files
```
supabase/migrations/0020_preise_drei_spuren.sql      (neu)
scripts/restore-preise-from-fm.ts                    (neu, Recovery-Script)
src/app/produkte/preise-actions.ts                   (komplett neu)
src/app/produkte/[id]/preise-section.tsx             (komplett neu)
src/app/produkte/[id]/page.tsx                       (Preise-Query, hasActivePrice)
src/app/produkte/actions.ts                          (matchArtikelnummern, importPreise)
src/app/produkte/vergleich/page.tsx                  (aktuelle_preise → aktuelle_preise_flat)
src/app/kategorien/[id]/page.tsx                     (dito)
src/app/produkte/export-actions.ts                   (dito)
src/app/api/katalog-jobs/[id]/run/route.ts           (dito)
```

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
