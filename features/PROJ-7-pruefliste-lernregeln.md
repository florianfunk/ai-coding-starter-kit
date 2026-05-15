# PROJ-7: Prüfliste & Lernregeln (Ausnahmen-Workflow)

## Status: Planned
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-5 (Autonome Klassifizierung) — liefert unsichere Fälle in die Prüfliste
- Requires: PROJ-6 (Beleg↔Buchung-Matching) — liefert unsichere Matches in die Prüfliste

## Beschreibung
Zentraler Ausnahmen-Workflow: Alle Fälle, die der Agent nicht sicher entscheiden konnte (niedrige Konfidenz, fehlende Kategorie, mehrdeutiges Match, Aufteilung nötig), landen in einer Prüfliste. Der Inhaber entscheidet hier mit minimalem Aufwand. Jede Korrektur kann als wiederverwendbare **Lernregel** gespeichert werden, die künftige gleichartige Buchungen automatisch und deterministisch behandelt — der Agent wird mit der Zeit besser.

## User Stories
- Als Inhaber möchte ich eine fokussierte Liste nur der unsicheren Fälle sehen, damit ich nicht alles prüfen muss.
- Als Inhaber möchte ich einen Fall mit wenigen Klicks entscheiden (Kategorie, privat/geschäftlich, Belegzuordnung), damit die Prüfung schnell geht.
- Als Inhaber möchte ich aus einer Korrektur eine Regel erzeugen (z.B. „Empfänger enthält 'Telekom' → Kategorie Telefon, 19 % Vorsteuer"), damit gleichartige Buchungen künftig automatisch laufen.
- Als Inhaber möchte ich meine Regeln verwalten (ansehen, bearbeiten, deaktivieren, priorisieren), damit ich die Automatik steuern kann.
- Als Inhaber möchte ich sehen, wie oft eine Regel gegriffen hat, damit ich ihre Wirkung einschätzen kann.

## Acceptance Criteria
- [ ] Prüfliste zeigt alle offenen Ausnahmen mit Grund (niedrige Konfidenz / keine Kategorie / unsicheres Match / Aufteilung nötig), filter-/sortierbar
- [ ] Schnellentscheidung pro Fall: EÜR-Kategorie + USt-Satz wählen, privat/geschäftlich setzen, Beleg zuordnen, ggf. Betrag aufteilen (Privatanteil)
- [ ] Aus jeder Entscheidung optional eine Lernregel erzeugen mit Bedingung (Empfänger/Verwendungszweck-Muster, Konto, Betragsbereich) und Aktion (Kategorie, USt, privat/geschäftlich)
- [ ] Regeln werden bei künftiger Klassifizierung (PROJ-5) deterministisch und mit Vorrang vor der KI angewandt
- [ ] Regelverwaltung: Liste, Bearbeiten, Aktivieren/Deaktivieren, Priorität/Reihenfolge, Trefferzähler je Regel
- [ ] Erledigte Prüffälle verschwinden aus der Liste und erhalten Status „manuell bestätigt" (vor Re-Klassifizierung geschützt)
- [ ] Konfliktprüfung: widersprüchliche Regeln werden erkannt und gemeldet
- [ ] Optional: nach Anlegen einer Regel wird angeboten, bereits offene gleichartige Fälle direkt mitzuerledigen

## Edge Cases
- Was passiert, wenn eine neue Regel mit einer bestehenden kollidiert? (Prioritätsreihenfolge, Konfliktwarnung)
- Was passiert, wenn eine Regel zu breit greift und falsche Buchungen erfasst? (Trefferzähler + einfache Rücknahme/Deaktivierung, nur offene Fälle betroffen)
- Wie wird eine Aufteilungs-Buchung behandelt (z.B. 60 % geschäftlich / 40 % privat)? (Split in zwei Teilbuchungen)
- Was passiert, wenn ein Fall sowohl Klassifizierungs- als auch Match-Unsicherheit hat? (kombinierte Entscheidung in einem Schritt)
- Wie wird verhindert, dass eine geänderte Regel rückwirkend bestätigte Buchungen verändert?
- Was passiert bei sehr vielen offenen Fällen? (Bulk-Aktionen, Gruppierung nach ähnlichem Muster)

## Technical Requirements
- Determinismus: Regeln eindeutig priorisiert und nachvollziehbar angewandt
- Datenintegrität: manuell bestätigte Fälle sind unveränderlich gegenüber Re-Klassifizierung
- Effizienz: minimaler Klickaufwand, Bulk- und Mustergruppierung

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (Supabase — Regel-Engine geteilt mit PROJ-5)
Regeln werden serverseitig in der Klassifizierungs-Pipeline angewandt.

### Komponentenstruktur
```
Prüfliste (/pruefliste)
+-- Fall-Liste (Grund-Badge, filter-/sortierbar, Mustergruppierung)
+-- Schnellentscheidungs-Panel (Kategorie+USt, privat/geschäftlich, Belegzuordnung, Betrag-Split)
+-- "Als Lernregel speichern"-Option (Bedingung vorbefüllt aus Fall)
+-- Bulk-Aktionen

Einstellungen › Regeln (/einstellungen/regeln)
+-- Regel-Tabelle (Bedingung, Aktion, Priorität, aktiv, Trefferzähler)
+-- Regel-Editor (shadcn dialog + form) + Konfliktwarnung
```

### Datenmodell (Klartext)
**Lernregel**: Bedingung (Muster Empfänger/Zweck, Konto, Betragsbereich), Aktion (Kategorie, USt, privat/geschäftlich), Priorität, aktiv, Trefferzähler. Prüffall = Buchung mit Status „zur-Prüfung" + Grund; nach Entscheidung Status „manuell-bestätigt" (unveränderlich). Split erzeugt zwei Teilbuchungen.

### Tech-Entscheidungen (Begründung)
- **Geteilte Regel-Engine mit PROJ-5:** eine Quelle der Wahrheit, Regeln vor KI.
- **Prioritätsbasierte deterministische Anwendung + Konflikterkennung.**
- **Manuell-bestätigt = unveränderlich:** Regeländerung wirkt nie rückwirkend.
- **Bulk + Mustergruppierung:** minimaler Klickaufwand bei vielen Fällen.

### Abhängigkeiten (Pakete)
Keine neuen.

### Edge-Case-Behandlung
Regelkonflikt → Priorität + Warnung; zu breite Regel → Trefferzähler + Deaktivierung (nur offene Fälle betroffen); Split 60/40 → zwei Teilbuchungen; kombinierte Klassifizierungs-+Match-Unsicherheit in einem Schritt; Rückwirkungsschutz für bestätigte Fälle.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
