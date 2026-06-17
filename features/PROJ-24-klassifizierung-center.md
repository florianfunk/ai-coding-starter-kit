# PROJ-24: Klassifizierung-Center (eigener Menüpunkt, Statistik, Auto-Continue, Manuell-First)

## Status: Deployed
**Created:** 2026-06-17
**Last Updated:** 2026-06-17
**Priorität:** P1

## Beschreibung
Die autonome Klassifizierung war bisher als Panel unten auf der Buchungen-Seite
versteckt — ohne Überblick, ob alle Buchungen verarbeitet sind. PROJ-24 macht
daraus einen **eigenen Menüpunkt „Klassifizierung"** mit Status-Statistik
(verarbeitet/offen/zur Prüfung je Jahr + gesamt, Aufschlüsselung nach Quelle),
**Auto-Continue** (zeitbegrenzte Läufe werden automatisch fortgesetzt, bis nichts
mehr offen ist) und einer **Genauigkeits-Verbesserung**: die Vorjahres-Übernahme
priorisiert die **manuell bestätigten** Vorjahres-Kategorien als Wahrheit
(Manuell-First).

Datengrundlage (Stand 2026-06-17): 2025 hat 4.025 Buchungen, davon 3.894 offen;
2026 ist fertig (1.041 manuell bestätigt). 70 % der offenen 2025-Buchungen haben
einen Empfänger aus 2026; mit Manuell-First sind die Hand-Entscheidungen zu 96 %
eindeutig.

## User Stories
- Als Inhaber möchte ich einen eigenen Menüpunkt „Klassifizierung" mit einer klaren Statistik, damit ich auf einen Blick sehe, wie viele Buchungen schon verarbeitet sind und wie viele noch offen.
- Als Inhaber möchte ich die Klassifizierung mit einem Klick starten und sie automatisch durchlaufen lassen (über mehrere zeitbegrenzte Batches), ohne mehrfach klicken zu müssen.
- Als Inhaber möchte ich, dass sich die automatische Kategorisierung an meinen händisch bestätigten Vorjahres-Buchungen orientiert (die haben Vorrang vor auto-verbuchten).

## Acceptance Criteria

### Menüpunkt + Statistik
- [ ] Neuer Sidebar-Eintrag „Klassifizierung" im Bereich „Bücher"; eigene Seite `/klassifizierung`
- [ ] Status-Überblick je Jahr **und** gesamt: total, **verarbeitet** (= nicht offen), offen, zur Prüfung, auto-verbucht, manuell bestätigt — mit Fortschrittsbalken „X von Y verarbeitet"
- [ ] Aufschlüsselung nach Quelle: Per Regel · Aus Vorjahr · Per KI · Manuell (Zahlen)
- [ ] Link zur Prüfliste; klarer „alles verarbeitet"-Zustand, wenn offen = 0
- [ ] Panel verschwindet vom Ende der Buchungen-Seite (kein Doppelort)

### Lauf-Steuerung + Auto-Continue
- [ ] „Klassifizierung starten" + Re-Klassifizierung-Schalter (wie bisher)
- [ ] Auto-Continue: ist ein Lauf zeitbegrenzt beendet (`zeitlimit_erreicht` + `verbleibend>0`), wird automatisch der nächste Batch gestartet, bis offen=0 oder ein Batch 0 verarbeitet (Schutz) oder Fehler
- [ ] Laufende Gesamt-Statistik über die Batches sichtbar; Stopp-Möglichkeit
- [ ] Nutzt den bestehenden Timeout-/Zombie-Schutz aus PROJ-5-Fix

### Genauigkeit (Manuell-First)
- [ ] Vorjahres-Übernahme: existiert für einen Empfänger ≥1 **manuell bestätigte** Vorjahres-Buchung mit Kategorie, ist deren Kategorisierung die Wahrheit (auch wenn auto-verbuchte abweichen) — sofern die manuellen untereinander homogen sind
- [ ] Sind die manuellen widersprüchlich (mehrere Kategorien), → kein Auto-Übernehmen (normaler Prozess)
- [ ] Ohne manuelle Buchung gilt die bisherige Regel (homogene auto-verbuchte, ≥2)

## Edge Cases
- Keine Buchungen / leeres Jahr → Statistik zeigt 0/0, „nichts zu tun"
- Auto-Continue: Batch verarbeitet 0 (z. B. alles manuell geschützt) → Stopp, keine Endlosschleife
- Re-Klassifizierung an + Auto-Continue → läuft über alle nicht-manuellen, ebenfalls batchweise
- Manuell widersprüchlich (Nutzer hat denselben Empfänger bewusst verschieden kategorisiert) → bleibt beim LLM/Prüfprozess

## Technical Requirements
- Statistik als reine, getestete Aggregationsfunktion (status×quelle×jahr) über minimal geladene Spalten (`status, quelle, buchung_datum`), owner-scoped, voll paginiert
- Manuell-First-Logik rein + getestet in `vorjahres-uebernahme.ts`
- Keine DB-Migration

## Dependencies
- Requires: PROJ-5 (Pipeline + Timeout-/Zombie-Schutz), PROJ-23 (Vorjahres-Übernahme — wird auf Manuell-First erweitert), PROJ-22 (Jahreskontext)
- Verschiebt: Klassifizierungs-Panel von `/buchungen` nach `/klassifizierung`

## Tech Design (im Brainstorming festgelegt)
- **Manuell-First:** `baueVorjahrUebernahmeMap` gruppiert je Empfänger in manuell/auto; Basis = manuell (falls vorhanden, ≥1 reicht) sonst auto (≥2). Homogenität (1 kat + 1 klass) auf der Basis. Manuell schlägt abweichende auto.
- **Statistik:** `baueKlassifizierungStatistik(rows)` → `{ jahre: JahrStat[]; gesamt: JahrStat }`. Server-Komponente lädt + aggregiert, `router.refresh()` nach Läufen aktualisiert.
- **Auto-Continue:** Client-Schleife in `KlassifizierungCenter`: solange `zeitlimit_erreicht && verbleibend>0 && letzterBatch>0` → erneut POST. Gesamt-Zähler + Stopp-Button.
- **Seite:** `/klassifizierung` (Server) → `KlassifizierungCenter` (Client, Stats-Props + Lauf-Controls).

## QA Test Results
**Datum:** 2026-06-17 · keine Critical/High. tsc ✓ · lint 0 Errors ✓ · 694 Tests grün (6 neu: 3 Manuell-First + 3 Statistik) ✓ · Build ✓.

## Deployment
- **Production:** https://steueragent.vercel.app — deployed 2026-06-17, Commit `364151b`, readyState READY.
- Smoke: `/klassifizierung` und `/buchungen` → 307 → /login (Auth greift). Keine DB-Migration.
