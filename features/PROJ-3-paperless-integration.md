# PROJ-3: Paperless-Integration (Beleg- & OCR-Import)

## Status: In Progress
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-1 (Auth & Steuerprofil) — für geschützten Zugriff und verschlüsselte Token-Ablage

## Beschreibung
Verbindet STEUERAGENT mit der vorhandenen Paperless-ngx-Instanz und importiert alle Buchhaltungsbelege inkl. des bereits per Paperless-AI/OCR extrahierten Texts, Metadaten, Tags und Korrespondenten. Belege sind die Beleg-Seite für das spätere Matching (PROJ-6) und Datenbasis der Klassifizierung (PROJ-5).

## User Stories
- Als Inhaber möchte ich Paperless-URL und API-Token einmalig hinterlegen, damit der Agent auf alle Dokumente zugreift.
- Als Inhaber möchte ich, dass der Agent alle relevanten Belege automatisch importiert (inkl. OCR-Text, Datum, Korrespondent, Betrag soweit erkannt, Tags), damit ich nichts manuell hochladen muss.
- Als Inhaber möchte ich einen Sync auf Knopfdruck und/oder periodisch auslösen, damit neue Belege erfasst werden.
- Als Inhaber möchte ich sehen, welche Belege neu/aktualisiert/unverändert sind, damit der Import nachvollziehbar ist.
- Als Inhaber möchte ich Belege optional nach Zeitraum/Tag filtern, damit nur steuerrelevante Dokumente gezogen werden.

## Acceptance Criteria
- [ ] Paperless-Verbindung konfigurierbar: Basis-URL + API-Token; Token wird verschlüsselt gespeichert, nie im Klartext angezeigt/geloggt
- [ ] Verbindungstest verfügbar; klare Fehlermeldung bei ungültiger URL/Token/Erreichbarkeit
- [ ] Import zieht je Dokument: ID, Titel, Erstell-/Belegdatum, Korrespondent, Tags, Dokumenttyp, OCR-Volltext, erkannte Beträge (sofern Paperless-Custom-Fields vorhanden), Download-Link/Referenz
- [ ] Idempotenter Sync: bereits importierte Belege werden anhand stabiler Paperless-ID aktualisiert statt dupliziert
- [ ] Manueller Sync-Trigger und Sync-Status (Anzahl neu/aktualisiert/Fehler, Zeitstempel letzter Sync)
- [ ] Optionaler Filter nach Zeitraum/Tag/Korrespondent vor dem Import
- [ ] Fehler einzelner Dokumente brechen den Gesamt-Sync nicht ab; Fehlerliste wird ausgewiesen

