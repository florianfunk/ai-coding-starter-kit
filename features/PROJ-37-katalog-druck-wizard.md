# PROJ-37: Katalog-Druck-Wizard mit Inhaltsauswahl

## Status: Planned
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
