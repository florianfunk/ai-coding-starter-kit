# PROJ-26: Prüflisten-Speedrun (Keyboard-Triage, Inline-Begründung, Sofort-Lernregel)

## Status: Deployed
**Created:** 2026-06-23
**Last Updated:** 2026-06-23
**Priorität:** P1

> **QA 2026-06-23 (Quirin, QA Frontend): Deploybar JA.** AC1–AC8 PASS
> (AC3/AC8 ursprünglich PARTIAL → behoben). CSRF code-verifiziert kein Blocker
> (Origin/Sec-Fetch-Site-basiert, akzeptiere() nutzt denselben Header-Stil wie
> bestehende POSTs). Keine Regression bei Eingabefeldern (eingabeAktiv() fängt
> Input/Textarea/Select/combobox), Listener-Cleanup vorhanden.
> **Behoben nach QA:** Bug #1 (Hilfe-Overlay blockierte Listen-Shortcuts nicht)
> + Bug #2 (Doppel-Submit per Enter während Pending) — beide via `hilfeOffen` +
> `akzeptierePending` in `blockiert`.
> **Offen (Polish, nächster Cycle):** #3 roher button statt shadcn Button im
> Lernregel-Banner, #4 aria-controls am Warum-Toggle, #5 flex-wrap der
> Zeilen-Aktionsleiste auf 375px.
>
> Verifikation: `npm test` 832 grün, `tsc --noEmit` 0 Fehler, `npm run build` ok.

## Beschreibung
Phase 2 der Komfort-Roadmap. Der Nutzer arbeitet monatlich/geballt und nennt das
**Durchgehen der Prüfliste** als größten Pain Point. Im Interview wurden alle vier
Speedrun-Bausteine gewählt. Dieses Feature baut die drei mit bestem Aufwand/Nutzen
voll aus; die erweiterte Cluster-Heuristik (Betrag/Zeit) ist bewusst Out of Scope,
weil die Empfänger-Gruppierung bereits existiert.

1. **Keyboard-Triage (Feature 1, NEU):** Die Prüfliste komplett per Tastatur
   durcharbeiten wie E-Mail-Triage: `j`/`k` = nächster/voriger Fall, `Enter`/`a` =
   Vorschlag akzeptieren (auto-verbuchen mit aktuellen Werten), `g`/`p`/`n` =
   geschäftlich/privat/neutral setzen, `e` = Entscheidungs-Dialog öffnen,
   `?` = Shortcut-Hilfe-Overlay. Aktive Zeile sichtbar hervorgehoben, Auto-Scroll.
2. **Inline-"Warum?"-Begründung (Feature 3):** Pro Fall aufklappbar (Collapsible)
   die Begründung der Klassifizierung: `begruendung`, `konfidenz` (Balken),
   `quelle`, `pruef_grund` (Klartext). Macht den autonomen Agenten nachvollziehbar
   → schnelleres Vertrauen/Ablehnen. Nutzt vorhandene Buchungsfelder, keine neue
   DB-Last.
3. **Sofort-Lernregel (Feature 4):** Bei einer Korrektur 1-Klick "Immer so für
   diesen Empfänger" — der Fall taucht nie wieder auf. Backend (Regel-Vorschlag,
   Anlage, gleichartige offene Fälle, Re-Klassifizierung) existiert bereits; dieses
   Feature vereinfacht die UX (Toggle prominenter/vorausgewählt) und macht den
   1-Klick-Pfad sichtbar.

## Kontext / Herkunft
Nutzer-Interview 2026-06-23 (Memory `nutzer-arbeitsweise-prioritaeten`): Pain Point
Prüfliste, will maximale Automatik. Inventur durch Emil bestätigt: Feature 4 fast
komplett vorhanden, Feature 3 nutzt existierende Felder, Feature 1 ist Neubau.

## User Stories
- Als Inhaber möchte ich die Prüfliste rein per Tastatur durchgehen, um 50
  unsichere Fälle in Minuten statt Klick-für-Klick zu erledigen.
- Als Inhaber möchte ich pro Fall sofort sehen, WARUM der Agent so entschieden hat
  (Konfidenz, Regel/KI/Quelle, Prüfgrund), ohne ein Detail-Sheet öffnen zu müssen.
- Als Inhaber möchte ich bei einer Korrektur mit einem Klick festlegen "immer so
  für diesen Empfänger", damit derselbe Empfänger nie wieder in der Prüfliste
  landet.

## Acceptance Criteria
- [x] **AC1 — Keyboard-Navigation:** `j`/`k` (oder ↓/↑) bewegen einen sichtbaren
  Fokus-Cursor durch die gefilterte Liste; aktive Zeile visuell hervorgehoben +
  in den Viewport gescrollt. Funktioniert nicht, während ein Textfeld/Dialog fokus hat.
- [x] **AC2 — Keyboard-Aktionen:** Auf dem fokussierten Fall: `Enter`/`a` =
  akzeptieren (mit aktuell vorgeschlagener klassifikation/kategorie/ust auto-verbuchen),
  `g`/`p`/`n` = Klassifikation setzen, `e` = Entscheidungs-Dialog. Nach einer Aktion
  rückt der Fokus automatisch zum nächsten Fall.
