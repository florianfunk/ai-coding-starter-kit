# PROJ-12: Dashboard & Buchungsstatus-Übersicht

## Status: Planned
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-6 (Beleg↔Buchung-Matching) — fehlende Belege / Matching-Status
- Requires: PROJ-7 (Prüfliste & Lernregeln) — offene Prüffälle

## Beschreibung
Zentrale Übersichtsseite (Einstieg nach Login): zeigt auf einen Blick den Buchhaltungsstand — offene Prüffälle, fehlende Belege, Klassifizierungsfortschritt, Periodenstatus für USt-VA/EÜR sowie zentrale Kennzahlen. Macht den autonomen Agenten transparent und führt den Inhaber direkt zu den Stellen, die Aufmerksamkeit brauchen.

## User Stories
- Als Inhaber möchte ich nach dem Login sofort sehen, ob etwas zu tun ist, damit ich nicht durch alle Bereiche klicken muss.
- Als Inhaber möchte ich die Anzahl offener Prüffälle und fehlender Belege sehen, damit ich Aufwand und Dringlichkeit einschätze.
- Als Inhaber möchte ich den Bearbeitungsstand je USt-VA-Periode und Wirtschaftsjahr sehen (offen/geprüft/abgeschlossen), damit ich Fristen im Blick habe.
- Als Inhaber möchte ich Kernkennzahlen sehen (Einnahmen/Ausgaben/Gewinn lfd. Jahr, voraussichtliche USt-Zahllast), damit ich meine Lage kenne.
- Als Inhaber möchte ich von jeder Kachel direkt zur zugehörigen Ansicht springen, damit ich schnell handeln kann.

## Acceptance Criteria
- [ ] Dashboard ist die Startseite nach Login und lädt aktuelle Kennzahlen
- [ ] Kacheln: offene Prüffälle (PROJ-7), fehlende Belege (PROJ-6), unklassifizierte Buchungen (PROJ-5), letzter Paperless-Sync (PROJ-3), letzter Kontoimport (PROJ-4)
- [ ] Periodenstatus-Übersicht: je USt-VA-Periode und Wirtschaftsjahr Status offen/geprüft/abgeschlossen
- [ ] Kennzahlen laufendes Jahr: Betriebseinnahmen, Betriebsausgaben, vorläufiger Gewinn, voraussichtliche USt-Zahllast (aus vorhandenen Auswertungen, klar als vorläufig markiert)
- [ ] Jede Kachel verlinkt direkt auf die zugehörige Detailansicht (Prüfliste, Fehlliste, Periode, Import)
- [ ] Dashboard zeigt nur konsistente Werte; ohne Daten klare Leerzustände/Onboarding-Hinweise
- [ ] Performance: Übersicht lädt ohne spürbare Verzögerung trotz Aggregation

## Edge Cases
- Was wird angezeigt, wenn noch keine Daten importiert wurden? (Onboarding-Leerzustand mit nächsten Schritten)
- Wie verhält sich das Dashboard, wenn eine Datenquelle (Paperless) zuletzt fehlerhaft synchronisiert hat? (Status-/Fehlerhinweis statt veralteter Stillstand)
- Wie werden vorläufige vs. abgeschlossene Kennzahlen unterschieden? (klare Kennzeichnung „vorläufig")
- Was passiert bei sehr vielen offenen Fällen? (aggregierte Zahl + Verlinkung, kein Performance-Einbruch)
- Wie aktuell sind die Kennzahlen (Caching vs. Live)? (sichtbarer Stand/Zeitstempel)

## Technical Requirements
- Performance: schnelle, gecachte Aggregation mit sichtbarem Aktualitätsstand
- Klarheit: konsistente Kennzeichnung vorläufig/abgeschlossen
- Navigation: direkte Sprungziele aus jeder Kachel

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (aggregierende Lesezugriffe)
Kennzahlen-Aggregation über mehrere Module, gecacht.

### Komponentenstruktur
```
Dashboard (/dashboard)  [Startseite nach Login]
+-- Aktions-Kacheln: offene Prüffälle, fehlende Belege, unklassifiziert,
|     letzter Paperless-Sync, letzter Kontoimport  (je verlinkt)
+-- Periodenstatus-Übersicht (USt-VA-Perioden, Wirtschaftsjahre)
+-- Kennzahlen lfd. Jahr (Einnahmen/Ausgaben/Gewinn/voraussichtl. USt-Zahllast)
+-- Leerzustand/Onboarding bei fehlenden Daten
```

### Datenmodell (Klartext)
Keine eigene Tabelle: aggregiert über Buchungen, Prüffälle (PROJ-7), Zuordnungen (PROJ-6), Sync-Jobs (PROJ-3/4), Steuerperioden (PROJ-8/9). Aktualitätsstand sichtbar.

### Tech-Entscheidungen (Begründung)
- **Server Components + gecachte Aggregation:** schnelle Übersicht trotz vieler Quellen.
- **Konsistente „vorläufig/abgeschlossen"-Kennzeichnung:** keine irreführenden Zahlen.
- **Direkte Sprungziele je Kachel:** führt den Nutzer sofort zur Aktion.

### Abhängigkeiten (Pakete)
Keine neuen.

### Edge-Case-Behandlung
Keine Daten → Onboarding-Leerzustand mit nächsten Schritten; fehlerhafter letzter Sync → Status-/Fehlerhinweis statt Stillstand; vorläufig vs. abgeschlossen klar markiert; viele offene Fälle → aggregierte Zahl + Link; sichtbarer Aktualitäts-Zeitstempel.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
