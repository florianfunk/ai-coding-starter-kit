# PROJ-42: KI-Bild-Generierung für Kategorie-Slots

**Status:** Approved
**Priorität:** P1
**Erstellt:** 2026-04-30
**Last Updated:** 2026-04-30

## Vision
Wenn für einen Kategorie-Bildslot kein passendes Foto vorliegt, soll der Pfleger per Knopfdruck ein Studio-qualitatives Produktbild von OpenAIs `gpt-image-2` generieren lassen können. Ein kurzer Prompt beschreibt das Motiv; ein fester Stil-Wrapper sorgt für katalog-kompatible Bildqualität (weißer Hintergrund, Studio-Beleuchtung, fotorealistisch).

## User Stories

- **Als Pfleger** möchte ich auf einem leeren oder schlechten Bildslot ein KI-generiertes Produktbild erstellen lassen, damit ich kein Foto-Studio buchen muss.
- **Als Pfleger** möchte ich nur einen kurzen Prompt eingeben (Motiv-Beschreibung) — den Stil (Studio, weißer Hintergrund, hochwertig) muss das System selbst dazupacken.
- **Als Pfleger** möchte ich vor der Übernahme das generierte Bild sehen und ggf. neu generieren oder verwerfen können.

## Acceptance Criteria

### UI
- [x] Button „✨ KI-Bild generieren" auf jedem der 4 Bildslots (Kategorie-Bearbeiten)
- [x] Modal mit:
  - Prompt-Textfeld (Motiv-Beschreibung, max. 500 Zeichen)
  - Hinweis-Text: „Standard-Stil (Studio, weiß, Katalog-Qualität) wird automatisch ergänzt."
  - Generieren-Button → Loading-Spinner während Generierung (10–30 Sek.)
  - Bild-Vorschau im richtigen Slot-Aspect (5:1 oder 1:2)
  - Buttons: „Übernehmen" / „Verwerfen" / „Neu generieren"

### Backend
- [x] Server-Action `generateKategorieBildKi(slot, userPrompt)`:
  - Holt OpenAI-Key aus `ai_einstellungen` (Wiederverwendung PROJ-39)
  - Wrapt User-Prompt mit Studio-Stil-Vorlage
  - Ruft `https://api.openai.com/v1/images/generations` mit `gpt-image-2`
  - Quality `high`, Size `1536×1024` (wide) oder `1024×1536` (tall)
  - Empfängt Base64 → Buffer
  - Sharp-Crop auf Slot-Aspect (1500×300 / 600×1200) via `position: attention`
  - Speichert in Supabase Storage als `kategorien/ai-{slot}-{ts}-{rand}.jpg`
  - Im Bearbeiten-Modus: ersetzt Slot-Pfad direkt in DB
- [x] Wenn kein OpenAI-Key konfiguriert: klare Fehlermeldung mit Link zu Einstellungen
- [x] Rate-Limit: 10 Bilder/Stunde/IP (KI-Bild ist deutlich teurer als Text)

### Stil-Wrapper (fest)
> "Studio-Produktfoto in höchster Qualität für einen professionellen Beleuchtungs-Katalog. Sauberer weißer/neutraler Hintergrund, professionelle Studiobeleuchtung, scharf, detailreich, fotorealistisch, kein Text, keine Wasserzeichen, kein Logo. Motiv: {USER_PROMPT}"

## Technical Design

### OpenAI API
- Endpoint: `POST /v1/images/generations`
- Model: `gpt-image-2`
- Body: `{ model, prompt, size, quality: "high", n: 1, response_format: "b64_json" }`
- Header: `Authorization: Bearer {key}`, `Content-Type: application/json`
- Timeout: 60 Sek. (Generation kann lange dauern)

### Code-Struktur
```
src/lib/ai/
  image.ts                # Provider-Lib für gpt-image-2 (analog zu teaser.ts)
src/components/
  ai-image-button.tsx     # Wiederverwendbare Client-Komponente (Button + Modal)
src/app/kategorien/
  actions.ts              # Neue Action generateKategorieBildKi
```

### Wiederverwendbarkeit
- `lib/ai/image.ts` ist Entity-agnostisch — kann später für Bereiche, Produkt-Hauptbild etc. genutzt werden, indem nur die Crop-Größe/-Aspect je nach Aufrufer variiert.

## Out of Scope
- Editing-Mode (gpt-image-2 unterstützt 16 Reference-Bilder — kommt später)
- Quality-Auswahl im UI (fest auf `high`)
- Bilder für Bereiche, Produkte, Logos (separate Folge-Features)
- Streaming / Progress-Bar während Generation (nur Loading-Spinner)

## Implementation Notes

**Implementiert am 2026-04-30:**

### Gelieferte Komponenten
- `src/lib/ai/image.ts` — `gpt-image-2`-Client (fetch-basiert, kein SDK), Stil-Prompt-Wrapper exportiert als `STUDIO_PROMPT_PREFIX`
- `src/components/ai-image-button.tsx` — wiederverwendbar (Icon-Variante für Slot-Action-Bar, Default-Variante für leere Slots)
- `src/app/kategorien/actions.ts:generateKategorieBildKi` — Server-Action: holt Key aus `ai_einstellungen`, ruft `gpt-image-2` mit 1536×1024 (wide) bzw. 1024×1536 (tall), schneidet danach mit Sharp `attention` auf 1500×300 / 600×1200 zu, lädt als JPEG nach Storage hoch
- `src/app/kategorien/kategorie-form.tsx` — pro Slot eigener AI-Preview-State, Action-Bar-Icon + Default-Button bei leerem Slot

### Architektur-Entscheidungen
- **OpenAI `gpt-image-2` direkt** (kein SDK) — analog zu Teaser-Generation in PROJ-39
- **Quality `high` fest** — Studioqualität für Katalog rechtfertigt höhere Kosten (~$0.17/Bild)
- **Aspect-Mismatch-Pipeline:** API gibt 3:2 oder 2:3, Sharp croppt auf 5:1 / 1:2 — `attention`-Strategie findet Bildmittelpunkt
- **OpenAI-Key wiederverwenden** aus PROJ-39 Settings — kein zweiter Key
- **Rate-Limit: 10 Bilder/Stunde** (in-memory) — KI-Bild ist deutlich teurer als Text-Teaser
- **Original-Pfad merken** wie bei Crop — User kann via „Original wiederherstellen" zum vorherigen Bild zurück
- **Kein Slot-Restore beim AI-Generate-Modal-Schließen** — der Generated-Path bleibt im Modal-State, aber wird verworfen, wenn der User „Verwerfen" klickt

### Bekannte Limitierungen
- Generierte Bilder werden bis zur Übernahme als „verwaiste" Files in Storage gehalten (Cleanup-Job wäre möglich, aber die Beträge sind klein)
- Quality nur `high` — kein UI-Toggle (in Settings später ergänzbar)
- Kein Editing-Mode (gpt-image-2 unterstützt 16 Reference-Bilder — Folge-Feature)
- Nur Kategorie-Slots — Bereiche/Produkte/Logos kommen separat
