# PROJ-28: Few-Shot aus Korrekturen (lernende LLM-Klassifizierung)

## Status: Approved
**Created:** 2026-06-23
**Last Updated:** 2026-06-23
**Priorität:** P1

> **QA 2026-06-23 (Quentin, QA Backend): DEPLOYBAR — APPROVED.** AC1–AC7 PASS,
> 872 Tests grün, tsc 0, build ok. AC5-Datensicherheit verifiziert (Familien-
> ausschluss, keine Beträge, owner-scoped, kein Crash bei leerem Profil).
> **Nebenbefund + Fix:** `mein_profil` wurde im Klassifizierungs-Job bisher NICHT
> an die Pipeline durchgereicht (PROJ-16-Profilkontext lief im Job-Lauf ins Leere)
> — jetzt korrekt durchgereicht, aktiviert beabsichtigtes PROJ-16-Verhalten
> (Familien-Web-Ausschluss/Profil-Hinweise), keine Test-Regression.
> **Behoben nach QA:** AC6-Audit schreibt `few_shot:{anzahl}` jetzt nur noch bei
> erfolgreichem LLM-Call (`llm !== null`) — Audit bleibt ehrlich.
> Kein Schema-Eingriff → kein Migrations-Bedarf für dieses Feature.

## Beschreibung
Auto-Erkennung Teil 2 (Brunos Mittelhebel V5), OHNE Schema-Änderung und ohne
externe Datenabhängigkeit. Der Agent lernt aus den **bisherigen manuellen
Korrekturen/Bestätigungen** des Inhabers: Beim Klassifizierungs-Lauf werden die
häufigsten „Empfänger/Zweck → gewählte Kategorie+Klassifikation"-Beispiele
EINMAL pro Job geladen und dem LLM als **Few-Shot-Block** in den Prompt gegeben.
So überträgt das LLM gelernte Muster auch auf Empfänger, für die noch keine
exakte Lernregel und keine eindeutige Vorjahres-/Cache-Übernahme existiert.

Ergänzt die bestehende Kaskade (Regeln → Vorjahr → Cache-Default → LLM): Wo die
deterministischen Pässe NICHT greifen (neuer/uneindeutiger Empfänger), bekommt
das LLM jetzt Kontext aus echten Nutzer-Entscheidungen statt „kalt" zu raten.
Adressiert direkt den Nutzerwunsch „maximale Automatik".

## Kontext / Herkunft
Entscheidung 2026-06-23: PROJ-28 ursprünglich MCC/Gegen-IBAN — von Emil als
nicht datentauglich erkannt (echte Import-Formate liefern weder MCC noch
Gegen-IBAN). Stattdessen Few-Shot gewählt (datensicher, schema-frei). Siehe
Memory `tool-analyse-2026-06` (V5).

## Datenquelle (festgelegt)
Few-Shot-Beispiele stammen aus den **eigenen final bestätigten Buchungen** des
Owners — Priorität auf `status='manuell_bestaetigt'` (echte Nutzer-Korrekturen),
ergänzt um eindeutige `auto_verbucht`-Muster, wenn zu wenige manuelle vorliegen.
Pro normalisiertem Empfänger genau EIN repräsentatives Beispiel (häufigste
Kategorie+Klassifikation), damit der Prompt kompakt bleibt. Keine Beträge nötig
(datensparsam). Limit N (z. B. 15–20 Beispiele), nach Häufigkeit sortiert.

## User Stories
- Als Inhaber möchte ich, dass der Agent aus meinen bisherigen Korrekturen lernt,
  sodass ähnliche neue Buchungen häufiger automatisch richtig klassifiziert werden
  — auch ohne dass ich für jeden Empfänger eine Regel anlege.
- Als Inhaber möchte ich, dass dieser Lerneffekt reproduzierbar und nachvollziehbar
  ist (Audit zeigt, dass Few-Shot-Kontext genutzt wurde).

## Acceptance Criteria
- [x] **AC1 — Few-Shot-Loader (rein, testbar):** Neue reine Funktion baut aus
  Buchungs-Rohzeilen (empfaenger_normalisiert, empfaenger, kategorie_id,
  klassifikation, status) eine kompakte Beispiel-Liste: pro norm. Empfänger ein
  Eintrag mit der häufigsten (kategorie_id, klassifikation); `manuell_bestaetigt`
  zählt stärker als `auto_verbucht`; nach Häufigkeit sortiert; auf N begrenzt.
  Unit-getestet (Mehrheitswahl, manuell-Vorrang, Limit, leere Eingabe).
- [x] **AC2 — Job-scoped Laden:** Der Klassifizierungs-Job lädt die Beispiele
  EINMAL (analog `vorjahr_map`/`mein_profil`) und reicht sie über `PipelineKontext`
  durch. Kein Per-Buchung-Query.
- [x] **AC3 — LLM-Prompt-Block:** `LlmEingabe` bekommt ein optionales Feld
  `few_shot_beispiele`; der Prompt-Builder rendert daraus einen klar abgegrenzten
  „Gelernte Beispiele aus früheren Entscheidungen"-Block. Der Block ist KONTEXT,
  übersteuert die LLM-Entscheidung nicht hart und ersetzt keine Regel.
