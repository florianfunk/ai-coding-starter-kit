# PROJ-29: Command-Palette (Cmd+K — globale Sprung-Navigation)

## Status: Deployed
**Created:** 2026-06-24
**Last Updated:** 2026-06-24
**Priorität:** P1

> **QA 2026-06-24 (Quirin, QA Frontend): APPROVED — deploybar.** AC1–AC7 PASS.
> Sidebar-Regression sauber (21 Nav-Einträge + Farben identisch, nur Datenquelle
> getauscht), Jahr-Setter `setJahr` korrekt, keine Shortcut-Konflikte (PROJ-26-
> Triage ignoriert Modifier, shadcn-Sidebar nutzt ⌘B).
> **Behoben nach QA (W3):** Hotkey ignoriert jetzt ⌘K, während ein Eingabefeld
> fokussiert ist und die Palette zu ist (Spec AC1) — via offenRef im Effekt
> gespiegelt (React-Hooks-konform). W1/W2 (Stil) bewusst belassen, konsistent
> mit Sidebar. Kein Schema/Migration. Verifikation: 872 Tests grün, tsc 0,
> build ok, lint 0 Fehler.
## Beschreibung
Ein globales Overlay (⌘K / Strg+K), das jede Seite und jede Schnell-Aktion in
~1 Sekunde per Tastatur erreichbar macht — ohne Maus, ohne Sidebar-Suche.
Adressiert direkt den im Interview genannten Pain Point „Suchen & Navigieren".
Nutzt die bereits installierte shadcn `command`-Komponente (CommandDialog) und
dieselbe Navigationsstruktur wie die Sidebar (eine gemeinsame Quelle, kein
Duplikat).

