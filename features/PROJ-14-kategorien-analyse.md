# PROJ-14: Kategorien-Analyse & Inline-Bearbeitung

## Status: Approved
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-2 (EÜR-Kontenrahmen) — Zielsystematik
- Requires: PROJ-4 (Kontoauszug-Import) — Buchungen
- Requires: PROJ-5 (Autonome Klassifizierung) — die zu prüfenden Klassifikationen

## Beschreibung
Audit-Sicht **von der Kategorie aus** (komplementär zur Prüfliste, die von
der Buchung aus geht). Der Inhaber sieht auf einen Blick, wie viele
Buchungen je EÜR-Kategorie liegen, welche Summen sich daraus ergeben und
mit welcher Konfidenz die KI zugeordnet hat. Aus der Kategorie heraus kann
er gezielt einzelne Buchungen umkategorisieren oder als „manuell bestätigt"
markieren — Inline, ohne Sheet-Öffnen.

## User Stories
- Als Inhaber möchte ich eine Übersicht aller EÜR-Kategorien mit Anzahl Buchungen, Gesamtsumme und durchschnittlicher Konfidenz sehen, damit ich erkenne, wo der Agent fleißig war und wo ich prüfen muss.
- Als Inhaber möchte ich eine Kategorie aufklappen und die enthaltenen Buchungen sehen, damit ich die Zuordnung schnell überprüfen kann.
- Als Inhaber möchte ich in der Liste eine Buchung direkt umkategorisieren (Dropdown-Inline), damit ich Korrekturen ohne Klicks mache.
- Als Inhaber möchte ich eine Buchung als „manuell bestätigt" markieren, damit sie nicht erneut von der Re-Klassifizierung überschrieben wird.
- Als Inhaber möchte ich nach Wirtschaftsjahr und Konto filtern, damit ich gezielt einzelne Perioden auswerten kann.

## Acceptance Criteria
- [ ] Neuer Menüpunkt „Kategorien-Analyse" in der Sidebar-Sektion „Arbeit"
- [ ] Seite `/kategorien-analyse` (auth-geschützt) listet alle Kategorien mit Daten in einer Tabelle
- [ ] Pro Kategorie: Bezeichnung, Typ, USt-Satz, Anzahl Buchungen, Summe (€), Ø-Konfidenz, Status-Mix-Übersicht (auto/Prüfung/manuell)
- [ ] Filter: Wirtschaftsjahr / „Alle Jahre", Konto / „Alle Konten"
- [ ] „Keine Kategorie zugewiesen"-Zeile sichtbar (Buchungen ohne `kategorie_id`)
- [ ] Klick auf Kategorie öffnet Drill-Down mit allen Buchungen (Datum, Empfänger, Zweck, Betrag, Konfidenz, Status)
- [ ] Inline-Edit: Kategorie über Dropdown ändern, Klassifikation toggeln, „Bestätigen"-Button (→ status=manuell_bestaetigt)
- [ ] PATCH-API speichert Änderung serverseitig, Audit-Eintrag wird angelegt
- [ ] Manuell bestätigte Buchungen werden bei künftiger Re-Klassifizierung übersprungen (Verhalten existiert bereits in PROJ-5-Pipeline)
- [ ] Keine privaten/neutralen Posten in „Steuerrelevante Auswertungen" — Filter „Nur steuerrelevant" als Option

