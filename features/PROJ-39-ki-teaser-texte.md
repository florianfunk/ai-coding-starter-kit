# PROJ-39: KI-Teaser-Texte für Beschreibungen

**Status:** In Progress
**Priorität:** P1
**Erstellt:** 2026-04-30

## Vision
Marketing-Teaser für Bereiche, Kategorien und Produkte per Knopfdruck generieren. Über die Einstellungen wählen Nutzer ihren KI-Provider (OpenAI oder Anthropic) und das Modell, hinterlegen den jeweiligen API-Key. Beim Bearbeiten eines Eintrags öffnet ein Klick auf "✨ KI-Teaser" ein Modal mit dem generierten Text — der Nutzer kann ihn übernehmen, verwerfen oder neu generieren.

## User Stories

- **Als Produktpfleger** möchte ich auf Knopfdruck einen kurzen Marketing-Teaser zu einem Bereich/Kategorie/Produkt generieren, damit ich nicht jeden Beschreibungstext selbst formulieren muss.
- **Als Admin** möchte ich in den Einstellungen meinen API-Key (OpenAI oder Anthropic) und das gewünschte Modell auswählen, damit ich den KI-Anbieter selbst kontrolliere.
- **Als Nutzer** möchte ich vor der Übernahme den generierten Text sehen und ihn ggf. neu generieren oder verwerfen können, damit ich Kontrolle über den Inhalt habe.

## Acceptance Criteria

### Einstellungen → KI-Tab
- [x] Auswahl-Dropdown "KI-Provider": OpenAI (Default) | Anthropic
- [x] Eingabefeld "OpenAI API-Key" (Passwort-Feld mit Show/Hide)
- [x] Eingabefeld "Anthropic API-Key" (Passwort-Feld mit Show/Hide)
- [x] Modell-Auswahl Dropdown abhängig vom Provider:
  - OpenAI: gpt-4o-mini (Default), gpt-4o, gpt-5-mini, gpt-5
  - Anthropic: claude-haiku-4-5 (Default), claude-sonnet-4-6, claude-opus-4-7
- [x] Bestehender Replicate-Token bleibt unberührt
- [x] Speichern via Server Action mit Zod-Validierung

### Teaser-Button auf Bearbeiten-Seiten
- [x] Button "✨ KI-Teaser generieren" über/neben dem Beschreibungs-Feld
- [x] Modal mit:
  - Loading-State während Generierung
  - Generierter Text als Vorschau
  - Buttons: "Übernehmen" (ersetzt Beschreibung), "Verwerfen" (schließt Modal), "Neu generieren"
  - Optionales Hinweis-Feld "Zusatz-Hinweis" (z.B. "Fokus auf Profi-Anwendungen")
  - Auswahl Länge: kurz (1 Satz), mittel (2-3 Sätze), lang (Absatz, Default)
- [x] Wiederverwendbare Komponente `AITeaserButton`
- [x] Wenn kein API-Key konfiguriert: Hinweis + Link zu Einstellungen
- [x] Bereiche-Bearbeiten: aktiv
- [x] Kategorien-Bearbeiten: aktiv
- [x] Produkte-Bearbeiten: aktiv

### API-Route /api/ai/teaser
- [x] POST-Endpoint
- [x] Auth-Check (nur authentifizierte Nutzer)
- [x] Zod-Validierung: entityType, entityName, entityContext (optional), zusatzHinweis (optional), laenge
- [x] Holt API-Key + Provider + Modell aus `ai_einstellungen`
- [x] Rufe gewählten Provider mit Marketing-Prompt auf
- [x] Rate-Limiting: max. 20 Requests pro Nutzer pro Stunde
- [x] Rückgabe: `{ teaser: string }` oder `{ error: string }`

## Technical Design

### DB
- Migration `0024_ai_keys.sql`: erweitert `ai_einstellungen` um:
  - `openai_api_key text`
  - `anthropic_api_key text`
  - `ai_provider text default 'openai' check (ai_provider in ('openai', 'anthropic'))`
  - `ai_model text default 'gpt-4o-mini'`

### Code-Struktur
```
src/lib/ai/
  teaser.ts              # Provider-agnostischer Teaser-Generator
  prompts.ts             # Marketing-Prompts pro Entity-Typ
src/components/
  ai-teaser-button.tsx   # Wiederverwendbare Client-Komponente
src/app/api/ai/teaser/
  route.ts               # POST-Endpoint
src/app/einstellungen/
  ai-tab.tsx             # Erweitert um Provider/Keys/Modell
  ai-actions.ts          # Erweitert um neue Felder
```