## Kontext / Herkunft
Mira-Empfehlung (Tier 1, höchster Hebel) + Nutzer-Interview 2026-06-23 (Pain
Point „Suchen & Navigieren"). shadcn command-UI ist installiert und wird bereits
in abgleich/manuelle-zuordnung + kategorie-combobox genutzt (Vorbild).

## Scope (v1, festgelegt)
- **Seiten-Navigation:** alle Menüpunkte aus den 4 Sektionen (Heute/Bücher/
  Steuer/Setup), gruppiert + per Fuzzy-Suche filterbar, Enter navigiert.
- **Schnell-Aktionen:** Klassifizierung starten (→ /klassifizierung),
  Import öffnen (→ /einstellungen/konten/import), Paperless-Sync (→
  /einstellungen/paperless), Prüfliste öffnen, Export öffnen — als eigene Gruppe.
- **Jahr wechseln:** die verfügbaren Jahre aus dem JahrProvider als Aktion
  (setzt das aktive Jahr) — nutzt den vorhandenen Jahr-Context.
- **Trigger:** ⌘K (Mac) / Strg+K (Win/Linux) global; zusätzlich ein dezenter
  Button/Hinweis in der Topbar.

## Out of Scope (später)
- Buchungs-/Empfänger-Volltextsuche (bräuchte eigenen Such-API-Endpoint +
  Debouncing) → Phase 2 der Palette.
- Konfigurierbare/umbelegbare Shortcuts.

## User Stories
- Als Inhaber möchte ich mit ⌘K sofort zu jeder Seite springen, ohne die Sidebar
  zu durchsuchen.
- Als Inhaber möchte ich häufige Aktionen (Import, Klassifizierung, Export) direkt
  aus der Palette starten.
- Als Inhaber möchte ich das aktive Jahr per Tastatur wechseln können.

## Acceptance Criteria
- [x] **AC1 — Globaler Trigger:** ⌘K / Strg+K öffnet die Palette von jeder
  App-Seite; Esc schließt. Funktioniert nicht, während ein Eingabefeld/anderer
  Dialog den Fokus hat (kein Konflikt mit bestehenden Shortcuts wie Prüflisten-
  Triage). Doppeltes ⌘K togglet/lässt sauber.
- [x] **AC2 — Seiten-Navigation:** Alle Sidebar-Ziele erscheinen, gruppiert nach
  den 4 Sektionen, per Fuzzy-Suche filterbar; Enter/Klick navigiert (router.push)
  und schließt die Palette.
- [x] **AC3 — Gemeinsame Nav-Quelle:** Die Navigationsliste wird aus EINER
  geteilten Datei bezogen, die auch die Sidebar nutzt (kein hartkodiertes
  Duplikat). Sidebar-Verhalten unverändert.
- [x] **AC4 — Schnell-Aktionen:** Eine Aktions-Gruppe (Klassifizierung starten,
  Import, Paperless-Sync, Prüfliste, Export) navigiert zum jeweiligen Ziel.
- [x] **AC5 — Jahr wechseln:** Verfügbare Jahre aus dem JahrProvider als Aktionen;
  Auswahl setzt das aktive Jahr (vorhandener Context-Setter), Palette schließt.
- [x] **AC6 — Topbar-Hinweis:** Ein dezenter „⌘K"-Button/Indikator in der Topbar
  öffnet die Palette ebenfalls (Entdeckbarkeit; auf Mobil als Such-Icon).
- [x] **AC7 — A11y & Keine Regression:** Dialog ist fokus-gefangen, Liste per
  Pfeiltasten navigierbar (shadcn command liefert das), Esc schließt. Bestehende
  Seiten/Sidebar/Shortcuts unverändert. tsc 0, build ok, Tests grün.

## Implementation Notes
**Umgesetzt 2026-06-24 (Frontend/Felix).**

### Neue/geänderte Dateien
- **`src/lib/navigation.ts`** (neu): Gemeinsame Nav-Quelle. Exportiert
  `NAV_SEKTIONEN` ({titel, eintraege:[{href,label}]}) + `SECTION_COLORS` +
  Typen `NavEintrag`/`NavSektion`. Aus app-sidebar.tsx extrahiert (AC3).
- **`src/components/app-sidebar.tsx`**: Hartkodierte Arrays + `SECTION_COLORS`
  entfernt, jetzt Import aus `@/lib/navigation`. Optik/Verhalten identisch
  (`istAktiv`-Logik, Rendering unverändert) → keine Sidebar-Regression (AC7).
- **`src/components/command-palette.tsx`** (neu, Client): Rendert selbst BEIDES
  — den dezenten Topbar-Trigger (Such-Icon + „⌘K"-kbd, AC6) und den
  `CommandDialog`. Das hält das Layout server-seitig (nur `<CommandPalette/>`).
- **`src/app/(app)/layout.tsx`**: `<CommandPalette/>` in der Topbar vor dem
  `<JahresWaehler/>` eingehängt — innerhalb des `<JahrProvider>`, damit der
  Jahr-Context verfügbar ist (AC5).

### Technische Details
- **Hotkey (AC1):** `window`-`keydown`-Listener im `useEffect`,
  `(e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k'` → `preventDefault` +
  Toggle. Cleanup entfernt den Listener (`removeEventListener`). `preventDefault`
  nur beim eigenen Hotkey → keine bestehenden Shortcuts brechen. Esc schließt
  über den shadcn-`CommandDialog` (Radix-Dialog).
- **Jahr-Context-Setter heißt `setJahr`** (nicht `setAktivesJahr`), aktives Jahr
  ist `aktivesJahr: number | null`. Aktuelles Jahr in der Liste mit „Aktiv"-Badge
  (Check-Icon) markiert. Jahr-Gruppe nur sichtbar, wenn `verfuegbareJahre` nicht
  leer.
- **Schnell-Aktionen (AC4):** reine Navigation (v1) — Klassifizierung→
  /klassifizierung, Import→/einstellungen/konten/import, Paperless-Sync→
  /einstellungen/paperless, Prüfliste→/pruefliste, Export→/export.
- **Fuzzy-Suche:** cmdk-eigene Filterung; `value` je Item = Label + href bzw.
  Präfix („Aktion …", „Jahr …") für zuverlässiges Matching.

### Verifikation
- `npx tsc --noEmit` → 0 Fehler.
- `npm run build` → erfolgreich (alle Routen kompiliert).
