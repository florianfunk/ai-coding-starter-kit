# PROJ-3: Paperless-Integration (Beleg- & OCR-Import)

## Status: Planned
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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