## Edge Cases
- Was passiert, wenn die Paperless-Instanz nicht erreichbar ist oder mitten im Sync abbricht? (Resume/Teil-Sync, kein Datenverlust)
- Wie wird mit Belegen ohne erkennbares Datum/Betrag im OCR-Text umgegangen? (Markierung „unvollständig")
- Was passiert bei sehr vielen Dokumenten (Pagination/Rate-Limit der Paperless-API)?
- Wie werden in Paperless gelöschte Dokumente behandelt, die bereits importiert wurden? (Markierung „in Quelle entfernt")
- Was passiert, wenn der API-Token abgelaufen/zurückgezogen ist? (klare Re-Auth-Aufforderung)
- Wie werden Duplikate (gleicher Beleg mehrfach in Paperless) erkannt?

## Technical Requirements
- Security: API-Token verschlüsselt at rest, nicht in Logs; HTTPS zur Paperless-Instanz
- Robustheit: idempotenter, fortsetzbarer Sync; Pagination + Rate-Limit-Handling
- Performance: inkrementeller Sync (nur Änderungen seit letztem Lauf) wo möglich

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (Supabase + serverseitiger Paperless-Adapter)
API-Aufrufe an Paperless und Token-Handling müssen serverseitig laufen (Token nie im Browser).

### Komponentenstruktur
```
Einstellungen › Paperless (/einstellungen/paperless)
+-- Verbindungs-Formular (Basis-URL, API-Token) + "Verbindung testen"
+-- Sync-Trigger + Sync-Status (Fortschritt, neu/aktualisiert/Fehler, Zeitstempel)
+-- Optionaler Filter (Zeitraum/Tag/Korrespondent)

Belege (/belege)
+-- Beleg-Tabelle (Datum, Korrespondent, Betrag, Tags, Status)
+-- Detail-Sheet (OCR-Text, Paperless-Link)
```

### Datenmodell (Klartext)
**Beleg**: Paperless-ID (stabiler Schlüssel), Titel, Beleg-/Erstelldatum, Korrespondent, Tags, Dokumenttyp, erkannter Betrag, OCR-Volltext, Quell-Link, Status (importiert/unvollständig/in-Quelle-entfernt). **Job/Sync-Lauf**: Status, Zähler, Fehlerliste. Token verschlüsselt im Profil-Bereich.

### Tech-Entscheidungen (Begründung)
- **Serverseitiger Paperless-Adapter (`lib/paperless/`)** mit Pagination + Rate-Limit-Handling: robuster, fortsetzbarer Sync.
- **Idempotenz über Paperless-ID:** Re-Sync aktualisiert statt dupliziert.
- **Asynchroner Sync-Job mit Statusanzeige:** blockiert die UI nicht bei großen Mengen.
- **Token verschlüsselt at rest, nie geloggt/an Client:** DSGVO/Sicherheit.

### Abhängigkeiten (Pakete)
Keine neuen (Fetch-basierter Adapter, Supabase vorhanden).

### Edge-Case-Behandlung
Teil-Sync mit Resume bei Abbruch; „unvollständig"-Markierung ohne Datum/Betrag; Pagination/Rate-Limit; „in Quelle entfernt"-Status; klare Re-Auth-Aufforderung bei Token-Ablauf; Duplikaterkennung über Paperless-ID + Inhalts-Hash.

## Implementierungsnotizen

### Erstellte Dateien
- `src/lib/validation/paperless.ts` — Zod-Schemas: `paperlessVerbindungSchema` (base_url http(s)-validiert, trailing-slash-Normalisierung, optionaler Token), `paperlessSyncFilterSchema` (Zeitraum/Tag/Korrespondent, von≤bis-Regel).
- `src/lib/validation/paperless.test.ts` — 12 Vitest-Fälle (URL-/Protokoll-/Datums-Validierung, Normalisierung).
- `src/lib/paperless/client.ts` — serverseitiger REST-Adapter: `testConnection`, `fetchLookups` (Korrespondent/Dokumenttyp/Tag-Auflösung, paginiert), `iterateDocuments` (Async-Generator, fortsetzbar), `mapDocumentToBeleg`, reine Helfer (`inhaltHash` sha256, `parseBetragAusText`, `normalizeAmountString`, `betragAusCustomFields`, `toIsoDate`, `buildDocumentsUrl`). Timeout, Rate-Limit-Backoff (HTTP 429), klassifizierte `PaperlessError`.
- `src/lib/paperless/client.test.ts` — 23 Vitest-Fälle für die reinen Helfer/Mapping (kein Netzwerk).
- `src/app/api/paperless/route.ts` — GET (Status, Token nur als `token_gesetzt: boolean`), PUT (Upsert, Token via `encrypt()`, leerer Token = unverändert).
- `src/app/api/paperless/test/route.ts` — POST Verbindungstest (Body-Daten oder gespeicherte/entschlüsselte Verbindung).
- `src/app/api/paperless/sync/route.ts` — POST synchroner idempotenter Sync (Upsert auf `owner_id+paperless_id`, Inhalts-Hash-Diff überspringt Unverändertes, `unvollstaendig`-Markierung, „in Quelle entfernt" nur bei ungefiltertem Lauf, Einzeldokument-Fehler brechen Lauf nicht ab, `job_lauf`-Fortschritt fortlaufend). GET letzter Job-Status. 409 bei laufendem Sync.
- `src/app/(app)/einstellungen/paperless/page.tsx` — Server Component, lädt Status + letzten Job.
- `src/components/paperless/paperless-panel.tsx` — Verbindungsformular (Token-Status statt Klartext), Testen-Button, Sync-Trigger + Filter.
- `src/components/paperless/sync-status.tsx` — Status-Anzeige (neu/aktualisiert/unverändert/unvollständig/Fehlerliste/Zeitstempel).
- `src/app/(app)/belege/page.tsx` — Server Component, owner-scoped, `.limit(1000)`.
- `src/components/belege/beleg-tabelle.tsx` — Tabelle (Datum/Korrespondent/Titel/Betrag/Tags/Status) + Detail-Sheet (OCR-Text, Paperless-Link) + Clientsuche.

### Abweichungen / Entscheidungen
- Paperless-Auth-Header ist `Authorization: Token <token>` (Paperless-ngx-Standard), nicht `Bearer`. Token weiterhin verschlüsselt at rest, nie geloggt/an Client.
- Sync läuft synchron in der Route (MVP, wie vorgegeben); `job_lauf` wird pro Seite aktualisiert, Teil-Ergebnisse bleiben bei Abbruch erhalten (fortsetzbar via erneutem Sync).
- „In Quelle entfernt"-Erkennung nur ohne aktive Filter (sonst False-Positives).
- Betrag: Custom-Fields haben Vorrang vor OCR-Text-Heuristik (Schlüsselwort-naher Betrag).
- Deutsche Anführungszeichen aus JS-String-Literal entfernt (Parser-Konflikt mit ASCII-Quote) — JSX-Texte unverändert.

### tsc / eslint / Test-Status
- `npx tsc --noEmit`: keine Fehler in PROJ-3-Dateien. (Vorbestehender, fremder Fehler in `src/components/konten/konten-tabelle.tsx` → PROJ-4, nicht Teil dieser Arbeit.)
- ESLint über alle PROJ-3-Pfade: Exit 0, keine Fehler/Warnungen.
- Vitest: 35/35 grün (`paperless.test.ts` 12, `client.test.ts` 23).

### Offene Punkte
- Periodischer/automatischer Sync (Cron) ist nicht enthalten — nur manueller Trigger (laut Spec ausreichend für MVP).
- Inkrementeller Sync „nur Änderungen seit letztem Lauf" via Paperless `modified__gt` ist nicht umgesetzt; Idempotenz erfolgt über Inhalts-Hash-Vergleich pro Dokument (überspringt Unveränderte schreibseitig).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
