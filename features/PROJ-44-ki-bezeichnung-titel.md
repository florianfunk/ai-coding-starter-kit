# PROJ-44: KI-Vorschläge für Bezeichnung & Datenblatt-Titel

**Status:** In Progress
**Priorität:** P1
**Erstellt:** 2026-05-03
**Last Updated:** 2026-05-03

## Vision

Aus FileMaker übernommen: Bei den meisten ~400 Produkten ist `name` (Bezeichnung) ein dummy-Wert (oft = Artikelnummer oder leer). Auch der `datenblatt_titel` ist häufig nicht gepflegt. Per KI sollen sich beide Felder auf Knopfdruck aus dem vorhandenen Kontext (Artikelnummer, Bereich, Kategorie, Info-Zeile, technische Daten) als Vorschlag generieren lassen — der Nutzer reviewt und übernimmt.

## User Stories

- **Als Produktpfleger** möchte ich für ein Produkt mit einem Klick einen Vorschlag für Bezeichnung **und** Datenblatt-Titel bekommen, damit ich die FileMaker-Migration sauber bekomme, ohne 400× selbst zu tippen.
- **Als Produktpfleger** möchte ich beide Vorschläge nebeneinander sehen und einzeln (oder beide gemeinsam) übernehmen können.
- **Als Produktpfleger** möchte ich einen Hinweis ergänzen können (z. B. "Headline mit Marke STEPLIGHT") und die Vorschläge bei Bedarf neu generieren.

## Acceptance Criteria

### KI-Button in Produkt-Form
- [x] Neuer Button "✨ Bezeichnung & Titel vorschlagen" in der Grunddaten-Sektion (rechts neben den Feldern oder über ihnen)
- [x] Modal öffnet sich, sammelt automatisch Kontext aus Form-State:
  - Artikelnummer
  - Bereich-Name + Kategorie-Name (aus Lookup)
  - Info-Zeile (`info_kurz`)
  - Wichtige technische Felder (Leistung, Farbtemperatur, IP-Schutzart, Lichtstrom, CRI)
- [x] Optionaler Zusatz-Hinweis (Textarea)
- [x] Beim Klick auf "Generieren" → API-Call → Anzeige beider Vorschläge nebeneinander (Bezeichnung links, Titel rechts)
- [x] Pro Feld einzeln "Übernehmen" + Gesamt-Button "Beide übernehmen"
- [x] "Neu generieren" mit beibehaltenem Zusatz-Hinweis
- [x] Übernahme schreibt in die jeweiligen `<Input>`-Felder (`name`, `datenblatt_titel`) und markiert die zugehörige Sektion als dirty

### API-Route /api/ai/produkt-namen
- [x] POST-Endpoint
- [x] Zod-Schema: `artikelnummer`, `bereichName?`, `kategorieName?`, `infoKurz?`, `technischeDaten?` (Record<string, string>), `zusatzHinweis?`
- [x] Holt Provider/Modell/API-Key aus `ai_einstellungen`
- [x] Strukturierte JSON-Antwort vom LLM erzwingen: `{ bezeichnung: string, titel: string }`
- [x] Rate-Limit pro IP (60 / Stunde wie /api/ai/teaser)
- [x] Fehler-Handling wie Teaser-Endpoint

### Stil-Vorgaben für die KI
- **Bezeichnung** (`name`): kompakt, technisch, ~40–60 Zeichen, eignet sich für Tabellen/Listen
  - Beispiel: "LED-Stripe 24V 14,4 W/m 4000K IP20"
- **Titel** (`datenblatt_titel`): produktnamen-orientiert, ~30–50 Zeichen, taugt als PDF-Headline
  - Beispiel: "STEPLIGHT — Treppenleuchte 3W warmweiß"
- Bezeichnung darf nicht wortgleich zum Titel sein
- Keine Anführungszeichen, kein Markdown

## Out of Scope (für PROJ-44)
- Bulk-Aktion in der Produkt-Tabelle (kommt als PROJ-45 nach)
- Auto-Übernahme ohne Review

## Implementation Notes

**2026-05-03 — Initiale Umsetzung**

- Neue API-Route `POST /api/ai/produkt-namen` (siehe `src/app/api/ai/produkt-namen/route.ts`).
- Neue Lib `src/lib/ai/produkt-namen.ts` mit `generateProduktNamen()`. Erzwingt JSON-Output:
  - OpenAI: `response_format: { type: "json_object" }`
  - Anthropic: per Prompt-Vorgabe + Fallback-Parser, der `{...}` aus dem Text fischt
- Neue Komponente `src/components/ai-namen-button.tsx` (Dialog mit zwei Vorschlags-Karten + „Beide übernehmen"/„Einzeln übernehmen"/„Neu generieren").
- In `src/app/produkte/produkt-form.tsx`:
  - State eingeführt für `name` (war schon da), `datenblattTitel`, `infoKurz`, `kategorieId`
  - Bezeichnung-Feld bekommt KI-Button rechts neben dem Label
  - `getNamenContext`-Callback sammelt Artikelnummer, Bereich-Name, Kategorie-Name, Info-Zeile und alle `defaultValues` der technischen Felder
  - Beim Bereich-Wechsel wird die Kategorie zurückgesetzt, falls sie nicht mehr passt
- Rate-Limit identisch zur Teaser-Route: 60 / Stunde / IP

**Bekannte Einschränkung:** Die technischen Felder (Leistung, IP-Schutzart usw.) sind im Form uncontrolled (`defaultValue`). Der Kontext für die KI nutzt deshalb nur die **gespeicherten** Werte aus `defaultValues`, nicht die im DOM gerade getippten. In der Praxis kein Problem, weil der typische Workflow ist: Produkt aus FileMaker-Migration öffnen → technische Daten sind bereits gespeichert → KI-Vorschlag → Übernehmen. Bei „neuem Produkt" gibt es initial sowieso keine techn. Daten.
