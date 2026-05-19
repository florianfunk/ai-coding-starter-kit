# PROJ-5: Autonome Klassifizierung — Steuerrelevanz & privat/geschäftlich

## Status: In Progress
**Created:** 2026-05-15
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-2 (EÜR-Kontenrahmen) — Zielsystematik für die Einordnung
- Requires: PROJ-3 (Paperless-Integration) — OCR-Text der Belege als Kontext
- Requires: PROJ-4 (Kontoauszug-Import) — die zu klassifizierenden Buchungen

## Beschreibung
Herzstück des Agenten. Für jede importierte Kontobuchung entscheidet der Agent **voll autonom** anhand des Buchungstexts (Verwendungszweck/Empfänger) und ggf. passender Paperless-Belege: ist die Buchung steuerrelevant? privat oder geschäftlich? welche EÜR-Kategorie + USt-Satz? Jede Entscheidung erhält eine Begründung und einen Konfidenzwert. Hohe Konfidenz → automatisch gebucht. Niedrige Konfidenz → Prüfliste (PROJ-7).

## User Stories
- Als Inhaber möchte ich, dass der Agent jede Buchung selbständig klassifiziert (privat/geschäftlich, steuerrelevant ja/nein, EÜR-Kategorie), damit ich nicht manuell kontieren muss.
- Als Inhaber möchte ich, dass private Ausgaben erkannt und als Privatentnahme ausgelagert werden, damit die betriebliche Sphäre sauber bleibt.
- Als Inhaber möchte ich zu jeder Entscheidung eine kurze Begründung und einen Konfidenzwert sehen, damit ich die Logik nachvollziehen kann.
- Als Inhaber möchte ich, dass nur unsichere Buchungen in eine Prüfliste wandern und der Rest automatisch verbucht wird, damit ich mich nur um Ausnahmen kümmere.
- Als Inhaber möchte ich, dass gespeicherte Lernregeln (PROJ-7) Vorrang vor der KI-Einschätzung haben, damit wiederkehrende Buchungen konsistent laufen.

