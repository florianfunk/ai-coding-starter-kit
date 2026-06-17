# PROJ-23: Vorjahres-Übernahme (deterministischer Vor-Pass der Klassifizierung)

## Status: Deployed
**Created:** 2026-06-16
**Last Updated:** 2026-06-16
**Priorität:** P2

## Beschreibung
Beim Abarbeiten eines neuen Jahres (z. B. 2025-Import nach fertigem 2026) sollen
wiederkehrende Empfänger nicht erneut vom LLM bewertet werden, wenn ihre
Kategorisierung aus dem Vorjahr bereits eindeutig feststeht. PROJ-23 fügt der
Klassifizierungs-Pipeline einen **deterministischen Vor-Pass** hinzu: greift
keine gelernte Regel, wird geprüft, ob derselbe (normalisierte) Empfänger in
bereits **final verbuchten** Buchungen **eindeutig** kategorisiert wurde — wenn
ja, wird diese Kategorisierung **1:1 übernommen** und das LLM gar nicht erst
aufgerufen. Der Rest läuft unverändert durch den normalen LLM-Prozess.

Vorteile: schneller, günstiger (kein LLM-Call), reproduzierbar, und reduziert
die Prüfliste für offensichtliche Wiederholer.

## Bedeutung „eindeutig" (festgelegt)
Ein Empfänger wird automatisch übernommen, wenn **alle** seine final verbuchten
Buchungen mit Kategorie:
- dieselbe `kategorie_id` (genau eine, nicht null) UND
- dieselbe `klassifikation` haben (homogen) UND
- die Outlier-Sicherung erfüllen: **mindestens eine ist `manuell_bestaetigt`
  ODER es gibt mindestens zwei** solche Buchungen.

So wird kein einzelner (evtl. LLM-falscher) auto-verbuchter Ausreißer sofort
zur Regel; eine vom Nutzer bestätigte Buchung zählt aber sofort. Gemischte
Kategorien → kein Eintrag → normaler LLM-Prozess.

## User Stories
- Als Inhaber möchte ich, dass Buchungen eines Empfängers, den ich letztes Jahr eindeutig kategorisiert habe, dieses Jahr automatisch dieselbe Kategorie bekommen, ohne dass das LLM erneut entscheidet.
- Als Inhaber möchte ich nach dem Klassifizierungslauf sehen, wie viele Buchungen aus dem Vorjahr übernommen wurden.
- Als Inhaber möchte ich, dass uneindeutige Fälle weiterhin normal (LLM + Prüfliste) laufen, damit nichts falsch automatisch verbucht wird.

## Acceptance Criteria
- [x] Neuer Pass läuft in der Pipeline **nach** den gelernten Regeln und **vor** dem LLM (Regeln behalten Vorrang)
- [x] Übernahme nur bei „eindeutig" gemäß obiger Definition (homogen + Outlier-Sicherung)
- [x] Bei Treffer: `kategorie_id`, `klassifikation`, `steuerrelevant`, `ust_satz` werden 1:1 übernommen, Status `auto_verbucht`, Quelle `vorjahr`, `konfidenz=1`, Audit-Eintrag mit `vorjahr_uebernahme: true`
- [x] Beträge über dem Ausreißer-Limit (`betrag_limit`) gehen trotz Treffer `zur_pruefung` (wie bei Regeln)
- [x] Manuell bestätigte Buchungen werden nie überschrieben (Pipeline-Schutz bleibt)
- [x] Kein Treffer → unveränderter normaler LLM-Pfad (Cache/Historie/LLM)
- [x] Referenzmenge = alle final verbuchten Buchungen (`auto_verbucht`/`manuell_bestaetigt`) des Owners, **nicht** jahres-gefiltert — die neuen (offenen) Buchungen erben so die Vorjahres-Entscheidung
- [x] Ergebnis-Panel zeigt „Aus Vorjahr übernommen: X"; Abschluss-Toast nennt die Zahl
- [x] Kein neuer Button — der Pass ist Teil von „Klassifizierung starten"