### Marketing-Prompt (Auszug)
> "Du bist Marketing-Texter für ein deutsches Beleuchtungs-Großhandelsunternehmen (LICHT.ENGROS). Schreibe einen prägnanten Marketing-Teaser für [{entityType}: {entityName}]. Ziel: Profi-Kunden (Architekten, Installateure, Lichtplaner). Stil: sachlich-modern, kein Marketing-Geschwurbel, deutscher B2B-Ton. {laengenHinweis}. {zusatzHinweis}"

## Out of Scope
- Bulk-Teaser-Generierung für mehrere Entities auf einmal
- Custom Prompts pro Nutzer
- KI für andere Felder (z.B. Tags, Eigenschaften)
- Streaming-UI (Generierung wartet auf vollständige Antwort)

## Implementation Notes

**Implementiert am 2026-04-30:**

### Gelieferte Komponenten
- Migration `0024_ai_keys_und_modell.sql` — erweitert `ai_einstellungen` um `openai_api_key`, `anthropic_api_key`, `ai_provider` (default `openai`), `ai_model` (default `gpt-4o-mini`)
- `src/lib/ai/models.ts` — Provider/Modell-Konstanten + `isValidModel()` Helper
- `src/lib/ai/prompts.ts` — Marketing-System-Prompt + Builder pro Entity-Typ
- `src/lib/ai/teaser.ts` — Provider-agnostischer Generator via fetch (kein SDK-Dependency, OpenAI Chat Completions + Anthropic Messages API direkt)
- `src/app/api/ai/teaser/route.ts` — POST-Endpoint mit Auth-Check, Zod-Validation, In-Memory Rate-Limit (20/h pro User)
- `src/components/ai-teaser-button.tsx` — Modal mit Generieren/Übernehmen/Verwerfen/Neu, Längen-Auswahl, Zusatz-Hinweis
- `src/app/einstellungen/ai-tab.tsx` — Erweitert: TeaserCard (Provider/Modell/Keys) + ReplicateCard (Bestand)
- `src/app/einstellungen/ai-actions.ts` — Neue Server-Action `updateTeaserEinstellungen` (Zod, leere Keys behalten alten Wert)
- `src/components/rich-text-editor.tsx` — Neue optionale `onEditorReady`-Prop für imperatives `setContent`

### Eingebunden in
- `src/app/bereiche/bereich-form.tsx` — Beschreibung-Block (uncontrolled Editor + Editor-Ref)
- `src/app/kategorien/kategorie-form.tsx` — Beschreibung-Block (controlled Editor via State)
- `src/app/produkte/produkt-form.tsx` — Datenblatt-Text-Block 1 (uncontrolled Editor + Editor-Ref); fällt für Kontext zurück auf `info_kurz`, wenn Block 1 leer ist

### Architektur-Entscheidungen
- **Keine SDK-Pakete:** OpenAI- und Anthropic-Client sind ~5 Zeilen `fetch` — beide Pakete würden ~10 MB an node_modules-Footprint hinzufügen für eine simple Request-Response.
- **Keys in DB statt Env:** wie bestehender `replicate_token` — Admins ändern Keys ohne Deploy. Einziger Singleton-Row (id=1), RLS auf `authenticated`.
- **Rate-Limit in-memory:** simpler Map pro Server-Instanz, 20 Anfragen/Stunde/User. Reicht bei 3 internen Nutzern; kann bei Multi-Region-Deployment durch Redis ersetzt werden.
- **`emptyKey` schützt nicht überschreiben:** Beim Speichern bedeutet ein leeres Keyfeld „nicht ändern" — verhindert versehentliches Löschen beim Provider-Wechsel.

### Migration ausführen
```bash
# Über Supabase CLI lokal:
supabase db push
# Oder direkt im Supabase Dashboard SQL-Editor ausführen.
```

### Bekannte Limitierungen
- Kein Streaming (UI wartet auf Komplett-Antwort, ~2–10 Sek. je nach Modell)
- Beim Annehmen wird der bestehende Beschreibungstext **ersetzt**, nicht zusammengeführt
- Bei Produkten gilt der Teaser-Button nur für Block 1 (primäres Beschreibungsfeld); Block 2/3 brauchen ggf. separaten Button