## Edge Cases
- Was passiert mit Buchungen ohne `kategorie_id`? (eigene Zeile „— ohne Kategorie —", Drill-Down zeigt sie als bearbeitbar)
- Was passiert, wenn der Nutzer die Kategorie auf einen anderen Typ ändert (privat → geschäftlich)? (Klassifikation + Steuerrelevanz automatisch anpassen, neu validieren)
- Was passiert beim Inline-Edit während ein Klassifizierungs-Job läuft? (Edit klappt, betrifft nur diese Buchung; künftige Re-Läufe respektieren `manuell_bestaetigt`)
- Wie wird angezeigt, wenn eine Kategorie 0 Buchungen hat? (auf Wunsch ausblendbar via Filter „nur belegt")
- Hochbetrag-Buchungen mit niedriger Konfidenz in einer Kategorie → optisch hervorheben (Warnsymbol)

## Technical Requirements
- Performance: Eine effiziente Aggregation (Gruppierung in der DB statt clientseitig), Tabelle paginierbar
- Sicherheit: PATCH-API mit Zod-Validierung; nur eigene Buchungen
- Nachvollziehbarkeit: jede manuelle Änderung erzeugt audit_eintrag (Quelle „nutzer")

---

## Tech Design

### Backend-Bedarf: Ja
Aggregation + PATCH-Endpunkt für Inline-Edit.

### Datenmodell
Keine Schema-Änderung nötig — alle benötigten Spalten existieren in
`buchung` und `kategorie`. Audit-Eintrag in `audit_eintrag`.

### Komponentenstruktur
```
Kategorien-Analyse (/kategorien-analyse)
+-- Filter (Jahr-Select, Konto-Select, "nur steuerrelevant"-Toggle)
+-- Übersichts-Tabelle (Kategorie · Typ · USt · Anzahl · Summe · ⌀Konf · Status-Mix)
+-- Drill-Down (Sheet pro Kategorie):
    +-- Buchungs-Liste mit Inline-Edit (Kategorie-Dropdown, "Bestätigen"-Button)
```

### API
- `GET /api/kategorien-analyse?jahr=&konto=&nur_steuerrelevant=` → Aggregat je Kategorie
- `GET /api/kategorien-analyse/buchungen?kategorie_id=&jahr=&konto=` → Drill-Down-Liste
- `PATCH /api/buchungen/[id]` → Inline-Edit: kategorie_id, klassifikation, status (z.B. „manuell_bestaetigt")

### Abhängigkeiten (Pakete)
Keine neuen.

## Implementierungsnotizen

### 2026-05-20 — Abo-Radar mit Drill-Down + Bulk-Kategorisierung
- **API**: `WiederkehrendItem.beispiel_ids` (max 5) ersetzt durch vollständige `buchungen: WiederkehrendBuchung[]` — Datum, Betrag, Konto-Bezeichnung, Kategorie-Bezeichnung/Typ und Status pro Buchung. Stammdaten (Kategorien + Konten) werden in [src/app/api/finanzen/wiederkehrend/route.ts](src/app/api/finanzen/wiederkehrend/route.ts) einmal pro Request geladen und für die Anreicherung verwendet (kein n+1).
- **Neue Bulk-API** [src/app/api/buchungen/bulk-kategorie/route.ts](src/app/api/buchungen/bulk-kategorie/route.ts) (POST, max 500 IDs pro Aufruf): setzt für viele Buchungen eine Kategorie inkl. Auto-Konsistenz aus Kategorie-Typ (Klassifikation, USt-Satz, Steuerrelevant — gleiche Logik wie der Einzel-PATCH), markiert sie als `manuell_bestaetigt`, schreibt einen Audit-Eintrag pro Buchung (`aktion: "bulk_kategorie_gesetzt"`). Liefert `aktualisiert`-Count + `uebersprungen`-Liste für Fremd-IDs. Zod-Schema [src/lib/validation/buchungen-bulk.ts](src/lib/validation/buchungen-bulk.ts).
- **Neue Komponente** [src/components/kategorien-analyse/abo-radar.tsx](src/components/kategorien-analyse/abo-radar.tsx) ersetzt die alte Inline-Implementierung im Cockpit:
  - Neue Spalte **Anzahl** (`{n}×`) zwischen Intervall und Pro-Zahlung-Betrag.
  - **Aufklappbare Zeilen** (Caret-Icon + Klick auf die ganze Zeile): zeigt alle Buchungen des Items chronologisch.
  - In der Aufklappung: pro Buchung Datum, Konto, Betrag, **Inline-Kategorie-Select** (gruppiert nach Typ), Status-Badge, „Details öffnen"-Icon (öffnet das bestehende [BuchungDetailSheet](src/components/kategorien-analyse/buchung-detail-sheet.tsx)).
  - **Bulk-Aktion** „Kategorie auf alle {n} anwenden": Kategorie-Select + Button → POST an die Bulk-API → optimistisches Update der Tabelle + Toast mit Aktualisierungs-Count.
  - Zeigt oben rechts an, ob das Item bereits eine einheitliche Kategorie hat („Aktuell: …") oder uneinheitlich klassifiziert ist.
- Cockpit-Komponente lädt nach jeder Mutation komplett neu (`onMutiert={ladeDaten}`) — neue Buchungen können in andere Top-N-Kategorien rutschen, deshalb keine optimistische Cockpit-Aktualisierung.

### 2026-05-20 — Volldetails im Bewegungen-Tab (Inline-Aufklappen + Detail-Sheet)
- Tabelle bekommt eine Caret-Spalte (`ChevronRight/Down`) — Klick klappt eine Subrow auf mit vollem Empfänger/Zweck (kein Truncate), Klassifikation, USt-Satz, Steuerrelevant, Konfidenz, KI-Quelle, Begründung, Prüf-Grund, Anzahl Belege.
- Neue Detail-API [src/app/api/buchungen/[id]/detail/route.ts](src/app/api/buchungen/[id]/detail/route.ts): liefert Volldaten + verlinkte Paperless-Belege (über `beleg_buchung` mit Match-Score & Sperr-Flag) + die letzten 50 Audit-Einträge zur Buchung. Owner-scoped, RLS-geschützt.
- Neues Sheet [buchung-detail-sheet.tsx](src/components/kategorien-analyse/buchung-detail-sheet.tsx): rechts eingeblendet, lädt die Detail-API. Sektionen: Kopf-Betrag mit Status, Kerndaten, **Steuer/Kategorie** (Inline-Editor für Kategorie, USt-Satz, Klassifikation — PATCH `/api/buchungen/[id]`), **Entscheidung des Agenten** (Quelle, Konfidenz, Begründung, Regel-Bezeichnung), **Belege** mit `quell_link` zu Paperless, **Audit-Historie** (chronologisch absteigend, `details`-JSON ausklappbar), Aktion „Manuell bestätigen".
- Bewegungen-API [src/app/api/finanzen/bewegungen/route.ts](src/app/api/finanzen/bewegungen/route.ts) liefert zusätzlich `ust_satz`, `begruendung`, `quelle`, `pruef_grund` und `beleg_anzahl` (eine einzige `beleg_buchung`-Query pro Seite — kein n+1).
- Aktionen-Spalte aufgeräumt: Icon-Buttons für Belege (`FileText` mit Anzahl), „bestätigt"-Status (`CheckCircle2`), und „Detail öffnen" (`Eye`).

### 2026-05-20 — Geldbewegungen-Tab + Bereichs-Filter mit „beidseitig sichtbar"
- Bereichs-Filter in [bereich-filter.ts](src/lib/finanzen/bereich-filter.ts) so erweitert, dass „Neutral" und „Ohne Kategorie/Klassifikation" in **beiden** Bereichs-Tabs sichtbar sind. Logik jetzt: geschäftlich = strikt geschäftlich; privat = strikt privat; alles dazwischen (neutral/unklar/ohne) erscheint sowohl unter „Geschäftlich" als auch unter „Privat". Damit kommen die Subtotal-Zeilen `Σ Neutral` und `Σ Ohne Kategorie` automatisch in beiden Sichten.
- Neuer Tab **Geldbewegungen** (4. Position, vor Cockpit). Komponente [geldbewegungen-ansicht.tsx](src/components/kategorien-analyse/geldbewegungen-ansicht.tsx):
  - Chronologische Liste (Datum/Konto/Empfänger/Zweck/Betrag/Kategorie/Bereich-Badge).
  - Filter: Empfänger-/Zweck-Suche (debounced 300 ms), Richtung (Eingang/Ausgang/alle), Kategorie (inkl. „— ohne Kategorie —"), Pro-Seite (50/100/200/500).
  - Sortierbar nach Datum und Betrag mit Pfeil-Indikator.
  - Inline-Edit der Kategorie via Select + „Bestätigen"-Button (PATCH auf `/api/buchungen/[id]`, `manuell_bestaetigt`).
  - Kennzahlen-Reihe oben: Σ Eingänge / Σ Ausgänge / Saldo — über *alle* Treffer der Filter, nicht nur die aktuelle Seite.
  - Pagination unten (Server kennt Gesamt-Anzahl, Client navigiert).
- Neue API [src/app/api/finanzen/bewegungen/route.ts](src/app/api/finanzen/bewegungen/route.ts) + Zod-Schema [src/lib/validation/finanzen.ts](src/lib/validation/finanzen.ts): nimmt alle Filter entgegen, reichert mit Konto-Bezeichnung und Kategorie-Bezeichnung/Typ an (keine n+1 im Client), liefert Pagination-Metadaten + Filter-Gesamtsummen.

### 2026-05-20 — Finanz-Cockpit (Tabs, Diagramme, Abo-Radar)
- Hauptansicht in **3 Tabs** auf `/kategorien-analyse` umgebaut: **Geschäftlich** (EÜR-Sicht), **Privat** (Negativ-Liste: alles Nicht-Geschäftliche), **Gesamt-Cockpit**. Filter (Zeitraum, Konto, „nur steuerrelevant") liegen oberhalb und gelten tab-übergreifend.
- Neuer Bereichs-Filter `bereich` (`geschaeft` | `privat` | `alle`) in [analyseFilterSchema](src/lib/validation/kategorien-analyse.ts) und beiden Kategorien-APIs. Kanonische Logik in [src/lib/finanzen/bereich-filter.ts](src/lib/finanzen/bereich-filter.ts): `klassifikation` ist Primärsignal, Kategorie-Typ ist Fallback. Server filtert in JS nach (privat lässt sich nicht sauber als SQL-Negation ausdrücken).
- Neue API [src/app/api/finanzen/cockpit/route.ts](src/app/api/finanzen/cockpit/route.ts) liefert Kennzahlen, Monatsverlauf (YYYY-MM), Top-Kategorien (max 8) und Top-Empfänger (max 12) — Einnahmen-/Ausgaben-Klassifikation bevorzugt aus Kategorie-Typ, Vorzeichen nur Fallback.
- Neue API [src/app/api/finanzen/wiederkehrend/route.ts](src/app/api/finanzen/wiederkehrend/route.ts) erkennt Abos heuristisch: Gruppierung nach normalisiertem Empfänger, ≥ 3 Buchungen, Betragsstabilität (Median-Abweichung der Median-Abweichung < 20 %), regelmäßiger Median-Abstand (wöchentlich / monatlich / quartalsweise / jährlich ± Toleranz). Aktivitäts-Flag: letzte Buchung ≤ 1,5× Intervall her. Lookback automatisch auf mind. 365 Tage ausgeweitet — sonst würden jährliche Abos bei kurzem Filterzeitraum durchrutschen. Liefert geschätzte Jahresbelastung und Konfidenz pro Item.
- Neue Komponenten:
  - [zeitraum-picker.tsx](src/components/kategorien-analyse/zeitraum-picker.tsx) — wie gehabt.
  - [kategorien-tabelle.tsx](src/components/kategorien-analyse/kategorien-tabelle.tsx) — die bisherige Aggregat-Tabelle, ausgelagert und mit `KategorienFilter`-Prop (inkl. `bereich`).
  - [finanzen-cockpit.tsx](src/components/kategorien-analyse/finanzen-cockpit.tsx) — Kennzahlen-Karten (inkl. „Aktive Abos / Jahr"), `ComposedChart` Bar+Linie für Monatsverlauf, `PieChart` (Donut) für Top-Ausgaben-Kategorien mit farblich verbundener Liste, Tabelle Top-Empfänger, Abo-Radar-Tabelle (Aktiv/Inaktiv-Badges, Jahresbelastung, Konfidenz).
- shadcn-Komponente `chart` installiert (recharts ist Peer-Dependency, automatisch eingespielt — `recharts@2.15.4`).
- Im Cockpit-Tab ist der „Nur steuerrelevant"-Schalter deaktiviert (Cockpit ist Konto-Sicht, nicht EÜR).

### 2026-05-20 — Zeitraum-Filter + Einnahmen/Ausgaben-Übersicht
- Filter `jahr` ersetzt durch flexiblen Datumsbereich `von`/`bis` (ISO `YYYY-MM-DD`). Backward-kompatibel: `jahr` bleibt im Zod-Schema als Quickfilter, `von`/`bis` haben Vorrang.
- Neue Komponente [src/components/kategorien-analyse/zeitraum-picker.tsx](src/components/kategorien-analyse/zeitraum-picker.tsx): zwei Popover-Kalender (von/bis, `de`-Locale, Wochenstart Mo) plus Schnellauswahl-Chips (Dieser Monat, Letzter Monat, aktuelles Quartal, aktuelles Jahr, Vorjahr, „Alle Zeit"). Default: laufendes Kalenderjahr.
- shadcn `calendar` installiert (`npx shadcn add calendar`). Korrektur in [src/components/ui/calendar.tsx](src/components/ui/calendar.tsx): obsolete `table`-className entfernt — react-day-picker v10 kennt diesen Key nicht mehr (TS-Build-Fehler).
- Neue Kennzahlen-Reihe oben in der Ansicht: **Geldeingänge (Einnahmen)**, **Geldausgänge (Ausgaben)**, **Saldo**. Einnahmen/Ausgaben werden anhand des Kategorie-Typs aggregiert (nicht des Vorzeichens) — Erstattungen bleiben damit auf der Einnahmen-Seite. Buchungen ohne Kategorie zählen nur in die Bruttosumme, nicht in Einnahmen/Ausgaben.
- Tabelle gruppiert weiterhin nach Typ (Sortierung kam schon serverseitig), zusätzlich am Ende jeder Gruppe eine **Subtotal-Zeile** (`Σ Einnahmen` / `Σ Ausgaben` / …) mit Anzahl + Summe, farbig akzentuiert.
- Drill-Down (`KategorieDrilldown`) nimmt jetzt `von`/`bis` statt `jahr` und filtert konsistent zur Übersicht. Drill-Down-API ([src/app/api/kategorien-analyse/buchungen/route.ts](src/app/api/kategorien-analyse/buchungen/route.ts)) und Aggregat-API ([src/app/api/kategorien-analyse/route.ts](src/app/api/kategorien-analyse/route.ts)) lesen `von`/`bis` ein.
- `AnalyseResponse.gesamt` um `summe_einnahmen`, `summe_ausgaben`, `saldo` erweitert.
- Page-Komponente lädt kein `jahre`-Array mehr — Zeitraum-Picker hat eigene Presets, das spart einen 10k-Buchungs-Query.

## QA Test Results

### 2026-05-20 — Manuelle Abnahme durch Inhaber
- Alle vier Tabs (Geschäftlich, Privat, Geldbewegungen, Gesamt-Cockpit) durchgeklickt und für gut befunden.
- Globale Filter (Zeitraum-Picker, Konto, „nur steuerrelevant") funktionieren tab-übergreifend.
- Inline-Edit, Drill-Down, Detail-Sheet und Bulk-Kategorisierung im Abo-Radar arbeiten erwartungsgemäß.
- Restfehler werden nachträglich als kleine Fixes nachgezogen, nicht als Re-QA des gesamten Features.

## Deployment
_To be added by /deploy_
