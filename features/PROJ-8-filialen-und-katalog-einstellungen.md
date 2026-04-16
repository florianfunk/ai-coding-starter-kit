# PROJ-8: Filialen- & Katalog-Einstellungen

## Status: Architected
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-2 (Datenmodell)

## User Stories
- Als Nutzer möchte ich die Filialdaten (Marling, Klausen, Bruneck, Vomp, Schweiz) pflegen (Name, Adresse, Telefon, E-Mail, Land), damit sie im Katalog-Footer erscheinen.
- Als Nutzer möchte ich den Copyright-/Rechtshinweis-Text für das Ende des Katalogs pflegen (Lichtengros-Text, Eisenkeil-Text).
- Als Nutzer möchte ich Logos (dunkel/hell, Lichtengros/Eisenkeil/Lichtstudio) hochladen und pflegen, damit sie in den jeweiligen Layouts verwendet werden.
- Als Nutzer möchte ich einstellen, auf welcher Seite der Katalog die „vorne"/„hinten"-Seite (Cover/Rückseite) hat.
- Als Nutzer möchte ich das Gültigkeitsdatum des Katalogs (z.B. „Gültig bis 31.12.2026") setzen können.

## Acceptance Criteria
- [ ] Seite `/einstellungen/filialen` mit Tabelle aller Filialen + CRUD
- [ ] Filial-Felder: Name, Land (IT/AT/CH), Adresse (mehrzeilig), Telefon, Fax (optional), E-Mail, Zugeordnet zu Marke (Lichtengros/Eisenkeil)
- [ ] Seite `/einstellungen/katalog` mit Parametern:
  - Copyright-Text Lichtengros (Textarea)
  - Copyright-Text Eisenkeil (Textarea)
  - Gültigkeitsdatum Katalog (Datum)
  - Cover-Bild vorne (Upload)
  - Cover-Bild hinten (Upload)
  - Logos: Lichtengros dunkel, Lichtengros hell, Eisenkeil dunkel, Eisenkeil hell, Lichtstudio-Logo (alle Upload)
- [ ] Änderungen wirken sich direkt auf PDF-Export aus (PROJ-9, PROJ-10)
- [ ] Nur eine Instanz pro Einstellung (Singleton-Muster, z.B. Tabelle `katalog_einstellungen` mit einer Zeile)

## Edge Cases
- Was passiert, wenn ein Logo fehlt? → PDF-Export zeigt Platzhalter, Warnung im UI
- Was passiert beim Löschen der letzten Filiale? → Erlaubt, aber Warnung „Mindestens eine Filiale empfohlen"
- Was passiert bei ungültigem Datum? → Validierungsfehler
- Was passiert bei zu großen Logo-Uploads? → Gleiche Regel wie PROJ-3 (max. 10 MB, Format-Check)
- Was passiert, wenn zwei Nutzer gleichzeitig Einstellungen ändern? → Last-write-wins, optional Hinweis „wurde gerade von X geändert"

## Technical Requirements
- shadcn/ui: Form, Tabs (Filialen/Katalog/Logos), Textarea, Upload
- Supabase Storage für Logos & Cover-Bilder
- Singleton-Tabelle für Katalog-Einstellungen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
/einstellungen
+-- Tabs-Navigation
|   +-- Tab "Filialen"
|   |   +-- FilialenTable (Marke, Name, Land, Adresse)
|   |   +-- "+ neue Filiale"-Dialog
|   +-- Tab "Katalog"
|   |   +-- DatePicker "Gültig bis"
|   |   +-- Textarea Copyright Lichtengros
|   |   +-- Textarea Copyright Eisenkeil
|   |   +-- NumberInput Wechselkurs EUR -> CHF
|   |   +-- Cover-Upload vorne / hinten
|   +-- Tab "Logos"
|       +-- Grid: Logo-Uploads (Lichtengros hell/dunkel, Eisenkeil hell/dunkel, Lichtstudio)
```

### Data Model
Zwei Tabellen:
- `filialen`: mehrere Zeilen, FK-Marke-Feld ("lichtengros"/"eisenkeil").
- `katalog_einstellungen`: Singleton — genau eine Zeile, erzwungen per `CHECK (id = 1)` oder UUID-fix. Alle Logo-URLs, Cover-URLs, Copyright-Texte, Wechselkurs, Gültigkeitsdatum.

### Tech-Entscheidungen
- **Singleton-Zeile statt Key-Value-Tabelle**: weil Felder fix bekannt sind, ist die Struktur als normale Tabelle typensicherer und einfacher zu lesen.
- **Logos und Cover in Supabase Storage Bucket `assets`** (getrennt von Produktbildern).
- **Tabs im UI**: logische Trennung Filialen/Katalog/Logos, hält Formulare kurz.
- **Alle Uploads gleich gehandhabt wie in PROJ-3/5** (signed upload URL).

### Abhängigkeiten
- Keine neuen — gleiche Upload-/Form-Libs wie in PROJ-3/5

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