## Edge Cases
- Empfänger mit gemischten Kategorien im Vorjahr → kein Eintrag → LLM-Prozess
- Genau 1 auto-verbuchte Vorjahres-Buchung (kein manuell) → keine Übernahme (Outlier-Schutz)
- Empfänger ohne normalisierten Wert (Altdaten) → kein Schlüssel → übersprungen
- Re-Klassifizierung (`nur_offen=false`): Map wird aus dem aktuellen final-Stand gebaut; bereits auto-verbuchte Buchungen können ihre eigene Kategorie bestätigen (kein Schaden)
- Große Datenmengen: final-Buchungen werden voll paginiert geladen (`ladeAlle`), Map einmal pro Job gebaut (kein N+1)

## Technical Requirements
- Reine Logik (Map-Bau + Eindeutigkeit) testbar isoliert in `src/lib/classifier/vorjahres-uebernahme.ts`
- Pipeline-Integration reuse von `baue()` für konsistente Audit-Form
- Keine DB-Migration (nutzt vorhandene `buchung`-Spalten)

## Dependencies
- Requires: PROJ-5 (Klassifizierungs-Pipeline) — Integrationspunkt
- Verwandt: PROJ-15 (Empfänger-Cache/Historie) — gleicher Empfänger-Schlüssel; der neue Pass ist die **deterministische** Kurzschluss-Variante vor dem LLM
- Verwandt: PROJ-7 (Prüfliste) — Ausreißer-Beträge landen weiterhin dort

## Implementierungsnotizen
- **Reines Modul** `src/lib/classifier/vorjahres-uebernahme.ts`:
  `baueVorjahrUebernahmeMap(zeilen)` → `Map<empfaenger_norm, VorjahrKategorisierung>`,
  `vorjahrSchluessel()` (trim+lowercase). 9 Unit-Tests.
- **Pipeline** (`pipeline.ts`): `quelle`-Union um `"vorjahr"` erweitert;
  neue reine Funktion `entscheideVorjahresUebernahme()` (reuse `baue`,
  Ausreißer-Guard); Lookup direkt nach dem Regel-Check in `klassifiziereBuchung`
  über `ctx.vorjahr_map`. 6 Integrationstests (übernimmt ohne LLM-Call;
  Regel-Vorrang; kein Treffer → LLM; Ausreißer → Prüfung; manuell wirft).
- **Route** (`api/klassifizierung`): lädt final verbuchte Buchungen
  (`status in (auto_verbucht, manuell_bestaetigt)`, voll paginiert), baut die
  Map einmal, reicht sie via `ctx.vorjahr_map` durch; neuer Zähler
  `via_vorjahr` in Ergebnis + Response.
- **UI** (`klassifizierung-panel.tsx`): Badge „Aus Vorjahr übernommen: X"
  (nur wenn > 0) + Toast-Hinweis.
- **Verifikation:** tsc fehlerfrei, lint 0 Errors, `npm test` 688 grün, Build ok.

## QA Test Results
**Datum:** 2026-06-16 · **Ergebnis:** Production-ready (keine Critical/High)
- Automatisiert: tsc ✓ · lint 0 Errors ✓ · 688 Tests grün (15 neue: 9 Modul + 6 Pipeline) ✓ · Build ✓
- Determinismus + Regel-Vorrang + Ausreißer-Guard + „kein LLM-Call bei Treffer" durch Tests abgesichert.

## Deployment
- **Production:** https://steueragent.vercel.app — deployed 2026-06-16
- Keine DB-Migration nötig (nur Code).

### Nachtrag 2026-06-17 — kritischer Fix (Constraint)
- **Bug:** Der Pass setzt `quelle='vorjahr'`, aber `buchung_quelle_check` erlaubte
  nur `('regel','ki','manuell')`. Folge: JEDER Vorjahres-Treffer schlug beim
  UPDATE fehl → Buchung blieb `offen`, `via_vorjahr` blieb 0 (in Prod 882
  Buchungen hingen, da exakt die vorjahr-eligiblen). tsc/Unit-Tests trafen die
  DB-Constraint nicht.
- **Fix:** Migration `0013_buchung_quelle_vorjahr.sql` erweitert die Constraint
  um `'vorjahr'` (lokal + Prod via MCP angewendet). Zusätzlich loggt die Route
  `updErr.message` jetzt serverseitig (keine stillen Schreibfehler mehr).
- **Audit:** Vollständiger Abgleich aller CHECK-Constraints gegen die vom Code
  geschriebenen Enum-Werte — `quelle='vorjahr'` war der EINZIGE Mismatch; alle
  anderen constrained Spalten sind durch Zod/Union-Typen gedeckt.
