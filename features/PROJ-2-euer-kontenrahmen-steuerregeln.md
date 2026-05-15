# PROJ-2: Konfigurierbarer EÜR-Kontenrahmen & Steuerregeln

## Status: In Progress
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-1 (Auth & Steuerprofil) — für USt-Status und geschützten Zugriff

## Beschreibung
Definiert die EÜR-Kategorien (Einnahmen/Ausgaben-Konten, anlehnbar an SKR03/04) mit zugeordneten Umsatzsteuersätzen. Diese Struktur ist die Zielsystematik, in die der Agent (PROJ-5) jede Buchung einordnet, und Basis für USt-VA (PROJ-8) und EÜR (PROJ-9).

## User Stories
- Als Inhaber möchte ich einen vordefinierten EÜR-Kontenrahmen erhalten, damit ich nicht bei null anfange.
- Als Inhaber möchte ich Kategorien anpassen/ergänzen/deaktivieren, damit der Kontenrahmen zu meiner Firma passt.
- Als Inhaber möchte ich jeder Kategorie einen USt-Satz (19 %, 7 %, 0 %, nicht steuerbar) zuordnen, damit die Vorsteuer/Umsatzsteuer korrekt berechnet wird.
- Als Inhaber möchte ich Kategorien als „privat/nicht abzugsfähig" markieren können, damit private Posten sauber ausgelagert werden.
- Als Inhaber möchte ich jede Kategorie der korrekten EÜR-Zeile und ELSTER-USt-Kennzahl zuordnen, damit Auswertungen formgerecht sind.

