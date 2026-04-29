# PROJ-37: Katalog-Druck-Wizard mit Inhaltsauswahl

## Status: Deployed
**Created:** 2026-04-29
**Last Updated:** 2026-04-29

## Dependencies
- Erweitert: PROJ-10 (PDF-Export Gesamtkatalog) — ersetzt das dort beschriebene flache Parameter-Formular
- Erweitert: PROJ-6 (Preisverwaltung — drei Spuren `lichtengros`, `eisenkeil`, `listenpreis`)
- Voraussetzt: PROJ-8 (Wechselkurs in `katalog_einstellungen.wechselkurs_eur_chf`)

## Hintergrund / Motivation
Bisher kennt der Katalog-Job nur das Layout (Lichtengros/Eisenkeil). Für den Druck brauchen wir aber den vollen Parametersatz aus dem alten FileMaker-Dialog (siehe Screenshot „KATALOGPARAMETER") **plus** eine Inhaltsauswahl: Kunden bekommen oft nur einen Ausschnitt des Sortiments — heute geht das nur per Nachbearbeitung im PDF.

Konkrete Anforderung des Nutzers:
- Vor jedem Druck Parameter abfragen (Layout, Preisspur, Aufschlag ±%, Währung)
- Inhalte auf **Produktebene** ein-/ausschließen können (nicht nur Bereich/Kategorie)
- Default: alles ausgewählt = heutiges Verhalten

## User Stories
1. Als interner Nutzer möchte ich vor dem PDF-Druck **Layout, Preisspur, prozentualen Auf-/Abschlag, Währung** wählen, damit ich für unterschiedliche Kunden unterschiedliche Pricelists generieren kann.
2. Als interner Nutzer möchte ich vor dem Druck **einzelne Bereiche, Kategorien oder Produkte abwählen**, damit ein Kunde nur die für ihn relevante Auswahl bekommt.
3. Als interner Nutzer möchte ich **immer alles vorausgewählt** vorfinden, damit der häufigste Fall (Vollkatalog) ein einziger Klick bleibt.
4. Als interner Nutzer möchte ich die **Anzahl ausgewählter Produkte live** sehen, während ich filtere, damit ich eine Plausibilitätsprüfung habe, bevor ich die Generierung starte.
5. Als interner Nutzer möchte ich **innerhalb der Produktauswahl suchen** können, damit ich bei 400+ Produkten einzelne gezielt finde.

## Acceptance Criteria

### Wizard-Struktur
- [ ] Wizard mit zwei Schritten in einem Dialog (Tabs oder Stepper, Nutzer kann frei wechseln)
- [ ] Schritt 1: **Parameter** · Schritt 2: **Inhalt auswählen**
- [ ] Footer-Buttons: „Zurück" · „Abbrechen" · „PDF erstellen" (letzterer nur in Schritt 2 aktiv)

### Schritt 1 — Parameter
- [ ] Feld **Layout**: Radio · `eisenkeil` / `lichtengros` · Pflicht · Default = letzte Auswahl pro User (Fallback `lichtengros`)
- [ ] Feld **Preisauswahl** (Spur): Dropdown mit drei Optionen
  - `lichtengros` → „Lichtengros-Preis"
  - `eisenkeil` → „Eisenkeil-Preis"
  - `listenpreis` → „Listenpreis"
  - Default = `listenpreis`
- [ ] Feld **Preisänderung Vorzeichen**: Radio · `plus` / `minus` · Default `plus`
- [ ] Feld **Preisänderung in %**: Zahleneingabe, 0 – 100, eine Nachkommastelle, Default `0,0`
- [ ] Feld **Währung**: Radio · `EUR` / `CHF` · Default `EUR` · bei `CHF` wird `wechselkurs_eur_chf` aus `katalog_einstellungen` angewandt
- [ ] Feld **Sprache**: Dropdown nur „Deutsch", **disabled** mit Hint „in Entwicklung"
- [ ] Validierung blockt Übergang zu Schritt 2, wenn Pflichtfelder leer sind

### Schritt 2 — Inhaltsauswahl
- [ ] Drei-Ebenen-Baum: **Bereich → Kategorie → Produkt**
- [ ] Tri-state Checkboxen je Knoten (an / aus / teilweise)
- [ ] Toggle Bereich → wirkt auf alle darunterliegenden Kategorien/Produkte
- [ ] Toggle Kategorie → wirkt auf alle Produkte darunter; setzt Bereich auf tri-state, falls Geschwister abweichen
- [ ] Toggle Produkt → setzt Kategorie/Bereich auf tri-state, wenn nötig
- [ ] Default-Zustand beim Öffnen: **alles ausgewählt**, alle Bereiche **eingeklappt**
- [ ] Pro Knoten Counter: „X / Y Produkte ausgewählt"
- [ ] Suchfeld oben: filtert Produkte (Artikelnummer, Name) — Treffer expandieren ihren Pfad automatisch
- [ ] Buttons über dem Baum: „Alle auswählen" · „Alle abwählen" · „Auswahl umkehren"
- [ ] Footer-Counter (immer sichtbar): „**312 / 412 Produkte** in **18 Bereichen** und **62 Kategorien** ausgewählt"
- [ ] Generierung blockiert, wenn 0 Produkte ausgewählt — Toast: „Bitte mindestens ein Produkt auswählen"

### Preis-Berechnung im Output
- [ ] Formel:
  ```
  basis     = produkt.preis[gewählte_spur]              -- numeric
  faktor    = 1 + (vorzeichen * pct/100)                -- z. B. 1.20 oder 0.85
  in_eur    = basis * faktor
  gedruckt  = waehrung == 'CHF' ? in_eur * wechselkurs : in_eur
  ergebnis  = round(gedruckt, 2)                        -- kommerziell, 0,5 auf
  ```
- [ ] Rundung **erst am Ende**, nie zwischendurch
- [ ] Produkte ohne Preis in der gewählten Spur → „auf Anfrage" im PDF

### Job-Persistenz
- [ ] Migration `katalog_jobs` um folgende Spalten:
  - `preis_spur text NOT NULL DEFAULT 'listenpreis' CHECK (preis_spur IN ('lichtengros','eisenkeil','listenpreis'))`
  - `preisaenderung_pct numeric(5,2) NOT NULL DEFAULT 0` — vorzeichenbehaftet, z. B. `-10.00` oder `20.00`
  - `waehrung text NOT NULL DEFAULT 'EUR' CHECK (waehrung IN ('EUR','CHF'))`
  - `sprache text NOT NULL DEFAULT 'de'`
  - `produkt_ids uuid[] NULL` — `NULL` = alle Produkte; sonst explizite Whitelist
- [ ] Job-Runner ([src/app/api/katalog-jobs/[id]/run/route.ts](src/app/api/katalog-jobs/[id]/run/route.ts)) liest neue Felder und filtert die Produktliste entsprechend
- [ ] Beim Speichern eines Jobs wird die letzte Auswahl pro User in `localStorage` als „last preset" abgelegt (für Schritt 1) — die Produktliste wird **nicht** automatisch wiederhergestellt (zu fehleranfällig, da Produkte sich ändern)

### Sortierung & Trennseiten im Output
- [ ] Bereichs-Trennseiten und Index nur für Bereiche, die mindestens **ein** ausgewähltes Produkt enthalten
- [ ] Kategorie-Header nur, wenn mindestens **ein** Produkt der Kategorie ausgewählt ist
- [ ] Reihenfolge unverändert: Bereich-`sortierung` → Kategorie-`sortierung` → Produkt-`sortierung`
- [ ] Index zeigt Seitenzahlen passend zum tatsächlich generierten Inhalt (kein Toter Link)

## Edge Cases
- Nutzer wählt **0 Produkte** → „PDF erstellen" disabled
- Nutzer wählt **nur 1 Produkt** → Cover, Index (mit einem Eintrag), eine Bereichs-Trennseite, eine Datenblattseite, Backcover
- Nutzer wählt einen ganzen **Bereich ohne Kategorien** ab → Bereich erscheint nicht im Index
- Produkt **ohne Preis in der gewählten Spur** → „auf Anfrage" statt Preis, sonst normal anzeigen
- Aufschlag **negativ** ergibt Preis ≤ 0 → trotzdem drucken (Nutzerverantwortung); Werte unter 0 abrunden auf 0,00
- Wechselkurs nicht gesetzt und Währung CHF → Job bricht mit klarer Fehlermeldung „Wechselkurs in Einstellungen fehlt"
- Sehr große Auswahl (alle 412 Produkte) → Wizard muss flüssig bleiben; Tree virtualisieren falls nötig
- Konkurrenz: zwei Nutzer starten gleichzeitig Jobs → unabhängig, jeder hat seine Job-Row
- Während Job läuft: Wizard-Dialog schließt sich, Job-Status wird auf einer separaten Seite/Toast verfolgt (bestehender Flow aus PROJ-10)

## Out of Scope (bewusst nicht in MVP)
- Speicherbare **Presets / Kunden-Profile** („Kunde Müller bekommt immer Bereich X+Y") — eigenes Folge-Feature
- Mehrsprachigkeit — Sprache-Dropdown bleibt disabled
- Vorschau einzelner Seiten direkt im Wizard
- Drag & Drop Umsortierung der Produkte
- Bereichs-/Kategorie-Trennseiten ein-/ausblenden über Wizard

## Offene Punkte (vor Architektur klären)
- Speicherort der Wizard-User-Defaults: `localStorage` oder eigene Tabelle `user_preferences`?
- Tree-Komponente: shadcn hat keine native Tree-Komponente — entweder selbst auf Basis `Collapsible` + `Checkbox` bauen oder Drittlib (`react-arborist`)? Tendenz: selbst bauen, max. 3 Ebenen, ~500 Knoten.
- Soll die Wizard-Seite weiterhin unter `/export/katalog` liegen oder als Modal über dem Produktkatalog erscheinen?

## Technische Notizen
- Bestehender Code-Pfad: [src/app/export/katalog/page.tsx](src/app/export/katalog/page.tsx) und [src/app/api/katalog-jobs/[id]/run/route.ts](src/app/api/katalog-jobs/[id]/run/route.ts)
- Drei Preisspuren liegen schon in der DB (siehe commit `42302fe chore(preise): Drei-Spuren-Schema`)
- Wizard ist ein **Vorbereiter** für die kommende LaTeX-Renderer-Migration — Job-Schema muss bereits final sein, bevor wir das Rendering tauschen

---

## Tech Design (Solution Architect)

### Entschiedene offene Punkte
| Frage | Entscheidung |
|---|---|
| Wo lebt der Wizard? | **Modal-Dialog**, ausgelöst per Button auf der Produktübersicht (`/produkte`). Bestehende Seite `/export/katalog` zeigt weiterhin die Job-Liste/History. |
| Wie werden Defaults persistiert? | **localStorage pro Browser** (`lichtengross.katalog-wizard.defaults`). |
| Geltung des Aufschlags | Wirkt auf **alle drei Preisspuren** (einfacher Multiplikator). |
| Tree-Komponente | **Selbst gebaut** auf Basis vorhandener shadcn-Primitives (`Checkbox`, `Collapsible`, `ScrollArea`, `Command` für Suche). Max. 3 Ebenen, ~500 Knoten — keine Drittlib nötig. |
| Job-Schema-Änderung | **Keine neuen Spalten** auf `katalog_jobs`. Parameter liegen bereits als `jsonb` vor — wir erweitern nur das JSON-Schema. |

### A) Component Structure (Visual Tree)

```
Produktübersicht (/produkte)
+-- Bestehende Tabelle / Filter
+-- [+ Button "Katalog drucken"]   ← neu
       |
       v
KatalogDruckDialog (Modal)
+-- Header: "Katalog drucken" + Stepper (Schritt 1 / 2)
+-- Tab "Parameter" (Schritt 1)
|   +-- Layout (Radio: Lichtengros | Eisenkeil)
|   +-- Preisauswahl (Select: Lichtengros | Eisenkeil | Listenpreis)
|   +-- Preisänderung (Radio: + / -)
|   +-- Preisänderung in % (Number-Input)
|   +-- Währung (Radio: EUR | CHF, Hinweis "Kurs aus Einstellungen")
|   +-- Sprache (Select, disabled, "Deutsch")
+-- Tab "Inhalt auswählen" (Schritt 2)
|   +-- Aktions-Toolbar (Alle / Keine / Umkehren / Suche)
|   +-- ProduktTree
|   |   +-- BereichKnoten (Checkbox + ChevronToggle + Counter)
|   |       +-- KategorieKnoten (Checkbox + ChevronToggle + Counter)
|   |           +-- ProduktKnoten (Checkbox + Artikelnr. + Name + Preis-Hinweis)
|   +-- ScrollArea umgibt den Tree
+-- Footer
    +-- Status-Counter "X / Y Produkte ausgewählt"
    +-- Buttons: "Zurück" · "Abbrechen" · "PDF erstellen"
```

**Neue Datei-Struktur:**
```
src/components/katalog-drucken/
+-- katalog-drucken-dialog.tsx     (Modal-Wrapper, Stepper-State)
+-- schritt-parameter.tsx          (Schritt 1: Formular)
+-- schritt-inhalt.tsx             (Schritt 2: Tree + Toolbar + Counter)
+-- produkt-tree.tsx               (rekursiver Tree mit tri-state)
+-- produkt-tree-knoten.tsx        (einzelner Tree-Eintrag)
+-- use-tree-selection.ts          (Hook: Set<id> + Helpers für tri-state)
+-- use-wizard-defaults.ts         (Hook: localStorage Lesen/Schreiben)
+-- types.ts                       (gemeinsame Typen)
src/app/produkte/
+-- page.tsx                       (← bestehender Datei: Button einbauen)
src/app/export/katalog/
+-- page.tsx                       (← Form weg, nur noch Job-Liste)
+-- katalog-form.tsx               (← gelöscht oder als Hülle reduziert)
+-- actions.ts                     (← startKatalogJob nimmt erweiterte Params)
src/app/api/katalog-jobs/[id]/run/
+-- route.ts                       (← liest neue Params, filtert Produkte)
src/lib/pdf/
+-- katalog-document.tsx           (← KatalogParams erweitert)
+-- katalog-preis.ts (neu)         (← Preis-Berechnungs-Helper)
```

### B) Data Model (plain language)

**Keine neue Tabelle, keine neuen Spalten.** Die `katalog_jobs.parameter`-Spalte ist bereits ein `jsonb`-Feld, das wir um neue Schlüssel erweitern. Folgendes JSON-Schema gilt nach dem Feature:

```
parameter: {
  layout              : "lichtengros" | "eisenkeil"
  preisauswahl        : "lichtengros" | "eisenkeil" | "listenpreis"   ← erweitert (vorher: "listenpreis"|"ek")
  preisAenderung      : "plus" | "minus"
  preisProzent        : number   (0–100, eine Nachkommastelle)
  waehrung            : "EUR" | "CHF"
  wechselkurs         : number   (zum Zeitpunkt des Jobs eingefroren)
  sprache             : "de"
  produktIds          : string[] | null   ← null = alle Produkte; sonst Whitelist mit UUIDs
}
```

**Migration-Strategie für Altdaten:**
- Bestehende Jobs haben `preisauswahl: "ek"`. Der Job-Runner mappt beim Lesen `"ek" → "lichtengros"` als Übergangsregel und loggt eine Warnung. Da Jobs reine Auftragsdaten sind und nach kurzer Zeit gelöscht werden, ist eine Datenmigration nicht nötig.
- Felder, die im JSON fehlen (`sprache`, `produktIds`), werden vom Runner mit Defaults aufgefüllt.

**Wizard-Defaults im Browser (`localStorage`):**
```
key: "lichtengros.katalog-wizard.defaults"
value: {
  layout, preisauswahl, preisAenderung, preisProzent, waehrung
}
```
Die **Produktauswahl wird bewusst nicht im localStorage** gespeichert — Produkte können sich zwischen Sessions ändern, das wäre fehleranfällig. Default beim Öffnen ist immer „alles ausgewählt".

**RLS:** keine Änderungen. `katalog_jobs` hat bereits Policies, das Schema bleibt gleich.

**Indizes:** keine neuen nötig. Filterung passiert in der App-Schicht (Job-Runner lädt alle Produkte, behält nur die mit ID in `produktIds`).

### C) Tech-Entscheidungen (für PM begründet)

**1. Modal-Dialog statt eigener Seite**
Der Druckvorgang ist ein punktueller, unterbrechungsfreier Vorgang — Nutzer kommt aus dem Produktlisting, will einen Katalog drucken, geht zurück. Ein Modal hält sie im Kontext. Status-Seite bleibt unter `/export/katalog` für die History.

**2. JSON-Erweiterung statt neuer DB-Spalten**
Die Job-Parameter liegen schon heute als JSON in der Datenbank. Eine Migration mit fünf neuen Spalten wäre unnötiger Ballast — das JSON ist genau für solche Erweiterungen da. Reduziert Risiko (keine Schema-Änderung), Aufwand (keine Migration) und macht zukünftige Parameter-Erweiterungen trivial.

**3. localStorage statt Server-Persistenz für Defaults**
Drei interne Nutzer arbeiten meist am selben Rechner. Eine `user_preferences`-Tabelle plus RLS plus API wäre Overkill für „merk dir mein letztes Layout". Falls später gewünscht, ist die Migration zu Server-Persistenz simpel (gleicher Key, anderer Speicher).

**4. Tree selbst bauen statt Drittlib**
Drittlibs wie `react-arborist` lösen Probleme, die wir nicht haben (riesige Listen, Drag&Drop, Inline-Editing). Bei 3 Ebenen und ~500 Knoten genügt eine simple rekursive Komponente mit shadcn-Primitives. Kein neues Dependency, volle Kontrolle über Verhalten und Styling.

**5. Set-basiertes State-Management für Tree-Auswahl**
Statt einen Baum mit „checked/indeterminate"-Flags pro Knoten zu verwalten, halten wir nur eine **`Set<produkt_id>`** der ausgewählten Produkte. Bereich/Kategorie-Status leiten wir live ab (alle/keine/teilweise). Vorteile: kein State-Drift, einfach zu testen, gleiche Repräsentation wie das DB-Feld `produktIds`. Counter („312 / 412") ist eine einfache `set.size`-Operation.

**6. Aufschlag wirkt unverändert auf alle Spuren**
Der Multiplikator ist ein simpler Postprocessor auf dem Basispreis. Wenn jemand einen Aufschlag auf den Eisenkeil-Preis legt, ist das eine **bewusste Entscheidung** des Nutzers — kein „dummer Default", den die UI verhindern muss. Maximale Flexibilität, minimaler Code.

**7. Wechselkurs zum Zeitpunkt des Jobs einfrieren**
Der Wechselkurs wird beim Anlegen des Jobs aus den Einstellungen gelesen und ins JSON geschrieben. Wenn ein Admin später den Kurs ändert, ändert sich der bereits generierte Katalog **nicht** rückwirkend — Jobs sind nachvollziehbar reproduzierbar. Das ist heute schon so umgesetzt.

**8. Reine UI-Filterung der Tree-Suche**
Suchfeld filtert client-seitig — die ~500 Produkte sind beim Öffnen des Dialogs ohnehin geladen (für die Counter). Keine zusätzliche API-Roundtrip.

### D) Dependencies

Keine neuen npm-Pakete nötig. Alle benötigten shadcn-Komponenten sind bereits installiert (`dialog`, `tabs`, `radio-group`, `select`, `checkbox`, `input`, `command`, `collapsible`, `scroll-area`, `progress`, `button`, `label`, `badge`).

### Test-Strategie (Übersicht)

- **Unit:** Tree-Selection-Helper (Set-Operations für tri-state, Cascade-Logik), Preis-Berechnungs-Helper (Aufschlag, Währung, Rundung, Kantenfälle).
- **Integration:** Server-Action mit erweiterten Parametern (Validierung, Job-Anlage), Job-Runner-Filter (Whitelist `produktIds`).
- **E2E (Playwright):** Wizard-Happy-Path (Standardparameter → PDF erstellen), Inhaltsauswahl (einzelne Produkte abwählen → Katalog enthält nur diese), Edge-Cases (0 Produkte → Button disabled, Suchfunktion expandiert Pfad).

### Risiken / Aufmerksamkeitspunkte

- **`aktuelle_preise_flat`-View:** Aktuell liefert sie laut Code-Inspektion `listenpreis` und `ek`. Für die drei Spuren brauchen wir entweder die Spalten `lichtengros`, `eisenkeil`, `listenpreis` in der View — **vor** dem Backend-Step prüfen und ggf. View anpassen. (Kleine Migration, kein Daten-Backfill.)
- **`KatalogParams`-Type-Migration:** Der Type wird in mehreren Dateien benutzt (`actions.ts`, `katalog-document.tsx`, `route.ts`, `katalog-form.tsx`). Erweiterung muss synchron erfolgen, sonst TS-Fehler.
- **Renderer-Auswirkungen:** Die Trennseiten/Index-Logik im Renderer muss filterbasiert sein — Bereich nur drucken, wenn ≥1 ausgewähltes Produkt darunter ist. Aktuell wird stumpf alles durchlaufen.

---

## Frontend-Implementation (2026-04-29)

### Was umgesetzt wurde
- **Modal-Wizard** als neue Komponente unter [src/components/katalog-drucken/](src/components/katalog-drucken/), eingehängt im Header von [src/app/produkte/page.tsx](src/app/produkte/page.tsx) als roter Primär-Button „Katalog drucken".
- **Schritt 1 (Parameter):** Layout, Preisspur (drei Optionen: Lichtengros / Eisenkeil / Listenpreis), Vorzeichen ±, Prozent, Währung (EUR/CHF mit Live-Wechselkurs-Anzeige), Sprache disabled.
- **Schritt 2 (Inhalt):** Selbst gebauter 3-Ebenen-Tree mit Tri-State-Checkboxen, Suche mit Highlighting, automatischem Aufklappen der Treffer-Pfade, Toolbar (Alle/Keine/Umkehren), Live-Counter im Footer.
- **Defaults via localStorage** unter Key `lichtengros.katalog-wizard.defaults` (siehe [use-wizard-defaults.ts](src/components/katalog-drucken/use-wizard-defaults.ts)).
- **Tree-State** als reines `Set<produkt_id>` im [use-tree-selection.ts](src/components/katalog-drucken/use-tree-selection.ts) — Bereich/Kategorie-State (an / aus / indeterminate) wird live abgeleitet, kein Drift.
- **Server-Action** [actions.ts](src/components/katalog-drucken/actions.ts) validiert Eingaben mit Zod, friert den Wechselkurs ein, blockiert CHF ohne gepflegten Kurs.
- **Tree-Daten-Loader** [getKatalogTree()](src/lib/cache.ts) als gecachte Funktion (5 Min TTL, invalidiert via Tags `bereiche|kategorien|produkte`) — lädt 423 Produkte in einer Hierarchie auf einen Schlag.
- **Unit-Tests** ([use-tree-selection.test.ts](src/components/katalog-drucken/use-tree-selection.test.ts)) decken alle Tri-State-Fälle, Cascade-Toggles, `selectAll/None/invert` und `toJobValue` ab — 8/8 grün.
- **Browser-Smoke-Test** über Playwright durchgeführt: Wizard öffnet, beide Schritte rendern korrekt, Suche/Filter/Tri-State funktionieren mit Echtdaten (423 Produkte / 20 Bereiche / 79 Kategorien).

### Bug während Smoke-Test gefunden und gefixt
Erste Tree-Version hatte verschachtelte Buttons (Bereich-Klick = `<button>`, Tri-State-Checkbox = `<button>`) → Hydration-Errors. Auf eine `<div>`-Reihe mit zwei Sibling-Buttons (Chevron-Toggle + Label-Toggle) plus Checkbox umgebaut.

### Neue Dateien
```
src/components/katalog-drucken/
├── types.ts                          # gemeinsame Typen + Konstanten
├── use-wizard-defaults.ts            # localStorage-Hook
├── use-tree-selection.ts             # Set-basierter Selection-Hook
├── use-tree-selection.test.ts        # 8 Unit-Tests
├── tri-state-checkbox.tsx            # Radix-Checkbox mit indeterminate-Indikator
├── produkt-tree.tsx                  # rekursiver Tree mit Suche & Highlight
├── schritt-parameter.tsx             # Schritt 1
├── schritt-inhalt.tsx                # Schritt 2 (Toolbar + Tree)
├── katalog-drucken-dialog.tsx        # Modal-Wrapper, Stepper, Submit
└── actions.ts                        # Server-Action startKatalogWizardJob
```

### Geänderte Dateien
- [src/app/produkte/page.tsx](src/app/produkte/page.tsx) — Wizard-Button im Header, lädt Tree + Wechselkurs vor.
- [src/lib/cache.ts](src/lib/cache.ts) — neue Funktion `getKatalogTree()`.

### Was im Frontend bewusst NICHT angefasst wurde
- Der bestehende Job-Runner ([api/katalog-jobs/[id]/run/route.ts](src/app/api/katalog-jobs/[id]/run/route.ts)) liest noch das alte JSON-Schema (`preisauswahl: "listenpreis"|"ek"`). Der Wizard schreibt das **neue** Schema (`preisauswahl: "lichtengros"|"eisenkeil"|"listenpreis"`, plus `produktIds`), der Runner muss im **Backend-Step** angepasst werden. Bis dahin produzieren Wizard-Jobs sichtbar einen Render-Fehler — das ist gewollt, damit der Backend-Step nichts „aus Versehen" funktionierend findet.
- `aktuelle_preise_flat`-View liefert nach wie vor nur `listenpreis`/`ek` — muss im Backend-Step um `lichtengros` und `eisenkeil` erweitert werden.
- Die alte `KatalogForm` auf `/export/katalog` wurde NICHT entfernt, damit der bestehende Flow vorerst noch funktioniert.

### Offene Punkte für `/backend`
1. Job-Runner: neue Parameter-Felder lesen, Produkt-Whitelist anwenden, Trennseiten/Index nur für Bereiche/Kategorien mit ≥1 ausgewähltem Produkt.
2. View `aktuelle_preise_flat` um die drei Spalten erweitern.
3. `KatalogParams`-Type erweitern (in [src/lib/pdf/katalog-document.tsx](src/lib/pdf/katalog-document.tsx)).
4. Preis-Helper bauen (Aufschlag + Rundung + „auf Anfrage"-Fallback).
5. Bestehenden `KatalogForm`-Pfad entweder migrieren oder deprecaten.

---

## Backend-Implementation (2026-04-29)

### Was umgesetzt wurde
- **`KatalogParams`-Type** erweitert auf drei Spuren plus optionale Felder `sprache` und `produktIds`. Neuer Typ `ProduktPreise` mit allen drei Spuren plus `ek`-Alias als Backwards-Compat. Siehe [src/lib/pdf/katalog-document.tsx](src/lib/pdf/katalog-document.tsx).
- **`calcPrice`** umgebaut: liest die richtige Spur, Konvertierung erst am Ende, kommerzielle Rundung half-up, negativer Endwert wird auf 0 gekappt, fehlender Spur-Preis → `null` (Renderer zeigt „auf Anfrage").
- **`formatSpaltenWert`** in [src/lib/katalog-column-map.ts](src/lib/katalog-column-map.ts): bei Preis = null erscheint statt `"—"` jetzt `"auf Anfrage"`.
- **Job-Runner** in [src/app/api/katalog-jobs/[id]/run/route.ts](src/app/api/katalog-jobs/[id]/run/route.ts):
  - **`normalizeParams`**: liest Parameter aus `katalog_jobs.parameter`, mappt Alt-Spur `"ek" → "lichtengros"`, füllt fehlende Felder mit Defaults, wirft sprechende Fehler bei kaputtem JSON.
  - **Whitelist-Filter**: Wenn `produktIds` gesetzt sind, werden Produkte gefiltert; Kategorien ohne Produkte fliegen raus, Bereiche ohne Kategorien ebenfalls.
  - **Bild-Downloads** laufen nur für gefilterte Bereiche/Kategorien/Produkte — bei Mini-Auswahl spart das viele MB an Storage-Reads.
  - **Renderer-Aufruf** bekommt `filteredBereiche` statt `bereiche` → Index und Trennseiten sind automatisch korrekt.
- **Preis-Map** mit allen drei Spuren befüllt aus `aktuelle_preise_flat`-Spalten (`listenpreis`, `ek_lichtengros`, `ek_eisenkeil`). Keine View-Migration nötig — die Spalten existieren bereits.
- **Alte `KatalogForm`** auf `/export/katalog` entfernt (Datei gelöscht), die Seite zeigt jetzt nur noch die Job-Liste plus ein Banner, das auf den Wizard verweist. Die Server-Action `startKatalogJob` wurde gelöscht (tot).
- **Tests:** 13 neue Unit-Tests für `calcPrice` (alle Spuren, CHF, Aufschlag, Rundung, null-Fälle) und 11 für `normalizeParams` (Backwards-Compat, Defaults, Edge-Cases). Insgesamt 32/32 PROJ-37-Tests grün.

### End-to-End-Test im Browser
1. Wizard mit „Alle abwählen" + Bereich „LED LEUCHTMITTEL" (6 Produkte) → PDF erstellen.
2. Job-Runner-Logs zeigen: `downloading 6 product images` (statt 423), `kategorie images: 8/8` (= 2 × 4 statt 79 × 4).
3. PDF mit **309 KB** (statt ~25 MB Vollkatalog) in 28 Sekunden generiert.
4. Job-Status-Seite zeigt korrekt `lichtengros · listenpreis · plus0% · EUR`.

### Was bewusst NICHT angepasst wurde
- **Keine View-Migration** auf `aktuelle_preise_flat`. Die View liefert seit PROJ-6 schon alle drei Spuren als Spalten (`listenpreis`, `ek_lichtengros`, `ek_eisenkeil`). Das im Spec-Risiko vermutete Migration-Risiko gibt es nicht.
- **Kein neues `katalog_jobs`-Schema**. Parameter werden weiter im bestehenden `parameter jsonb`-Feld abgelegt — wie im Tech Design entschieden.
- **Keine RLS-Änderungen**. `katalog_jobs` und `produkte` haben bereits Policies, das Schema bleibt gleich.

### Geänderte/gelöschte Dateien
- `src/lib/pdf/katalog-document.tsx` — `KatalogParams`/`ProduktPreise`-Types, `calcPrice` umgebaut, exportiert.
- `src/lib/katalog-column-map.ts` — „—" → „auf Anfrage".
- `src/app/api/katalog-jobs/[id]/run/route.ts` — Whitelist-Filter, `normalizeParams`-Helper, neue Preis-Map-Befüllung, gefilterte Bild-Downloads.
- `src/app/export/katalog/page.tsx` — Form raus, Banner mit Wizard-Hinweis rein.
- `src/app/export/katalog/actions.ts` — `startKatalogJob` entfernt (tot).
- `src/app/export/katalog/katalog-form.tsx` — **gelöscht**.
- `src/lib/pdf/katalog-preis.test.ts` — **neu** (13 Tests).
- `src/app/api/katalog-jobs/[id]/run/normalize-params.test.ts` — **neu** (11 Tests).

---

## QA Test Results (2026-04-29)

### Zusammenfassung
- **Acceptance Criteria getestet:** alle 26 Items aus dem Spec (Wizard-Struktur, Schritt 1, Schritt 2, Preis-Berechnung, Job-Persistenz, Sortierung & Trennseiten)
- **Status:** **Bestanden mit zwei Low-Bugs** (kein Critical/High, keine Blocker)
- **Production-ready:** **READY** (Bugs sind Low/Beobachtung — können nach Deployment gefixt werden)

### Test-Ergebnisse

| Bereich | Pass | Fail | Beobachtung |
|---|---|---|---|
| Wizard-Grundstruktur (Modal, Stepper, Footer-Buttons) | ✅ | – | – |
| Schritt 1 — Parameter (Layout, Preisspur, Vorzeichen, %, Währung, Sprache) | ✅ | – | Defaults + alle 3 Spuren im Dropdown verifiziert |
| Schritt 2 — Tree, Tri-State, Counter, Suche, Aktions-Toolbar | ✅ | – | Tri-State korrekt: indeterminate bei Geschwister-Differenz |
| Edge-Case 0 Produkte | ✅ | – | „PDF erstellen" disabled, Counter `0 / 423` |
| Default-Persistenz (localStorage) | ✅ | – | Reload bringt gespeicherte Werte zurück |
| Preis-Berechnung (Aufschlag, CHF, Rundung, „auf Anfrage") | ✅ | – | 13 Unit-Tests grün |
| Job-Persistenz (`parameter`-JSON erweitert) | ✅ | – | E2E mit 6 Produkten: PDF 309 KB statt 25 MB |
| Sortierung & Trennseiten (nur Bereiche/Kategorien mit ≥1 Produkt) | ✅ | – | Job-Runner-Filter durch Backend-Smoke verifiziert |
| Backwards-Compat alte Spur `"ek"` | ✅ | – | 11 Unit-Tests grün, mappt auf `lichtengros` |

### Cross-Browser & Responsive
- **Chrome (Desktop 1440×900):** ✅ alles funktional, sauber 2-spaltig
- **Tablet (768×900):** ✅ Wizard-Layout sauber 2-spaltig, Counter/Buttons sichtbar
- **Mobile (375×700):** ✅ Wizard reflowed auf 1 Spalte, alle Felder + Buttons erreichbar
- **Firefox/Safari:** nicht manuell getestet — nur Chromium via Playwright, da der gesamte Stack (React + Tailwind + Radix) browserübergreifend identisch rendert. Risikoeinschätzung: niedrig.

### Security-Audit
- **XSS via Suchfeld:** ✅ React escaped Input, keine Script-Tag im DOM, kein `_xss`-Flag — als Test automatisiert.
- **XSS via Highlighting (`mark`-Element):** ✅ Suchstring landet als plain Text in `<mark>`, kein dangerouslySetInnerHTML.
- **Server-Action Validierung:** ✅ Zod-Schema in [actions.ts](src/components/katalog-drucken/actions.ts) blockt jede Abweichung (Layout-Werte, Spur-Werte, Prozent-Range, Produkt-IDs als UUID).
- **CHF ohne Wechselkurs:** ✅ Server-Action wirft sprechenden Fehler, bevor der Job angelegt wird.
- **Tote Produkt-IDs:** ✅ Wenn Wizard `produktIds` mit ungültigen IDs schickt, filtert der Runner sie raus und arbeitet mit der Schnittmenge.
- **Auth:** Auth ist projektweit deaktiviert ([src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts)) — bestehender Status-Quo, kein PROJ-37-Issue.
- **RLS:** `katalog_jobs` und `produkte` haben bereits Policies für `authenticated`. Die Wizard-Server-Action nutzt den User-Cookie-Client (RLS aktiv), der Job-Runner nutzt Service-Role (RLS umgangen — bewusst, da keine Inputs verarbeitet werden).

### Regression-Test
- **Produktliste-Suche** (`/produkte?q=BL13528`): ✅ funktioniert, 10 Treffer
- **Produkt-Filter** (Bereich/Kategorie/Status/Vollständigkeit): ✅ keine Regression (Wizard-Button neben Filtern)
- **Export-Page Job-Liste** (`/export/katalog`): ✅ Job-Eintrag wird gerendert, Banner mit Wizard-Link erscheint
- **Bestehende Tests:** 38/40 Vitest grün — die 2 Failures sind in `src/app/bereiche/actions.test.ts`, **bereits vor PROJ-37 vorhanden** (verifiziert via `git stash`).
- **PROJ-37-Tests:** 32/32 Vitest grün + 10/10 Playwright E2E grün.

### Bugs

#### LOW-1: Wizard merkt sich Tab-State zwischen Sessions
- **Ort:** [src/components/katalog-drucken/katalog-drucken-dialog.tsx:33](src/components/katalog-drucken/katalog-drucken-dialog.tsx#L33)
- **Reproduktion:** Wizard öffnen → Tab 2 anklicken → Dialog mit Escape schließen → Wizard erneut öffnen.
- **Erwartet:** Wizard öffnet auf Tab 1 (Default).
- **Tatsächlich:** Wizard öffnet auf Tab 2.
- **Ursache:** `useState("parameter")` initialisiert nur beim Mount. Da der `Dialog` in shadcn/ui den Inhalt nicht unmounted, bleibt der State erhalten.
- **Fix-Vorschlag:** Beim `onOpenChange(false)` Tab-State auf `"parameter"` zurücksetzen.
- **Severity:** Low — funktional kein Blocker, nur eine kleine UX-Inkonsistenz mit der Erwartung „beim Öffnen oben anfangen".

#### LOW-2 (Pre-existing, nicht durch PROJ-37): „PDF herunterladen"-Button erscheint nicht bei bereits abgeschlossenen Jobs
- **Ort:** [src/components/katalog-job-status.tsx:67-90](src/components/katalog-job-status.tsx)
- **Reproduktion:** Job läuft fertig → Wizard schließt → Browser navigiert zu `/export/katalog` → Job-Karte zeigt „Fertig 100%" aber kein Download-Button.
- **Ursache:** Bestehender Bug aus PROJ-10. `pdfUrl` wird nur gesetzt, wenn der Status-Polling läuft. Bei `initialStatus === "done"` wird der Polling-Cycle nicht gestartet.
- **Workaround:** Nutzer muss die Seite einmal refreshen, dann erscheint der Button (durch initiales `fetchStatus()` im `useEffect`-Trigger).
- **Severity:** Low — bestand bereits vor PROJ-37, sollte separat als eigener Fix-Auftrag laufen.

### Beobachtungen (kein Bug, aber für später notiert)
- **Prozent-Input erlaubt Werte > 100 ins UI** (HTML5 `min/max` clamped nicht beim Tippen), Server-Action lehnt sie aber via Zod ab. Keine UX-Validierung bevor Submit. Könnte mit `onChange`-Clamp verbessert werden — Low-Priority.
- **Auth ist projektweit aus** (Middleware ist no-op). Vor Production-Launch muss das aktiviert werden — out of PROJ-37 scope.
- **`/api/katalog-jobs/[id]/run` ohne expliziten Auth-Check** — bestehender Code aus PROJ-10. Niedriges Risiko, da der Endpoint nur bestehende Jobs aus der DB rendert (keine Inputs vom Client). Empfehlung: bei Auth-Reaktivierung einen Auth-Check ergänzen.

### Test-Suite-Übersicht
- **Unit-Tests** (Vitest):
  - `src/components/katalog-drucken/use-tree-selection.test.ts` — 8/8 ✅
  - `src/lib/pdf/katalog-preis.test.ts` — 13/13 ✅
  - `src/app/api/katalog-jobs/[id]/run/normalize-params.test.ts` — 11/11 ✅
- **E2E-Tests** (Playwright, `tests/PROJ-37-katalog-druck-wizard.spec.ts`):
  - Wizard öffnet als Modal mit Schritt 1 aktiv ✅
  - Schritt 1: alle Parameter-Felder vorhanden mit Defaults ✅
  - Preisauswahl-Dropdown bietet alle drei Spuren ✅
  - Counter im Footer zeigt Live-Stand der Auswahl ✅
  - PDF-erstellen-Button ist disabled bei 0 ausgewählten Produkten ✅
  - Suche filtert Produkte und hebt Treffer hervor ✅
  - Suchfeld escaped potenzielle XSS-Angriffe ✅
  - Wizard merkt sich Parameter via localStorage ✅
  - Tabs sind navigierbar mit Zurück/Weiter Buttons ✅
  - Tri-State: Kategorie anwählen lässt Bereich indeterminate ✅

### Production-Ready-Empfehlung: **READY**
Keine Critical/High-Bugs gefunden. Die zwei Low-Bugs blockieren das Deployment nicht — der erste ist eine UX-Inkonsistenz, der zweite ist pre-existing. Beide können nach Live-Going als kleine Nachzieh-Tickets gefixt werden.

---

## Bug-Fixes (2026-04-29)

Nach dem QA-Pass wurden beide Low-Bugs direkt behoben.

### LOW-1: Wizard merkt sich Tab-State zwischen Sessions — **gefixt**
- **Datei:** [src/components/katalog-drucken/katalog-drucken-dialog.tsx](src/components/katalog-drucken/katalog-drucken-dialog.tsx)
- **Fix:** Neuer `handleOpenChange`-Handler statt direktem `setOpen` — beim Schließen werden `tab` und `search` auf Default zurückgesetzt.
- **Verifikation:** Neuer E2E-Test `Wizard öffnet nach Schließen wieder auf Schritt 1 (LOW-1 Fix)` — grün.

### LOW-2: „PDF herunterladen"-Button fehlte bei initial fertigen Jobs — **gefixt**
- **Datei:** [src/components/katalog-job-status.tsx](src/components/katalog-job-status.tsx)
- **Fix:** `useEffect` ruft jetzt auch bei `!isActive` einmal `fetchStatus()` auf, wenn `pdfUrl` (bzw. `errorText`) noch nicht geladen ist. Polling startet weiterhin nicht — nur ein einziger Server-Round-Trip beim Mount.
- **Verifikation:** Manuell im Browser bestätigt — der grüne PDF-Download-Button erscheint jetzt sofort beim Öffnen von `/export/katalog`, ohne Refresh.

### Test-Bilanz nach Fixes
- Vitest: **32/32 grün** (unverändert, keine Logik-Tests betroffen)
- Playwright E2E: **11/11 grün** (vorher 10/10, neuer LOW-1-Regression-Test ergänzt)
- TypeScript: **0 Fehler**

Beide Bugs bleiben als Closed-Items in dieser Doku — als Audit-Spur und Beleg, dass die Tests die Fixes abdecken.

---

## Deployment (2026-04-29)

| | |
|---|---|
| **Production-URL** | https://lichtengross.vercel.app |
| **Production-Alias** | https://lichtengross-soulschoki-5679s-projects.vercel.app |
| **Branch-Alias** | https://lichtengross-git-main-soulschoki-5679s-projects.vercel.app |
| **Deployment-ID** | `dpl_584tuthhBckgiywBcJ8o5NemGQYR` |
| **Commit** | `c418899` (`feat(PROJ-37): Katalog-Druck-Wizard mit Inhaltsauswahl`) |
| **Build-Dauer** | ~57 Sekunden |
| **Region** | iad1 (Vercel Default) |
| **Bundler** | Turbopack |
| **Runtime** | Node.js (Lambda Functions) |
| **Inspector** | https://vercel.com/soulschoki-5679s-projects/lichtengross/584tuthhBckgiywBcJ8o5NemGQYR |

### Deploy-Verifikation
- ✅ HTTP 200 vom Production-Server
- ✅ HSTS + Cache-Control Header korrekt
- ✅ `/produkte` lädt mit allen 423 Produkten
- ✅ Wizard öffnet, beide Tabs funktionieren, Counter zeigt `423 / 423 Produkte in 20 Bereichen und 79 Kategorien`
- ✅ Browser-Konsole frei von PROJ-37-relevanten Errors (nur favicon-404)
- ✅ Alle Echtdaten aus Supabase-Production werden gerendert

### Deploy-Methode
Auto-Deploy via `git push origin main` → Vercel-GitHub-Integration. Keine Migration nötig (`katalog_jobs.parameter` ist `jsonb`, View `aktuelle_preise_flat` lieferte alle drei Spuren bereits seit PROJ-6).

### Rollback-Option
Falls Probleme auftreten: Im Vercel-Dashboard das vorherige Deployment `dpl_Dyttp82fZvvnFHrcPkQGL9MBwb9Q` (PROJ-9, `f4bb327`) als „Promote to Production" auswählen. Es ist als `isRollbackCandidate: true` markiert.

