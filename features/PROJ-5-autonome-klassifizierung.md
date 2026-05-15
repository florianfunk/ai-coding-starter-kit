# PROJ-5: Autonome Klassifizierung — Steuerrelevanz & privat/geschäftlich

## Status: Planned
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