## Acceptance Criteria
- [ ] Jede importierte Buchung erhält: Klassifikation (privat | geschäftlich | unklar), Steuerrelevanz (ja/nein), vorgeschlagene EÜR-Kategorie + USt-Satz, Begründungstext, Konfidenzscore (0–1)
- [ ] Buchungen oberhalb eines konfigurierbaren Konfidenz-Schwellwerts werden automatisch gebucht (Status „auto-verbucht")
- [ ] Buchungen unterhalb des Schwellwerts ODER ohne passende Kategorie ODER mit Regelkonflikt werden Status „zur Prüfung" (Input für PROJ-7)
- [ ] Bestehende Lernregeln (PROJ-7) werden vor der KI-Klassifizierung angewandt und überschreiben die KI-Einschätzung deterministisch
- [ ] Als privat klassifizierte Buchungen werden konsistent als Privatentnahme markiert und aus betrieblichen Auswertungen ausgeschlossen
- [ ] Klassifizierung nutzt Buchungstext, Betrag, Empfänger und – falls vorhanden – den gematchten Paperless-Beleg als Kontext
- [ ] Klassifizierung ist wiederholbar/re-triggerbar (z.B. nach Kontenrahmen- oder Regeländerung), ohne bereits manuell bestätigte Buchungen zu überschreiben
- [ ] Jede Entscheidung ist auditierbar (Eingangsdaten, angewandte Regel/KI, Ergebnis, Zeitpunkt)

## Edge Cases
- Was passiert bei gemischt privat/geschäftlichen Buchungen (z.B. Tankstelle, Telefon)? (Kennzeichnung „Aufteilung nötig" → Prüfliste)
- Wie verhält sich der Agent bei völlig unbekanntem Buchungstext ohne Beleg? (niedrige Konfidenz → Prüfliste, nicht raten)
- Was passiert bei widersprüchlichen Lernregeln? (deterministische Priorisierung, Konflikt sichtbar)
- Wie wird mit Umbuchungen zwischen eigenen Konten umgegangen (kein Ertrag/Aufwand)? (Kategorie „Geldtransit/neutral")
- Was passiert bei sehr großen Beträgen oder Ausreißern? (immer in Prüfliste trotz hoher Textähnlichkeit – konfigurierbar)
- Wie wird verhindert, dass eine Re-Klassifizierung manuell korrigierte Buchungen überschreibt?
- Was passiert, wenn der KI-Dienst nicht verfügbar ist? (Fallback: regelbasiert + Rest in Prüfliste, kein Datenverlust)

## Technical Requirements
- Nachvollziehbarkeit: Begründung + Konfidenz + Audit-Trail je Entscheidung (keine Blackbox)
- Determinismus: gespeicherte Regeln haben Vorrang vor KI
- Robustheit: definierter Fallback bei KI-Ausfall
- Datenschutz: nur notwendige Buchungs-/Belegdaten an das LLM; DSGVO-konformer Verarbeitungsweg (Details in /architecture)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext. Dies ist das Herzstück.

### Backend-Bedarf: Ja (serverseitige Pipeline + LLM-Proxy)
KI darf nie im Browser laufen; Pipeline braucht DB-Zugriff und LLM-Anbindung.

### Pipeline (3 Stufen, serverseitig)
```
Buchung ──► [1] Regel-Engine (PROJ-7-Lernregeln, deterministisch, Vorrang)
              │ Treffer → Ergebnis fix, Status auto-verbucht
              ▼ kein Treffer
            [2] LLM-Klassifizierer (AI SDK, serverseitig)
              Input: NUR Zweck, Betrag, Empfänger, ggf. Beleg-Stichworte
              Output: Kategorie, privat/geschäftlich, Steuerrelevanz, Begründung
              ▼
            [3] Konfidenz-Bewertung
              ≥ Schwellwert → auto-verbucht | sonst → Prüfliste (PROJ-7)
```

### Komponentenstruktur
```
Buchungen (/buchungen)
+-- Buchungs-Tabelle mit Klassifikation, Konfidenz, Status-Badge
+-- "Klassifizierung starten"-Aktion (Job mit Fortschritt)
+-- Detail-Sheet: Begründung + Audit-Trail
```

### Datenmodell (Klartext)
Erweiterung der **Buchung**: Klassifikation (privat/geschäftlich/unklar), Steuerrelevanz, vorgeschlagene Kategorie + USt-Satz, Begründungstext, Konfidenz (0–1), Quelle (Regel-ID oder KI), Status (offen/auto-verbucht/zur-Prüfung/manuell-bestätigt). **Audit-Eintrag** je Entscheidung.

### Tech-Entscheidungen (Begründung)
- **Regeln vor KI (Determinismus):** wiederkehrende Buchungen konsistent, KI nur bei Unbekanntem.
- **Vercel AI SDK über AI Gateway:** anbieterunabhängig, austauschbares Modell, EU/Zero-Retention konfigurierbar; nur minimierte Daten an das LLM (DSGVO).
- **Konfigurierbarer Konfidenz-Schwellwert + Ausreißer-Regel:** große Beträge stets in Prüfliste.
- **Schutz manueller Bestätigungen:** Re-Klassifizierung überspringt „manuell-bestätigt".
- **Fallback ohne KI:** bei LLM-Ausfall nur Regeln, Rest in Prüfliste, kein Raten.

### Abhängigkeiten (Pakete)
- `ai` (Vercel AI SDK) — serverseitiger, anbieterunabhängiger LLM-Zugang.

### Edge-Case-Behandlung
Gemischt privat/geschäftlich → „Aufteilung nötig" → Prüfliste; unbekannt ohne Beleg → niedrige Konfidenz; Regelkonflikt deterministisch priorisiert + sichtbar; Geldtransit → Kategorie „neutral"; LLM-Ausfall → Regel-Fallback.

## Implementierungsnotizen

### Erstellte Dateien
- `src/lib/classifier/rules.ts` — Stufe 1: reine, deterministische Regel-Engine.
  Case-insensitive Substring-Match (kein Regex-Eval → ReDoS-/Injection-sicher),
  UND-Verknüpfung aller gesetzten Teilbedingungen, konto_id-/Betragsbereichs-
  Prüfung. Höchste `prioritaet` gewinnt; stabile Sekundärsortierung nach `id`
  (Determinismus); Konflikt-Flag bei widersprechenden Regeln gleicher Priorität.
  Regel ohne Bedingung ist KEIN Catch-All.
- `src/lib/classifier/llm.ts` — Stufe 2: serverseitiger LLM-Aufruf via
  `ai`-SDK `generateObject` mit Zod-Ausgabeschema. Datensparsam: nur
  Verwendungszweck, Betrag, Empfänger, optionale Beleg-Stichworte (KEINE
  Steuernummer/Kontodaten/OCR-Volltext). Modell aus `STEUERAGENT_LLM_MODEL`
  (Default `anthropic/claude-haiku-4-5`), Gateway-Key aus
  `AI_GATEWAY_API_KEY`. Halluzinierte Kategorie-IDs werden verworfen.
  Definierter `LlmKlassifiziererError` bei Ausfall/ungültiger Antwort —
  kein Raten.
- `src/lib/classifier/pipeline.ts` — Stufe 3 + Orchestrierung.
  `entscheideBuchung` ist eine REINE Funktion (Regeln + LLM-Ergebnis +
  Config → Entscheidung). Regel-Vorrang; Konfidenz-Schwellwert (Default
  0.85) + Kategorie-Pflicht für Auto-Verbuchung; Ausreißer-Limit (Default
  2000 €, |Betrag|) erzwingt immer Prüfliste; `manuell_bestaetigt` wird
  nie überschrieben (`ManuellBestaetigtError`); jede Entscheidung erzeugt
  ein Audit-Detail. `klassifiziereBuchung` ruft das LLM nur, wenn keine
  Regel greift; LLM-Ausfall → `zur_pruefung` (kein Datenverlust).
- `src/lib/validation/klassifizierung.ts` — Zod-Schema für den Trigger
  (nur_offen, konfidenz_schwellwert, betrag_limit) mit Defaults.
- `src/app/api/klassifizierung/route.ts` — POST startet die Pipeline
  (job_lauf art='klassifizierung', synchron MVP) über `status='offen'`
  bzw. bei `nur_offen=false` alle außer `manuell_bestaetigt`
  (Re-Klassifizierung). GET liefert letzten Job-Status. getApiUser→401,
  owner-scoped + RLS. Doppelstart-Sperre, Trefferzähler je Regel erhöht,
  Teil-Ergebnis bei Fehler erhalten.
- `src/app/api/audit/route.ts` — read-only Audit-Trail einer Buchung
  für das Detail-Sheet (getApiUser→401, owner-scoped, Zod-validiert).
- `src/components/buchungen/klassifizierung-panel.tsx` — „Klassifizierung
  starten“-Aktion + Re-Klassifizierungs-Schalter, Fortschritts-Polling
  (alle 2 s), Ergebnis-Badges, Fehlerliste.
- `src/components/buchungen/buchung-detail-sheet.tsx` — Detail-Sheet mit
  Begründung, Konfidenz, Quelle, Prüfgrund und auf Anfrage geladenem
  Audit-Trail.
- `src/lib/classifier/rules.test.ts`, `src/lib/classifier/pipeline.test.ts`
  — Tests (LLM-Modul gemockt, kein Netzwerkaufruf).

### Geänderte Dateien
- `src/components/buchungen/buchungen-ansicht.tsx` — Konfidenz-Spalte,
  klickbare Zeilen → Detail-Sheet. Bestehende Filter-/Leerzustands-Logik
  unverändert erhalten.
- `src/app/(app)/buchungen/page.tsx` — lädt Kategorien + letzten
  Klassifizierungs-Job, rendert das Panel, reicht Kategorien an die Ansicht.

### Abweichungen / Entscheidungen
- Pipeline in reine `entscheideBuchung` (testbar) + `klassifiziereBuchung`
  (Orchestrierung mit injizierbarer LLM-Funktion) getrennt — ermöglicht
  netzwerkfreie Tests ohne Modul-Mocking-Tricks im Pipeline-Test.
- Zusätzliche, im Auftrag nicht explizit genannte Datei
  `src/app/api/audit/route.ts` war nötig, damit das Detail-Sheet den
  Audit-Trail anzeigen kann (Acceptance Criterion „auditierbar“).
- DB-Update enthält zusätzlich `.neq('status','manuell_bestaetigt')` als
  zweite Sicherung gegen Überschreiben.

### Verifikation
- `npx tsc --noEmit`: fehlerfrei.
- `npx eslint src/lib/classifier src/app/api/klassifizierung src/components/buchungen`
  (+ audit/validation): fehlerfrei (1 react-hooks-Fehler im Detail-Sheet
  behoben — kein synchrones setState im Effekt mehr).
- Tests: 31 neue Tests grün (rules + pipeline); Gesamtsuite 146/146 grün.

### Nachtrag 2026-05-20 — Kategorien-Feinheit + Web-Recherche-Fallback
**Anlass:** Klassifizierung schlug fehl, weil das LLM keine privaten Kategorien hatte (nur „Privatentnahme") und unbekannte Empfänger nicht selbst nachschlagen konnte.

- **Standard-Kontenrahmen erweitert** (`src/app/api/kontenrahmen/seed/route.ts`):
  - +8 Geschäfts-Kategorien: Bewirtung/Spesen (70%), Fortbildung, Werbung/Marketing, Rechts-/Beratungskosten, Porto, Software/IT/Cloud, Reparatur/Wartung, GWG bis 800€, Bankgebühren, Beiträge/Mitgliedschaften.
  - +18 Privat-Kategorien: Lebensmittel, Restaurant, Kleidung, Wohnen/Miete, Strom/Gas/Wasser, Krankenversicherung (Sonderausgabe), sonstige Versicherungen, Altersvorsorge (Sonderausgabe), Telekommunikation privat, Mobilität privat, Gesundheit/Apotheke, Freizeit/Streaming, Bildung/Kita, Geschenke, Spenden (Sonderausgabe), Familie/Unterhalt, Sparen, Sonstige.
  - Seed-Endpoint ist idempotent — Owner mit altem Kontenrahmen klicken „Standard-Kontenrahmen anlegen" und bekommen nur die neuen Einträge, ohne Konflikt mit bestehenden Buchungs-Zuordnungen.
- **System-Prompt geschärft** (`src/lib/classifier/llm.ts`):
  - Klare Arbeitsanweisung: zuerst Empfänger analysieren (stärkstes Signal), dann Verwendungszweck.
  - Explizite Vorgaben für Privat-Kategorien (spezifisch statt nur „Privatentnahme") und konkrete Geschäfts-Kategorien (Cloud → „Software/IT/Cloud").
  - Konfidenz-Regeln: privat eindeutig → ≥0.9; gemischt nutzbar (Tankstelle/Restaurant ohne Kontext) → „unklar" + ≤0.5; unbekannte Empfänger → nicht raten.
- **Firecrawl-Web-Recherche-Fallback** (`src/lib/classifier/web-research.ts`, neu):
  - Wird nur bei unsicheren LLM-Ergebnissen aktiv (Konfidenz < Schwellwert, „unklar" oder keine Kategorie).
  - An Firecrawl geht NUR der Empfängername (öffentliche Firmendaten), KEIN Verwendungszweck/Betrag.
  - Eigener 8s-Timeout, alle Fehler stillschweigend → `null` (Recherche ist optional, kein Datenverlust).
  - Ohne `FIRECRAWL_API_KEY` → automatisch deaktiviert.
  - Pipeline ruft das LLM nach Recherche erneut mit Web-Kontext; Ergebnis wird nur übernommen, wenn es echt besser ist (`istBesser`-Heuristik: Kategorie ergänzt, „unklar" → eindeutig, oder Konfidenz +0.05).
  - Audit-Trail vermerkt `web_recherche: { genutzt, query }`.
- **Konfiguration:** `PipelineConfig.web_recherche_aktiv` (Default true). `FIRECRAWL_API_KEY` in `.env.local.example` dokumentiert. Paket `@mendable/firecrawl-js@4.24.2` als Dependency.
- **Tests:** 4 neue Pipeline-Tests (Web-Retry verbessert, Web-Retry behält Original bei marginalen Gewinnen, Recherche abschaltbar, kein-Key-Fallback). Gesamtsuite 335/335 grün, TS+ESLint sauber.

**Nutzung:**
1. Im Adminbereich „Standard-Kontenrahmen anlegen" klicken (legt nur die neuen Kategorien an).
2. Optional `FIRECRAWL_API_KEY` in `.env.local` setzen (sonst läuft nur LLM ohne Web-Recherche).
3. Auf der Buchungs-Seite „Klassifizierung starten" — bisher unsichere Buchungen mit erkennbarem Empfänger werden jetzt mit Web-Kontext nachklassifiziert.

### Offene Punkte
- Massen-Klassifizierung läuft synchron im Request (MVP). Bei sehr großen
  Datenmengen ggf. echter Hintergrund-Worker (außerhalb dieses Specs).
- Beleg-Stichworte werden vom LLM-Modul unterstützt, aber von der Route
  noch nicht befüllt (Beleg↔Buchung-Matching ist PROJ-6).

## QA Test Results

**Stand:** Approved (2026-05-15) — automatisierte QA grün.

- `npx tsc --noEmit`: fehlerfrei (projektweit)
- `npx eslint src`: 0 Fehler (1 unkritische Warnung in vendor-Datei `use-toast.ts`)
- Unit-Tests: gesamte Suite 307/307 grün
- `next build`: erfolgreich, alle 40 Routen kompilieren
- Acceptance Criteria gegen Implementierung geprüft (siehe Implementierungsnotizen)

Offen für manuelle/E2E-QA mit echten Daten: visuelle Prüfung, End-to-End-Flows mit echter Paperless-Instanz und realen Kontoauszügen.

## Deployment
_To be added by /deploy_