## Acceptance Criteria
- [ ] Standard-Kontenrahmen wird beim ersten Aufruf angelegt (typische EÜR-Einnahme-/Ausgabekategorien für Einzelunternehmer/Freiberufler)
- [ ] Kategorien anlegen/bearbeiten/deaktivieren mit: Bezeichnung, Typ (Einnahme/Ausgabe/Privat/Durchlaufend), USt-Satz, EÜR-Zeilen-Zuordnung, ELSTER-USt-Kennzahl
- [ ] Validierung: USt-Satz muss zu Typ passen (z.B. „Privat" → kein Vorsteuerabzug); eindeutige Kategoriebezeichnungen
- [ ] Deaktivierte Kategorien bleiben für bestehende Buchungen historisch erhalten, sind aber nicht mehr neu zuweisbar
- [ ] Kontenrahmen ist versioniert/nachvollziehbar (wer/wann geändert), ohne bestehende Buchungen zu verfälschen
- [ ] Andere Features lesen ausschließlich diesen Kontenrahmen als Zielsystematik

## Edge Cases
- Was passiert, wenn eine Kategorie gelöscht/deaktiviert wird, der bereits Buchungen zugeordnet sind? (Schutz / nur Deaktivierung)
- Wie wird mit gemischt genutzten Kosten umgegangen (teils privat, teils geschäftlich)? (Aufteilungs-/Privatanteil-Kennzeichen)
- Was passiert bei widersprüchlicher USt-Satz-/Typ-Kombination?
- Wie wird ein USt-Satz-Wechsel zum Jahreswechsel behandelt (Gültig-ab)?
- Was passiert, wenn kein passender Kontenrahmen existiert, bevor PROJ-5 klassifiziert? (Block/Hinweis)

## Technical Requirements
- Datenintegrität: referenzielle Sicherheit zwischen Kategorien und späteren Buchungen
- Security: Authentifizierung Pflicht
- Erweiterbarkeit: Kontenrahmen muss neue Kategorien ohne Datenmigration aufnehmen können

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (Supabase)
Kontenrahmen ist gemeinsame Stammdatenbasis vieler Module → relationale, referenziell gesicherte Speicherung.

### Komponentenstruktur
```
Einstellungen › Kontenrahmen (/einstellungen/kontenrahmen)
+-- Kategorie-Tabelle (shadcn table): Bezeichnung, Typ, USt-Satz, EÜR-Zeile, ELSTER-Kennzahl, aktiv
+-- Kategorie-Dialog (shadcn dialog + form): anlegen/bearbeiten
+-- "Standard-Kontenrahmen anlegen"-Aktion (Erstbefüllung)
+-- Aktiv/Inaktiv-Schalter je Zeile (shadcn switch)
```

### Datenmodell (Klartext)
**Kontenrahmen-Kategorie**: Bezeichnung (eindeutig), Typ (Einnahme/Ausgabe/Privat/Neutral), USt-Satz (19/7/0/keiner), EÜR-Zeilen-Zuordnung, ELSTER-USt-Kennzahl, aktiv-Flag, Gültig-ab. Deaktivierte Kategorien bleiben für historische Buchungen referenzierbar (kein Hard-Delete).

### Tech-Entscheidungen (Begründung)
- **Seed eines Standard-Kontenrahmens** (typische EÜR-Konten Einzelunternehmer, an SKR03/04 angelehnt): Nutzer startet nicht bei null.
- **Soft-Deaktivierung statt Löschen:** schützt referenzielle Integrität zu bestehenden Buchungen.
- **USt-Satz/Typ-Konsistenzregel** serverseitig validiert (z.B. „Privat" → kein Vorsteuerabzug).
- **Einzige Zielsystematik:** PROJ-5/8/9 lesen ausschließlich diese Tabelle.

### Abhängigkeiten (Pakete)
Keine neuen (Supabase, Zod, shadcn vorhanden).

### Edge-Case-Behandlung
Löschsperre bei verknüpften Buchungen (nur Deaktivierung); Aufteilungs-Flag für gemischte Kosten; USt-Satz-Wechsel über „gültig ab"; Block abhängiger Module, wenn kein gültiger Kontenrahmen existiert.

## Implementierungsnotizen

**Implementiert am:** 2026-05-15

### Erstellte Dateien
- `src/lib/validation/kontenrahmen.ts` — Zod-Schema (client+server). Konsistenzregel via `.refine()`: typ privat/neutral → `ust_satz` muss null sein; typ einnahme/ausgabe → `ust_satz` ∈ {0,7,19}. Leere optionale Strings werden zu `null` normalisiert; Datum als `JJJJ-MM-TT`.
- `src/lib/validation/kontenrahmen.test.ts` — 13 Vitest-Tests (Pflichtfelder + Konsistenzregel, alle grün).
- `src/app/api/kontenrahmen/route.ts` — GET (Liste, owner-scoped, sortiert, `.limit(500)`), POST (anlegen, Zod vor DB, 409 bei Unique-Verletzung).
- `src/app/api/kontenrahmen/[id]/route.ts` — PUT (bearbeiten) und DELETE (**nur Soft-Deaktivierung** `aktiv=false`, kein Hard-Delete; UUID-Validierung; 404/409-Handling).
- `src/app/api/kontenrahmen/seed/route.ts` — POST: 21 Standard-Kategorien (Einnahmen 19/7/0%, Ausgaben Wareneinkauf/Fremdleistungen/Bürobedarf/Telefon/KFZ/Reise/Miete/Versicherungen/AfA/sonstige/Vorsteuer, Privat: Privatentnahme/-einlage, Neutral: Geldtransit/USt-Zahllast). **Idempotent** über Bezeichnungs-Abgleich. EÜR-Zeilen (Anlage EÜR) und ELSTER-USt-Kennzahlen als pflegbare Stammdaten.
- `src/components/kontenrahmen/kategorie-dialog.tsx` — shadcn Dialog + Form (react-hook-form + zodResolver-kompatible Client-Validierung). USt-Satz-Select wird bei Typ privat/neutral automatisch gesperrt und auf „kein Satz" gezwungen.
- `src/components/kontenrahmen/kontenrahmen-tabelle.tsx` — shadcn Table (Bezeichnung/Typ/USt-Satz/EÜR-Zeile/ELSTER-Kennzahl/aktiv-Switch/Aktion), Seed-Button, Lade-/Leer-/Fehlerzustände, AlertDialog-Bestätigung beim Deaktivieren.
- `src/app/(app)/einstellungen/kontenrahmen/page.tsx` — Server Component: lädt Kategorien owner-scoped (`.limit(500)`), Fehler-Alert, rendert Client-Tabelle.

### Abweichungen / Hinweise
- Auth in API-Routen über `getApiUser()` → 401; Pages über `requireUser()`. Owner-Scoping zusätzlich zur RLS explizit per `.eq("owner_id", user.id)`.
- DB-Tabelle `kategorie` (Migration 0001) unverändert übernommen; keine Schema-Änderung.
- Hard-Delete bewusst NICHT implementiert (MVP: ausschließlich Deaktivierung) — schützt referenzielle Integrität zu späteren Buchungen (PROJ-4/5).
- `npx tsc --noEmit`: fehlerfrei. Unit-Tests: 13/13 grün. `next lint` ist in Next 16 / ESLint 9 projektweit defekt (vorbestehendes, nicht durch dieses Feature verursachtes Problem) — nicht behoben, da out of scope.
- Offene Punkte für spätere Features: Aufteilungs-/Privatanteil-Flag für gemischte Kosten und „gültig ab"-getriebene USt-Satz-Historisierung sind im Schema/Formular vorbereitet (`gueltig_ab`), aber Auswertungslogik liegt bei PROJ-8/9.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