- [x] **AC4 — Kategorie-Auflösung:** Im Prompt werden Kategorien als lesbare
  Bezeichnungen (nicht nur UUIDs) gezeigt, passend zur vorhandenen Kategorienliste,
  damit der Few-Shot-Block für das LLM nutzbar ist.
- [x] **AC5 — Datensparsam & sicher:** Nur owner-scoped Daten; keine Beträge,
  keine PII über das Nötige hinaus; Familienmitglieder-Empfänger werden NICHT als
  Few-Shot-Beispiel exportiert (analog Web-Lookup-Ausschluss, falls Profil geladen).
- [x] **AC6 — Audit:** Wenn der Few-Shot-Block genutzt wurde, hält das Audit
  fest (z. B. `few_shot: { anzahl }`), analog zu web_recherche/historie.
- [x] **AC7 — Keine Regression:** Bestehende Kaskade (Regel/Vorjahr/Cache/LLM/
  Konsistenz-Pass) unverändert; Regeln/Vorjahr/Cache behalten Vorrang (Few-Shot ist
  nur LLM-Kontext). Alle Tests grün, build ok.

## Out of Scope
- Kein neues DB-Schema, keine neue Tabelle (Few-Shot wird zur Laufzeit aus
  vorhandenen Buchungen abgeleitet).
- Kein Fine-Tuning/Embedding-Retrieval — bewusst einfacher, deterministischer
  Häufigkeits-Ansatz (RAG/Embeddings später möglich).
- MCC/Gegen-IBAN (verworfen, Datenlage).

## Implementation Notes
**Backend (Bruno, 2026-06-23), test-getrieben:**

- **AC1** — Neuer reiner Loader `src/lib/classifier/few-shot.ts`:
  `baueFewShotBeispiele(rows, opts)`. Gruppiert nach nicht-leerem
  `empfaenger_normalisiert` (lower/trim), zaehlt (kategorie_id, klassifikation)-
  Kombis gewichtet (`manuell_bestaetigt`=2, sonst=1), waehlt pro Empfaenger die
  staerkste Kombi (nur mit gesetzter kategorie_id + klassifikation). Sortierung
  Gesamt-Gewicht DESC, Tie-Break stabil nach `empfaenger_norm`. Limit Default 20.
  Familienausschluss via `opts.familie_norm` (Set oder Array). 13 Unit-Tests in
  `few-shot.test.ts` (Mehrheitswahl, Manuell-Doppelgewicht, Limit/Sortierung,
  Familienausschluss, leere/ungueltige Eingabe, fehlende kategorie_id/
  klassifikation).
- **AC2** — `src/app/api/klassifizierung/route.ts`: `empfaenger` zur
  bestehenden `finalData`-Query (die schon fuer `vorjahrMap` geladen wird)
  ergaenzt; `fewShot` EINMAL pro Job NACH dem Profil-Load gebaut
  (`familie_norm` aus `meinProfil.familie.name_normalisiert`) und ueber den
  PipelineKontext (`few_shot`) durchgereicht. Kein Per-Buchung-Query.
  Nebenbefund: `mein_profil` wurde in DIESER Route bisher NICHT an die Pipeline
  durchgereicht (nur das `mein_profil_geladen`-Flag gesetzt) — jetzt mitgegeben
  (AC5-relevant fuer Familien-Web-Lookup-Ausschluss; PROJ-16-konform).
- **AC3/AC4** — `LlmEingabe.few_shot_beispiele` + `baueFewShotBlock` in
  `llm.ts`: rendert "Gelernte Beispiele aus früheren Entscheidungen des
  Inhabers (als Orientierung — keine harte Vorgabe)"; Kategorien als
  BEZEICHNUNG (via `kategorien`-Liste aufgeloest), Beispiele mit unbekannter
  kategorie_id werden uebersprungen. `pipeline.ts` reicht `ctx.few_shot`
  durch.
- **AC5** — Owner-scoped (RLS + `.eq(owner_id)`), keine Betraege, nur
  Empfaengername. Familienmitglieder im Loader ausgeschlossen.
- **AC6** — `pipeline.ts` schreibt `audit.details.few_shot = { anzahl }`, wenn
  Beispiele mit aufloesbarer Kategorie im Prompt waren (gleiche Filterlogik wie
  der Block-Builder).
- **AC7** — Few-Shot ist NUR LLM-Kontext: greift erst im LLM-Pfad NACH
  Regeln/Vorjahr/Cache. Diese Paesse unveraendert. Kein Schema-Eingriff.

**Tests/Build:** `npx vitest run src/lib/classifier/` 350 gruen (inkl. 13 neue
Loader-Tests + 3 LLM-Block-Tests + 2 Pipeline-Audit-Tests). Volle Suite
`npx vitest run` 872 gruen. `npx tsc --noEmit` 0 Fehler.

**Geaenderte/neue Dateien:**
- NEU `src/lib/classifier/few-shot.ts`, `src/lib/classifier/few-shot.test.ts`
- `src/lib/classifier/llm.ts` (+ Tests), `src/lib/classifier/pipeline.ts`
  (+ Tests), `src/app/api/klassifizierung/route.ts`