- [x] **AC3 — Hilfe-Overlay:** `?` öffnet ein Overlay mit allen Shortcuts; Esc schließt.
- [x] **AC4 — "Akzeptieren" nur bei vollständigem Vorschlag:** Akzeptieren ist nur
  möglich, wenn der Fall eine klassifikation + (sofern erforderlich) kategorie hat;
  sonst Hinweis-Toast + Dialog-Vorschlag. Kein unvollständiges Auto-Verbuchen.
- [x] **AC5 — Inline-Begründung:** Pro Zeile aufklappbar (Collapsible) mit
  `begruendung`, Konfidenz-Balken (Progress), Quelle-Label, Prüfgrund-Klartext.
  Aufklappen lädt keine zusätzlichen Daten (Felder sind in der Buchung vorhanden).
- [x] **AC6 — Sofort-Lernregel:** Im Entscheidungs-Dialog ist der "Als Lernregel
  speichern"-Pfad prominent/1-Klick erreichbar; Muster vorbefüllt (schlageRegelVor);
  nach Anlage Angebot, gleichartige offene Fälle mitzuerledigen (bestehender Flow).
- [x] **AC7 — Keine Regression:** Bestehende Prüflisten-Funktionen (Filter, Sortierung,
  Bulk-Auswahl, Mustergruppen, Merken, Einzel-/Bulk-Entscheidung) unverändert
  funktionsfähig. Alle Tests grün, build ok.
- [x] **AC8 — Accessibility:** Aktive Zeile mit aria-Markierung; Shortcuts stören
  keine native Bedienung (Eingabefelder, Dialoge). Keyboard-Hinweis sichtbar
  (z. B. dezenter Footer "? für Shortcuts").

## Out of Scope
- Erweiterte Cluster-Heuristik (Betrag ± %, Datum ± Tage) → spätere Phase 2b.
  Die bestehende Empfänger-Gruppierung (Mustergruppen-Pills) deckt "eine
  Entscheidung für alle desselben Empfängers" bereits ab.
- Konfigurierbare/umbelegbare Shortcuts → später.

## Implementation Notes
**Frontend umgesetzt (2026-06-23, Felix):**

- **Feature 1 — Keyboard-Triage** (AC1–AC4, AC8): neuer Hook
  `src/hooks/use-pruefliste-tastatur.ts`. Index-basierter Fokus-Cursor auf die
  `gefiltert`-Liste, `window`-Keydown-Listener. Shortcuts: `j`/`k` (+ ↓/↑)
  bewegen, `Enter`/`a` akzeptieren, `g`/`p`/`n` Klassifikation lokal setzen,
  `e` Dialog, `?` Hilfe-Overlay, `Esc` schließen/Fokus aufheben. Listener
  ignorieren Eingaben, wenn ein Input/Textarea/Select/combobox fokussiert ist
  (`eingabeAktiv()`), und pausieren bei offenem Dialog/Sheet/Overlay
  (`blockiert`). Auto-Scroll via `data-fokus-index`-Attribut +
  `scrollIntoView({block:'nearest'})`. Aktive Zeile: `ring-2 ring-inset
  ring-brand-violet` + `bg-tint-violet` + `aria-current`. Hilfe-Overlay =
  shadcn Dialog mit Shortcut-Tabelle. Dezenter Footer "Tastatur: j/k bewegen ·
  Enter akzeptiert · ? zeigt alle Shortcuts" (nur wenn `!istLeer`).
  `akzeptiere()` postet an `/api/pruefliste/entscheiden` mit den aktuell
  vorgeschlagenen Werten; nur bei vollständigem Vorschlag (Klassifikation
  gesetzt und – außer privat/neutral – Kategorie), sonst Toast + Einzel-Dialog.
- **Feature 3 — Inline-Begründung** (AC5): neue Komponente
  `src/components/pruefliste/pruefliste-begruendung.tsx`. Separater
  "Warum?"-Toggle in jeder Zeile (neben dem bestehenden Info-Icon, das das
  große Detail-Sheet behält). Zeigt `begruendung`, Konfidenz als
  shadcn-Progress + Prozent (null → "KI nicht verfügbar"), Quelle-Label
  (regel/ki/manuell/vorjahr/cache, tolerant über String-Lookup) und
  Prüfgründe als Badges. Kein zusätzlicher Fetch — nur vorhandene Felder.
- **Feature 4 — Sofort-Lernregel** (AC6): in `entscheidungs-dialog.tsx` ein
  prominenter "Immer so für diesen Empfänger"-Button vor dem bestehenden
  Lernregel-Switch, der den Switch aktiviert. Aktive Regel-Box hervorgehoben.
  API/Payload und der Nachregel-AlertDialog (gleichartige Fälle) unverändert.

**Geänderte/neue Dateien:**
- NEU `src/hooks/use-pruefliste-tastatur.ts`
- NEU `src/components/pruefliste/pruefliste-begruendung.tsx`
- `src/components/pruefliste/pruefliste-ansicht.tsx`
- `src/components/pruefliste/entscheidungs-dialog.tsx`

**Verifikation:** `npx tsc --noEmit` 0 Fehler, `npm run build` erfolgreich,
ESLint der geänderten Dateien sauber. Regression (AC7): Filter/Sortierung/
Suche/Bulk/Mustergruppen/Merken/Einzel-/Bulk-Entscheidung/Re-Klassifizierung
unverändert; Keyboard-Listener stören Eingabefelder nicht.
