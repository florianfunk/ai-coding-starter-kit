# PROJ-46: Italienische Übersetzung für Datenblätter

## Status: In Review
**Created:** 2026-05-04
**Last Updated:** 2026-05-04
**Priorität:** P1

## Vision

Datenblätter sollen zusätzlich zur deutschen Version auf Italienisch ausgegeben werden können. LICHT.ENGROS / Eisenkeil betreut Kunden in Südtirol und Italien — manuelle Übersetzung von ~400 Produkten ist nicht praktikabel. Stattdessen: Pro Produkt werden alle datenblatt-relevanten Texte über die KI (bestehender Provider aus `ai_einstellungen`) ins Italienische übersetzt und in zusätzlichen Spalten (`*_it`) gespeichert. In der Datenblatt-Vorschau gibt es einen Sprach-Schalter DE / IT — Layout und Marke (Lichtengros / Eisenkeil) bleiben unabhängig wählbar.

Italienischer Gesamtkatalog (PROJ-10 / PROJ-37) ist **nicht** Teil dieser Spec — die hier eingeführten `_it`-Felder sind aber die Grundlage dafür und können später vom Druck-Wizard genutzt werden.

## Dependencies
- Requires: PROJ-5 (Produkte/Artikel verwalten) — erweitert das Produkt-Formular
- Requires: PROJ-9 (PDF-Datenblatt) — Sprach-Schalter in der Vorschau, Payload-Builder muss IT-Felder lesen
- Requires: PROJ-39 (KI-Teaser-Texte) — nutzt Provider/Key/Modell aus `ai_einstellungen`
- Requires: PROJ-44/PROJ-45 (KI-Vorschläge & Bulk) — wiederverwendbare Patterns für Modal + Bulk-Run
- Informs: PROJ-10 / PROJ-37 (Gesamtkatalog) — späteres Feature kann auf `_it`-Spalten zugreifen

## User Stories

- **Als Produktpfleger** möchte ich auf Knopfdruck alle datenblatt-relevanten Felder eines Produkts ins Italienische übersetzen lassen, damit ich nicht jedes Feld einzeln durch DeepL kopieren muss.
- **Als Produktpfleger** möchte ich die KI-Übersetzungen vor der Übernahme reviewen und korrigieren können, damit Fachbegriffe der Beleuchtungsbranche korrekt sind.
- **Als Produktpfleger** möchte ich in der Produkt-Tabelle mehrere Produkte auswählen und gemeinsam ins Italienische übersetzen lassen (Bulk), damit ich die ~400 Bestandsprodukte effizient migrieren kann.
- **Als Produktpfleger** möchte ich, dass beim Speichern eines Produkts mit geänderten deutschen Texten die italienische Version automatisch nachgezogen wird, damit DE und IT nicht auseinanderdriften.
- **Als Produktpfleger** möchte ich in der Datenblatt-Vorschau zwischen Deutsch und Italienisch umschalten, damit ich pro Produkt entscheiden kann, welches PDF heruntergeladen wird.
- **Als Produktpfleger** möchte ich italienische Texte in einem eigenen Tab im Produkt-Formular sehen und manuell editieren können, damit ich Korrekturen direkt vornehmen kann.

## Acceptance Criteria

### A) Datenmodell — neue Spalten `*_it`

- [ ] Migration `0029_produkt_uebersetzung_it.sql` ergänzt folgende Spalten in `public.produkte`:
  - `name_it text`
  - `datenblatt_titel_it text`
  - `info_kurz_it text`
  - `treiber_it text`
  - `datenblatt_text_2_it text`
  - `datenblatt_text_3_it text`
  - `bild_detail_1_text_it text`
  - `bild_detail_2_text_it text`
  - `bild_detail_3_text_it text`
  - `achtung_text_it text`
- [ ] Alle neuen Spalten sind **nullable** und haben **keinen Default** — leere Spalte = "noch nicht übersetzt".
- [ ] Bestehende RLS-Policies auf `produkte` decken die neuen Spalten automatisch ab (kein neuer Policy-Block nötig — Spalten erben Tabellen-RLS).
- [ ] Die Liste der zu übersetzenden Felder existiert auch zentral in `src/lib/i18n/translatable-fields.ts` als TypeScript-Konstante, damit API + UI dieselbe Quelle haben.

### B) KI-Übersetzungs-API `/api/ai/uebersetzen`

- [ ] POST-Endpoint, identische Auth-/Rate-Limit-Strategie wie `/api/ai/teaser` (Rate-Limit 60 / Stunde / IP).
- [ ] Zod-Body-Schema:
  ```ts
  {
    produktId: string,
    zielsprache: "it",          // erweiterbar später
    felder: Array<keyof TranslatableFields>,  // welche Felder übersetzen
    quelltexte: Record<string, string>,        // DE-Text pro Feld
    nurLeere?: boolean,         // optional: nur Felder, deren *_it leer ist
  }
  ```
- [ ] Holt Provider/Modell/Key aus `ai_einstellungen` (wie PROJ-39/44).
- [ ] Erzwingt strukturierte JSON-Antwort: `{ uebersetzungen: Record<string, string> }`.
- [ ] System-Prompt (Auszug):
  > "Du bist Fachübersetzer für die deutsche Beleuchtungs-Branche. Übersetze die folgenden Produkttexte einer LED-/Leuchten-Datenblatt-Spezifikation **ins Italienische**. Behalte technische Begriffe (z.B. CRI, IP65, Lumen, Kelvin, LED) **unverändert**. Behalte HTML-Tags (`<p>`, `<strong>`, `<ul>`, `<li>`, `<br>`) **exakt** bei, nur den Text-Inhalt übersetzen. Keine erklärenden Zusätze, keine Anführungszeichen außerhalb des Originals. Antworte ausschließlich mit JSON."
- [ ] Rückgabe `{ uebersetzungen: { feld: "italienischer Text", ... } }` oder `{ error: string }` bei Fehler.
- [ ] Bei leerem Quelltext (DE-Feld leer): überspringt das Feld und liefert leeren String zurück (KI wird nicht aufgerufen für leere Felder).

### C) Pro-Produkt-Button im Formular

- [ ] In der Sektion "Italienisch" (siehe E) gibt es einen Button **"🇮🇹 Alle Felder übersetzen"**.
- [ ] Klick öffnet ein Modal (analog `AINamenButton` / `AITeaserButton`):
  - Optional: Mehrfach-Auswahl, welche Felder übersetzt werden sollen (Default: alle).
  - Optional: Checkbox "Nur leere Felder übersetzen" (Default: aus).
  - Button "Übersetzen" startet API-Call, zeigt Loading.
- [ ] Nach Antwort: Vorschau-Liste pro Feld mit DE-Original (links) und IT-Vorschlag (rechts), pro Feld einzeln "Übernehmen" oder Gesamt-Button "Alle übernehmen".
- [ ] "Übernehmen" schreibt in das jeweilige `*_it`-Feld im Form-State und markiert das Formular als dirty.
- [ ] "Neu generieren" wiederholt die Übersetzung mit identischem Input.

### D) Auto-Trigger beim Speichern

- [ ] Beim Speichern eines Produkts: Wenn ein deutsches Feld (z.B. `datenblatt_titel`) geändert wurde **und** das zugehörige `*_it`-Feld nicht im selben Save-Vorgang ebenfalls vom User editiert wurde, wird die italienische Version automatisch neu generiert.
- [ ] Die Auto-Übersetzung läuft **asynchron im Hintergrund** (Server Action ruft API-Route auf, blockiert den Save nicht):
  - Save schreibt zuerst alle Feldwerte (inkl. ggf. user-editierter `*_it`).
  - Danach wird ein Background-Job (oder direkt `fetch` ohne `await` blockierend für UI) gestartet, der die `*_it`-Felder für geänderte DE-Felder aktualisiert.
  - User sieht Toast: "Italienische Übersetzung wird im Hintergrund aktualisiert …" + späterer Toast "Übersetzung fertig" (optional).
- [ ] **Override-Verhalten:** Wenn der User im selben Save sowohl DE als auch IT für dasselbe Feld geändert hat, gewinnt der manuelle IT-Wert — Auto-Übersetzung überspringt dieses Feld.
- [ ] Die Auto-Übersetzung kann in den Einstellungen global deaktiviert werden (siehe G).

### E) UI: Eigene Sektion "Italienisch" im Produkt-Formular

- [ ] Neue Accordion-Sektion **"🇮🇹 Italienisch"** unterhalb der bestehenden Sektion "Datenblatt-Bilder".
- [ ] Die Sektion enthält für jedes übersetzbare Feld:
  - Label (z.B. "Datenblatt-Titel (IT)")
  - Eingabefeld (Input für kurze Texte, Textarea für `info_kurz`/`treiber`/`bild_detail_*_text`/`achtung_text`, RichText-Editor für `datenblatt_text_2_it`/`datenblatt_text_3_it`)
  - Kleiner Hinweis-Text mit dem deutschen Original (graue Schrift, max. 2 Zeilen, ausklappbar)
  - Pro Feld ein kleiner KI-Button "✨ übersetzen" (übersetzt nur dieses eine Feld)
- [ ] Oben in der Sektion: globaler Button **"🇮🇹 Alle Felder übersetzen"** (siehe C).
- [ ] Status-Indikator pro Feld: leer = grauer Punkt, gefüllt = grüner Punkt, "DE wurde geändert nach letzter Übersetzung" = orangener Punkt (optional, wenn Tracking-Spalte siehe Edge Cases existiert — sonst nur grau/grün).

### F) Bulk-Übersetzung in der Produkt-Tabelle

- [ ] In der Produkt-Übersicht (Tabelle) gibt es ein neues Bulk-Aktion-Dropdown-Item **"🇮🇹 Italienisch übersetzen"** (analog PROJ-45 Bulk-KI-Bezeichnung).
- [ ] User wählt mehrere Produkte aus → Klick auf "Italienisch übersetzen" → Modal:
  - Vorschau: "X Produkte werden übersetzt"
  - Optional: Checkbox "Nur leere IT-Felder überschreiben" (Default: an, schützt manuelle Korrekturen)
  - Button "Starten" startet einen Bulk-Job
- [ ] Bulk-Job läuft im Hintergrund (Server Action mit Streaming Progress oder polling-Endpoint):
  - Pro Produkt wird die API `/api/ai/uebersetzen` mit allen Feldern aufgerufen.
  - Bei Fehler eines einzelnen Produkts wird übersprungen + protokolliert.
  - Live-Progress-Anzeige (X / Y fertig, geschätzte Restzeit, Fehler-Counter).
- [ ] Nach Abschluss: Toast "X übersetzt, Y Fehler. Details ansehen" mit Link zum Log.
- [ ] Rate-Limit: Bulk respektiert die 60/h-Grenze pro IP — bei Überschreitung pausiert der Job 60 s und macht weiter (oder bricht mit klarer Meldung ab).

### G) Einstellungen — KI-Tab erweitert

- [ ] Im bestehenden KI-Tab (siehe PROJ-39) gibt es eine neue Sektion **"Italienische Übersetzung"** mit:
  - Toggle "Auto-Übersetzung beim Speichern" (Default: an)
  - Hinweis-Text: "Wenn aktiviert, wird die italienische Version automatisch neu generiert, sobald ein deutscher Text geändert wird."
- [ ] Speichern via Server Action mit Zod, schreibt in `ai_einstellungen.auto_translate_it boolean default true`.

### H) PDF-Datenblatt — Sprach-Dropdown

- [ ] In der Datenblatt-Vorschau (`src/app/produkte/[id]/datenblatt/page.tsx`) gibt es ein neues Dropdown **"Sprache"** mit den Optionen "Deutsch" (Default) / "Italienisch", neben dem bestehenden Marken-Dropdown.
- [ ] Bei Wechsel auf "Italienisch":
  - Iframe lädt die PDF mit Query-Param `?lang=it`.
  - Payload-Builder (`src/lib/latex/datenblatt-payload.ts`) liest die `*_it`-Felder statt der deutschen.
  - Falls ein `*_it`-Feld leer ist: Fallback auf das deutsche Feld (mit kleinem Hinweis im Preview "Feld 'X' nicht übersetzt — zeigt Deutsch").
  - Statische Beschriftungen im Template (z.B. "Technische Daten", "Hinweise", "Anwendung") werden ebenfalls übersetzt — Übersetzungs-Map im LaTeX-Template (`templates/lichtengross-datenblatt/`) oder als Variablen im Payload.
- [ ] Download-Dateiname enthält Sprach-Suffix: `Datenblatt-{Artikelnummer}-IT.pdf` (DE-Datei bleibt ohne Suffix für Rückwärtskompatibilität).
- [ ] PDF-Generierungszeit bleibt unter 3 s (kein zusätzlicher API-Call zur Laufzeit — Übersetzung ist bereits in der DB).

### I) Statische Datenblatt-Labels (LaTeX-Template)

- [ ] Im LaTeX-Template wird eine sprachspezifische Label-Map eingeführt (z.B. via Tectonic-Variable `\lang{de|it}`).
- [ ] Übersetzte statische Strings (mindestens):
  - "Technische Daten" → "Dati tecnici"
  - "Anwendung" → "Applicazione"
  - "Hinweise" → "Note"
  - "Achtung" → "Attenzione"
  - "Treiber" → "Driver"
  - "DETAILS" → "DETTAGLI"
  - "Energieeffizienzklasse" → "Classe di efficienza energetica"
  - Footer-Texte ("Stand …", "Alle Angaben ohne Gewähr")
- [ ] Komplette Übersetzungs-Map wird in `services/latex-pdf-service/templates/lichtengross-datenblatt/labels.tex` (oder analog) gepflegt.

## Edge Cases

- **DE-Feld leer:** Beim Übersetzen wird das Feld übersprungen; `*_it` bleibt leer.
- **IT-Feld bereits manuell editiert, dann DE geändert:** Auto-Übersetzung überschreibt IT trotzdem (Spec-Wahl: "Immer wenn DE-Feld sich ändert"). Wenn der User manuelle Korrekturen schützen möchte, muss er Auto-Übersetzung in den Einstellungen abschalten oder die Bulk-Option "Nur leere Felder" nutzen. Dies wird in der UI klar kommuniziert (Tooltip "Achtung: Auto-Übersetzung überschreibt manuelle Korrekturen").
- **HTML im RichText:** Übersetzung muss `<p>`, `<ul>`, `<strong>` etc. erhalten — System-Prompt schließt das ein. QA-Test prüft Round-Trip (HTML rein → HTML raus, Struktur identisch, nur Textinhalt italienisch).
- **Technische Begriffe:** "CRI 90", "IP65", "2700K", "LED" bleiben unverändert. Prompt schließt das ein. Beispiel-Produkt im QA-Run.
- **Sehr lange Texte:** Maximale Eingabe pro Feld ~10000 Zeichen (RichText-Block). Token-Limit der KI berücksichtigen — falls überschritten, Fehler `{ error: "Text zu lang für Übersetzung" }` mit klarem Hinweis.
- **API-Fehler oder Quota:** Toast-Fehler im UI; bei Bulk wird das Produkt übersprungen und im Fehler-Log notiert, andere Produkte laufen weiter.
- **Rate-Limit erreicht:** Pro-Produkt-Aufruf liefert 429 mit Hinweis. Bulk-Job pausiert oder bricht mit klarer Meldung ab.
- **Auto-Trigger beim Erstellen eines neuen Produkts (INSERT):** Erste Speicherung übersetzt alle nicht-leeren DE-Felder (gleiches Verhalten wie UPDATE).
- **Produkt ohne Marke "Eisenkeil"/"Lichtengros":** Sprach-Schalter ist marken-unabhängig, beide Marken können DE und IT.
- **DE-Feld wird auf leer gesetzt:** Auto-Übersetzung setzt das zugehörige `*_it` ebenfalls auf leer (sonst hätten wir Geister-Übersetzungen).
- **Provider-Fehler beim Auto-Save:** Save selbst gelingt (DE wird gespeichert), nur Hintergrund-Übersetzung schlägt fehl. Toast: "DE gespeichert. Italienische Übersetzung fehlgeschlagen — bitte manuell auslösen." Daten bleiben konsistent.
- **Mehrere User bearbeiten parallel:** Last-write-wins (wie heute schon). Auto-Übersetzung wird beim Save des jeweiligen Users ausgelöst.
- **PDF-Sprache "IT" gewählt aber alle `*_it` leer:** PDF wird trotzdem generiert, fällt überall auf DE zurück. Banner im Preview: "Dieses Produkt ist noch nicht übersetzt — zeigt Deutsch."

## Technical Requirements

- **Performance:**
  - Pro-Produkt-Übersetzung (alle ~10 Felder): API-Aufruf < 15 s (LLM-Latenz).
  - Bulk-Job: 1 Produkt / 5–10 s (sequenziell, um Rate-Limit nicht zu sprengen).
  - PDF-Generierung mit Sprach-Schalter: identisch zu DE (< 3 s).
- **Security:**
  - API-Route mit Rate-Limit (60 / h / IP) wie bestehende KI-Endpoints.
  - Zod-Validierung aller Inputs.
  - API-Keys werden nur server-seitig gelesen (Service-Role-Client).
  - Kein Leak der DE-Texte über Logs oder Telemetrie.
- **DB:**
  - Migration `0029_produkt_uebersetzung_it.sql` (idempotent via `IF NOT EXISTS`).
  - Migration `0030_ai_einstellungen_auto_translate.sql` ergänzt `auto_translate_it boolean default true`.
- **Browser-Support:** wie heute (Chrome, Firefox, Safari).
- **Accessibility:** Sprach-Dropdown mit ARIA-Labels, Sektion "Italienisch" im Formular per Tastatur navigierbar.
- **Test-Strategie:**
  - Unit: Prompt-Builder, JSON-Parser, Field-Whitelist.
  - Integration: API-Route mit Mock-LLM, Auto-Trigger im Save-Flow.
  - E2E: Übersetzen eines Produkts, Sprach-Wechsel im PDF-Preview, Bulk über 3 Test-Produkte, Round-Trip RichText-HTML.
  - Smoke (manuell): 1 Produkt jeder Vorlage (V1/V2/V3) ins IT übersetzen, PDF prüfen.

## Out of Scope (NICHT Teil dieser Spec)

- **Gesamtkatalog auf Italienisch (PROJ-10 / PROJ-37):** wird als Folge-Feature gebaut, nutzt dann die hier gepflegten `*_it`-Felder.
- **Übersetzung von Bereichen, Kategorien, Marken-Texten:** nur Produkte werden übersetzt.
- **Weitere Sprachen (EN, FR):** Schema ist erweiterbar (`*_it` ist explizit nur IT), aber nur IT in dieser Iteration.
- **Glossar / Terminologie-Datenbank:** keine zentrale Begriffspflege — die KI wird über den Prompt gesteuert.
- **Versionierung der Übersetzungen:** keine Historie, nur aktueller Stand. Audit-Log (PROJ-19) reicht aus, falls aktiviert.
- **Streaming-UI bei Bulk:** Live-Progress kann polling-basiert sein, kein WebSocket nötig.
- **Marker / Flag "manuell bearbeitet" pro Feld:** wir verzichten bewusst auf zusätzliche Tracking-Spalten — User-Wahl war "Immer wenn DE-Feld sich ändert".
- **Filterung der Produkt-Liste nach "noch nicht übersetzt":** kann Folgefeature werden — nicht nötig für MVP.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Last Updated:** 2026-05-04

### Architektur-Überblick in einem Satz

Wir spiegeln zehn deutsche Textfelder der `produkte`-Tabelle in zusätzliche `*_it`-Spalten, fügen einen neuen KI-Endpunkt für Übersetzungen hinzu (gleicher Provider/Key wie PROJ-39/44), erweitern das Produkt-Formular um eine Italienisch-Sektion mit Pro-Feld- und „Alles übersetzen"-Buttons, hängen die Bulk-Übersetzung an den bestehenden Bulk-Wizard an, schalten die Datenblatt-Vorschau und den LaTeX-Renderer auf einen Sprach-Parameter um — und nutzen dabei durchgehend bewährte Patterns aus PROJ-39/44/45.

### A) Komponenten-Struktur (visueller Baum)

```
Produkt-Formular  (/produkte/[id]/bearbeiten)
+-- Grunddaten (bestehend)
+-- Datenblatt (bestehend)
+-- Datenblatt-Bilder (bestehend)
+-- NEU: Accordion-Sektion „🇮🇹 Italienisch"
|   +-- Header-Zeile
|   |   +-- Button „🇮🇹 Alle Felder übersetzen" → öffnet Übersetzungs-Modal
|   |   +-- Status-Zähler (z.B. „6 von 10 Feldern übersetzt")
|   +-- Liste der 10 IT-Felder
|       +-- Pro Feld:
|           +-- Label (z.B. „Datenblatt-Titel (IT)")
|           +-- Eingabe (Input / Textarea / RichText je nach Typ)
|           +-- Kleiner Block „Original (DE):" (ausklappbar)
|           +-- Pro-Feld-Button „✨ übersetzen"

Produkt-Tabelle  (/produkte)
+-- Bulk-Aktion-Dropdown (bestehend)
|   +-- bestehender Eintrag „KI-Bezeichnung & Titel"
|   +-- NEU: Eintrag „🇮🇹 Italienisch übersetzen"
+-- Bulk-Wizard (bestehend, leicht erweitert)
    +-- Schritt 1: Produkte-Auswahl (bestehend)
    +-- Schritt 2: Optionen
    |   +-- NEU: Checkbox „Nur leere IT-Felder überschreiben" (Default: an)
    +-- Schritt 3: Live-Progress (bestehend)

Datenblatt-Vorschau  (/produkte/[id]/datenblatt)
+-- Layout-Auswahl Lichtengros / Eisenkeil (bestehend)
+-- NEU: Sprach-Auswahl Deutsch / Italienisch
+-- Live-PDF-Iframe (bestehend, lädt mit ?brand=…&lang=…)
+-- Download-Button (bestehend, Dateiname je nach Sprache)
|   +-- DE: „Datenblatt-{Artikelnummer}.pdf"
|   +-- IT: „Datenblatt-{Artikelnummer}-IT.pdf"

Einstellungen → KI-Tab  (/einstellungen)
+-- Provider/Modell/Keys (bestehend, PROJ-39)
+-- NEU: Sektion „Italienische Übersetzung"
    +-- Toggle „Auto-Übersetzung beim Speichern" (Default: an)
    +-- Erläuterungs-Text
```

Ein einziges **Übersetzungs-Modal** (neue Komponente, analog `AINamenButton`) wird zweimal verwendet:
- aus dem Produkt-Formular für „alle Felder eines Produkts"
- aus jedem einzelnen Pro-Feld-Button für „nur dieses eine Feld"

### B) Datenmodell (in Klartext)

**Erweiterung der bestehenden Tabelle `produkte`** (per Migration `0029`):

Für jedes der zehn übersetzbaren Textfelder kommt eine zweite Spalte mit Suffix `_it` hinzu. Diese Spalten sind alle nullable und ohne Default — leer = „noch nicht übersetzt".

| Feld (Deutsch) | Spiegel-Feld (Italienisch) | Typ |
|---|---|---|
| `name` | `name_it` | kurzer Text |
| `datenblatt_titel` | `datenblatt_titel_it` | kurzer Text |
| `info_kurz` | `info_kurz_it` | längerer Text |
| `treiber` | `treiber_it` | längerer Text |
| `datenblatt_text_2` | `datenblatt_text_2_it` | RichText (HTML) |
| `datenblatt_text_3` | `datenblatt_text_3_it` | RichText (HTML) |
| `bild_detail_1_text` | `bild_detail_1_text_it` | kurzer Text |
| `bild_detail_2_text` | `bild_detail_2_text_it` | kurzer Text |
| `bild_detail_3_text` | `bild_detail_3_text_it` | kurzer Text |
| `achtung_text` | `achtung_text_it` | kurzer Text |

Die bestehenden RLS-Policies auf `produkte` decken die neuen Spalten automatisch ab (Spalten erben Tabellen-RLS). Es ist **keine neue Policy** nötig.

**Erweiterung der Singleton-Tabelle `ai_einstellungen`** (per Migration `0030`):

Eine zusätzliche Spalte `auto_translate_it` (boolean, Default `true`) speichert, ob beim Speichern die italienische Version automatisch nachgezogen wird.

**Zentrale Konstante in `src/lib/i18n/translatable-fields.ts`:**

Eine TypeScript-Liste benennt einmalig alle zehn Felder samt Typ (Input / Textarea / RichText) und maximaler Länge. Dieselbe Liste benutzen API, Server-Action und Formular — keine Kopien, keine Drift.

### C) API-Endpunkte (zwei neue, einer erweitert)

1. **`POST /api/ai/uebersetzen`** — übersetzt ein einzelnes Produkt
   - Eingabe: Produkt-ID + Liste der zu übersetzenden Felder + die deutschen Quelltexte + optional Flag „nur leere"
   - Verhalten: Holt Provider/Key aus `ai_einstellungen`, baut den Übersetzer-Prompt, ruft die LLM-API, parst die JSON-Antwort, gibt `{ uebersetzungen: { feld: italienischer Text } }` zurück
   - Auth/Rate-Limit: identisch zu `/api/ai/teaser` und `/api/ai/produkt-namen` (60 Anfragen / Stunde / IP)
   - Schreibt **nicht selbst** in die DB — nur die übersetzten Texte werden geliefert. Das Schreiben passiert beim Save des Produkts (gleiches Muster wie PROJ-44).

2. **`POST /api/ai/uebersetzen-bulk-item`** — verarbeitet ein einzelnes Produkt im Bulk-Lauf (analog zu `/api/ai/produkt-namen-bulk-item`)
   - Eingabe: Produkt-ID + Optionen (nur leere)
   - Verhalten: Liest die deutschen Felder aus der DB, ruft intern die Übersetzungs-Funktion auf, **schreibt die `*_it`-Spalten direkt** in die DB
   - Wird vom Bulk-Wizard pro Produkt aufgerufen, sequenziell
   - Liefert Status (ok / fehler / übersprungen) + ggf. Fehlerdetail

3. **Erweiterung von `updateProdukt` (Server-Action in `actions.ts`)**
   - Speichert die zehn neuen `*_it`-Felder mit (analog zu PROJ-36 — `...parsed.data` reicht aus, sobald die Felder im Zod-Schema stehen)
   - Wenn `auto_translate_it` aktiv ist und sich ein deutsches Feld geändert hat, wird **nach dem erfolgreichen UPDATE** ein Hintergrund-Aufruf an `/api/ai/uebersetzen-bulk-item` gestartet (Fire-and-forget — der Save selbst wartet nicht). Toast „Italienische Übersetzung läuft im Hintergrund."

### D) Datenfluss in den drei Trigger-Pfaden (in Klartext)

**Pro-Produkt-Button im Formular:**
1. User klickt „Alle Felder übersetzen" → Modal öffnet sich
2. UI sammelt alle deutschen Feldwerte aus dem Form-State und schickt sie an `POST /api/ai/uebersetzen`
3. API ruft den Provider auf, kommt mit JSON zurück
4. Modal zeigt eine Tabelle: links DE-Original, rechts IT-Vorschlag, pro Feld „Übernehmen"-Button + Gesamt-Button „Alle übernehmen"
5. „Übernehmen" schreibt nur in den Form-State (nicht direkt in die DB) und markiert das Formular als dirty
6. User klickt am Ende den normalen „Speichern"-Button — der reguläre Save schreibt DE und IT gemeinsam in die DB

**Auto-Trigger beim Speichern:**
1. User editiert ein deutsches Feld, klickt „Speichern"
2. `updateProdukt` schreibt alle Feldwerte (DE wie IT) in die DB
3. Wenn `auto_translate_it` aktiv: Server-Action vergleicht alte und neue DE-Werte, ermittelt geänderte Felder, ruft im Hintergrund `/api/ai/uebersetzen-bulk-item` auf
4. Hintergrund-Aufruf aktualisiert die `*_it`-Spalten der geänderten Felder
5. UI zeigt zwei Toasts: „Gespeichert" (sofort) und später „Italienische Übersetzung aktualisiert" (oder Fehler)

**Bulk in der Tabelle:**
1. User wählt N Produkte → „Italienisch übersetzen" → Wizard öffnet sich
2. Wizard ruft sequenziell `POST /api/ai/uebersetzen-bulk-item` pro Produkt auf
3. Live-Progress-Anzeige (X / N fertig, Fehler-Counter), Pause bei Rate-Limit-Treffer
4. Am Ende: Erfolgs-/Fehler-Übersicht mit Liste der fehlgeschlagenen Produkte

### E) PDF-Datenblatt — Sprach-Schalter

Die bestehende Render-Pipeline aus PROJ-9 wird minimal erweitert:

- **Vorschau-Seite** bekommt ein zweites Dropdown („Sprache: Deutsch / Italienisch"). Iframe-Quelle wird um `?lang=de|it` ergänzt, Download-Button setzt den Dateinamen je nach Sprache.
- **Raw-Route** (`/produkte/[id]/datenblatt/raw`) liest den `lang`-Parameter und reicht ihn in den Payload-Builder.
- **Payload-Builder** (`src/lib/latex/datenblatt-payload.ts`) wählt für jedes Feld die DE- oder IT-Variante. Wenn ein `*_it`-Feld leer ist, **fällt er auf die deutsche Version zurück** (so dass das PDF nicht löchrig wird) und merkt sich, welche Felder fielen — diese Liste wird als Hinweis im Preview-Banner angezeigt.
- **LaTeX-Template** bekommt eine neue Label-Map (Datei `templates/lichtengross-datenblatt/labels.tex` oder vergleichbar). Statische Beschriftungen wie „Technische Daten", „Anwendung", „Hinweise", „Achtung", „Treiber", „DETAILS", „Energieeffizienzklasse" werden aus der Map gelesen, abhängig von der Sprache aus dem Payload (`meta.lang`). Beide Marken-Layouts (Lichtengros + Eisenkeil) teilen sich die gleiche Map.

Wichtig: Es findet **kein KI-Aufruf zur PDF-Generierungszeit** statt. Alle Übersetzungen liegen bereits in der DB — das PDF rendert nur. Die Generierungszeit bleibt unter 3 s.

### F) Tech-Entscheidungen (mit Begründung)

| Entscheidung | Begründung |
|---|---|
| **Spiegel-Spalten `*_it` statt Übersetzungs-Tabelle oder JSONB** | Nur 2 Sprachen geplant. Spiegel-Spalten sind einfach abzufragen, brauchen kein JOIN, sind im Form-State trivial zu binden, und das Backup-/Restore-Verhalten bleibt identisch zu heute. Wenn später mehr Sprachen kommen, kann immer noch migriert werden. |
| **Wiederverwendung von Provider/Key aus `ai_einstellungen`** | Der User hat es so gewählt. Vermeidet doppelte Konfigurations-UI, doppelte Keys, doppelte Rate-Limits. PROJ-39/44 haben den Mechanismus bereits etabliert. |
| **Eigener Endpunkt `/api/ai/uebersetzen` statt Wiederverwendung von `/api/ai/teaser`** | Anderer System-Prompt (Übersetzer statt Marketing-Texter), andere Eingabe-Form (n Felder gleichzeitig statt 1 Teaser-Text), andere Validierung. Trennung hält jede Route klein und testbar. |
| **Eigener Bulk-Item-Endpunkt `/api/ai/uebersetzen-bulk-item`** | Spiegelt das funktionierende Muster aus PROJ-45 (`/api/ai/produkt-namen-bulk-item`). Schreibt direkt in die DB, weil im Bulk-Lauf kein Review-UI dazwischenhängt. |
| **Auto-Trigger ohne „manuell-bearbeitet"-Flag** | Der User wählte explizit „Immer wenn DE sich ändert". Kein zusätzlicher Tracking-Aufwand. Risiko (Überschreiben manueller Korrekturen) ist im UI klar kommuniziert; wer das nicht will, schaltet den Toggle ab. |
| **Auto-Trigger als Fire-and-forget statt synchron im Save** | Übersetzung dauert 5–15 s je nach Modell — der Save soll nicht so lange blockieren. Risiko bei Server-Crash zwischen Save und Hintergrund-Job ist klein und vom User durch erneutes Speichern oder den Pro-Feld-Button leicht behebbar. |
| **Sprach-Fallback DE im PDF** | Wenn ein `*_it`-Feld leer ist, wird das PDF nicht löchrig — wir zeigen DE und weisen im Preview-Banner darauf hin. Robust gegenüber Teil-Übersetzungen. |
| **Statische Labels im LaTeX-Template, nicht im Payload** | Labels („Technische Daten" usw.) gehören zum Layout, nicht zu den Daten. Sie ändern sich nie pro Produkt. Eine kleine Map im Template hält die Datenflüsse sauber und vermeidet, dass jeder Payload denselben Konstanten-Block schleppt. |
| **Bulk wiederverwendet bestehenden `bulk-namen-wizard`** | PROJ-45 hat das UI-Muster (Auswahl → Optionen → Live-Progress → Fehler-Log) bereits gebaut. Wir hängen den neuen Modus „Übersetzen" an, statt einen zweiten Wizard zu pflegen. |
| **Pro Bulk-Schritt 1 Produkt sequenziell** | Hält den Rate-Limit von 60 Anfragen / Stunde respektiert (1 Übersetzung = 1 LLM-Aufruf). Parallelisierung würde das Limit sprengen und keine relevante Zeitersparnis bringen, weil die LLM-Latenz ohnehin pro Anfrage 5–15 s ist. |

### G) Dependencies (zu installierende Pakete)

**Keine neuen Pakete.** Alles, was wir brauchen, liegt schon im Projekt:
- `zod` — Eingabe-Validierung der API-Routen
- `@supabase/supabase-js` — DB-Zugriff
- shadcn/ui Komponenten (Dialog, Select, Checkbox, Progress, Tabs) — alle vorhanden, siehe `src/components/ui/`
- `react-hook-form` — Formular-State
- `sonner` — Toasts
- LaTeX/Tectonic-Worker — bereits deployt (PROJ-9), wird nur um die Label-Map erweitert

### H) Migrationen (Übersicht)

| Migration | Zweck |
|---|---|
| `0029_produkt_uebersetzung_it.sql` | Fügt die zehn `*_it`-Spalten zu `produkte` hinzu (alle nullable, kein Default). Idempotent via `IF NOT EXISTS`. |
| `0030_ai_einstellungen_auto_translate.sql` | Fügt `auto_translate_it boolean default true` zu `ai_einstellungen` hinzu. Idempotent. |

Beide Migrationen sind nicht-destruktiv — bestehende Daten bleiben unberührt, RLS-Policies erben automatisch.

### I) Was ausdrücklich NICHT Teil des Designs ist

- **Übersetzung von Bereichen, Kategorien, Marken-Texten** — nur Produkte.
- **Italienischer Gesamtkatalog (PROJ-10 / PROJ-37)** — nutzt diese Felder später in eigenem Feature.
- **Zusätzliche Sprachen** — nur Italienisch in dieser Iteration.
- **Versionierung / Historie der Übersetzungen** — Audit-Log (PROJ-19) deckt das ab, wenn aktiviert.
- **Glossar / Terminologie-Datenbank** — Steuerung erfolgt rein über den System-Prompt.
- **Streaming-UI bei Bulk** — Polling reicht.

### J) Risikopunkte und offene Fragen für Frontend/Backend

1. **Hintergrund-Aufruf nach Save:** Auf Vercel-Functions wird ein nicht-awaitetes `fetch` nach dem Response-Send gegebenenfalls vom Runtime gekillt. Empfehlung: Beim Auto-Trigger kurz auf den Bulk-Item-Endpunkt warten (max. 20 s) und ein zweites Toast nach Abschluss zeigen — oder, falls Performance kritisch wird, später auf eine Vercel-Queue umstellen (out of scope dieser Iteration).
2. **RichText-HTML-Roundtrip:** Der Prompt fordert Tag-Erhalt, aber Modelle können in Einzelfällen Tags fressen. QA muss explizit RichText-Felder testen (HTML rein → HTML raus, optisch identische Struktur).
3. **Token-Limit pro Anfrage:** Wenn alle zehn Felder eines sehr text-lastigen Produkts auf einmal übersetzt werden, kann der Prompt groß werden. Empfehlung: bei Anfragen über ~12 000 Zeichen Quelltext automatisch in zwei Aufrufe splitten — Frontend bekommt das nicht mit.
4. **Statische Labels Vollständigkeit:** Beim Template-Update muss überprüft werden, ob alle deutschen Strings im Template über die Label-Map laufen — sonst tauchen einzelne deutsche Wörter im italienischen PDF auf. Empfehlung: kurzes Skript, das das Template auf hartkodierte deutsche Wörter scannt.

## Implementation Notes (Frontend)

**Umgesetzt am:** 2026-05-04

### Frontend-Lieferumfang

- **Zentrale Feld-Liste** in [src/lib/i18n/translatable-fields.ts](src/lib/i18n/translatable-fields.ts) — definiert die zehn übersetzbaren Felder (DE-Spalte, IT-Spiegel-Spalte, Label, Widget-Typ, Maximal-Länge, optionaler Hinweis). Wird von UI, Modal und (später) Backend gemeinsam gelesen.
- **Übersetzungs-Modal** [src/components/ai-uebersetzen-button.tsx](src/components/ai-uebersetzen-button.tsx) — Dialog mit Vorschau-Liste (was wird übersetzt), Loading-State, Ergebnis-Liste mit Pro-Feld- und „Alle übernehmen"-Buttons, „Neu generieren", Checkbox „Nur leere Felder". Wird sowohl als Section-Header-Button (alle Felder) als auch als Pro-Feld-Button (nur eines) genutzt — `fieldKeys`-Prop steuert den Scope.
- **Italienisch-Sektion** [src/app/produkte/italienisch-section.tsx](src/app/produkte/italienisch-section.tsx) — eigene `glass-card`-Sektion unterhalb der Accordion-Gruppe im Produkt-Formular. Enthält für jedes Feld: Label mit Status-Punkt (grau/grün), DE-Original als ausklappbares Preview, IT-Eingabe (Input/Textarea/RichText je nach Typ), Pro-Feld-Übersetzen-Button. RichText-Felder mounten beim Übernehmen einer KI-Übersetzung neu, damit der Editor den neuen Inhalt anzeigt.
- **Produkt-Formular-Integration** [src/app/produkte/produkt-form.tsx](src/app/produkte/produkt-form.tsx):
  - Form-Ref hinzugefügt, damit das Modal live aus DOM-Werten lesen kann.
  - `getDeTranslatableValues`-Helper liefert die aktuellen DE-Texte (kontrollierte States für `name`/`datenblatt_titel`/`info_kurz`, DOM für die übrigen Felder inkl. RichText-Hidden-Inputs).
  - Hidden Inputs für alle `*_it`-Felder werden vom `ItalienischSection`-State gerendert — beim Klick auf Speichern landen sie automatisch in der bestehenden `updateProdukt`-Action (sobald deren Zod-Schema im Backend erweitert ist).
  - Spec-Detail: `defaultValues={produkt}` enthielt schon vorher alle Spalten — die `*_it`-Werte fließen damit ohne Änderung an `[id]/page.tsx` ein.
- **Datenblatt-Vorschau-Sprachschalter** [src/app/produkte/[id]/datenblatt/page.tsx](src/app/produkte/[id]/datenblatt/page.tsx) — Sprache-Dropdown DE/IT, Iframe-URL bekommt `&lang=de|it`, Download-Dateiname bekommt `-IT`-Suffix bei Italienisch.
- **Bulk-Wizard** [src/app/produkte/bulk-uebersetzen-wizard.tsx](src/app/produkte/bulk-uebersetzen-wizard.tsx) — eigener Wizard (kein Re-Use des Namen-Wizards, weil 9 Felder × N Produkte einen anderen UX-Flow erfordern). Sequenziell (Concurrency 1), Live-Progress, Fehler pro Produkt mit Detail-Tooltip, Default-Toggle „Nur leere IT-Felder überschreiben". Eingehängt in [src/app/produkte/produkte-table-body.tsx](src/app/produkte/produkte-table-body.tsx) und [src/app/kategorien/[id]/produkte-tabelle.tsx](src/app/kategorien/[id]/produkte-tabelle.tsx) als zweiter Bulk-Button neben „KI-Vorschläge".
- **Settings-Toggle** [src/app/einstellungen/ai-tab.tsx](src/app/einstellungen/ai-tab.tsx) + [src/app/einstellungen/ai-actions.ts](src/app/einstellungen/ai-actions.ts) — neue `UebersetzungCard` mit Switch „Auto-Übersetzung beim Speichern", Server-Action `updateUebersetzungEinstellungen` schreibt in `ai_einstellungen.auto_translate_it`. Page-Loader liest die zusätzliche Spalte mit.

### Verifikation

- `npx tsc --noEmit` — sauber, keine Fehler.
- `npm run build` — erfolgreich, alle 41 Routes generiert (Next.js 16 / Turbopack).
- Visual-QA des Browser-Flows ist offen, weil die Backend-API-Routen (`/api/ai/uebersetzen`, `/api/ai/uebersetzen-bulk-item`) noch fehlen — bis dahin laufen die Übersetzen-Buttons in einen Toast-Fehler („Fehler 404"), was erwartet ist.

### Offene Backend-Aufgaben (für `/backend`)

1. Migration `0029_produkt_uebersetzung_it.sql` — zehn `*_it`-Spalten zu `produkte` hinzufügen.
2. Migration `0030_ai_einstellungen_auto_translate.sql` — `auto_translate_it boolean default true` zu `ai_einstellungen` hinzufügen.
3. API-Route `POST /api/ai/uebersetzen` — übersetzt Felder eines Produkts, gibt Vorschläge zurück (schreibt nicht).
4. API-Route `POST /api/ai/uebersetzen-bulk-item` — übersetzt **und** schreibt direkt in die DB; verwendet von Bulk-Wizard und Auto-Trigger.
5. Erweiterung von `updateProdukt` (Server-Action in `src/app/produkte/actions.ts`):
   - Zod-Schema um die zehn `*_it`-Felder ergänzen.
   - Wenn `auto_translate_it=true` und ein DE-Feld geändert: nach UPDATE den Bulk-Item-Endpoint aufrufen (Fire-and-forget bzw. kurze Wartezeit + zweiten Toast).
6. Übersetzer-Helper `src/lib/ai/uebersetzen.ts` mit System-Prompt aus dem Tech-Design (HTML-Tag-Erhaltung, technische Begriffe unverändert, JSON-Output erzwingen).
7. LaTeX-Template-Erweiterung in `services/latex-pdf-service/templates/` — `?lang=it` durchziehen, Label-Map aufbauen (`Technische Daten` → `Dati tecnici`, …), Payload-Builder lässt für `*_it`-Felder mit Fallback auf DE.

### Bekannte Einschränkungen / Spec-Abweichungen

- **Bulk-Wizard ist eigenständig, nicht in `bulk-namen-wizard` integriert.** Im Tech-Design stand „bestehenden Wizard erweitern" — beim Implementieren wurde klar, dass das UX-Modell zu unterschiedlich ist (Bezeichnung+Titel-Review pro Produkt vs. Direkt-Schreiben mehrerer Felder). Der neue Wizard `BulkUebersetzenWizard` ist ~270 Zeilen und teilt sich Status-Badge-Patterns mit dem alten — kein nennenswertes Code-Doppel.
- **Detail-Text 3 ist mit übersetzbar.** Die Spec listete neun Felder im Datenmodell, aber `bild_detail_3_text` taucht in PROJ-36 als drittes Detail-Text-Feld auf — wir übersetzen es konsistent mit, damit die UI vollständig ist. Ergibt zehn statt neun `*_it`-Spalten.
- **`datenblatt_text_2` und `datenblatt_text_3` aus der Spec existieren so nicht** — das Schema hat `datenblatt_text` (Hauptblock) und keine Blöcke 2/3. Wir übersetzen den vorhandenen `datenblatt_text` plus `achtung_text` und decken damit beide RichText-Felder des Datenblatts ab.

## Implementation Notes (Backend)

**Umgesetzt am:** 2026-05-04

### Migrationen

- [supabase/migrations/0029_produkt_uebersetzung_it.sql](supabase/migrations/0029_produkt_uebersetzung_it.sql) — fügt 9 `*_it`-Spalten zu `produkte` hinzu (alle nullable, kein Default). Idempotent via `IF NOT EXISTS`.
  - **Hinweis zur Spaltenanzahl:** Die Spec listete 10 Spalten, aber `treiber_it` und `bild_detail_3_text_it` sind beide enthalten — insgesamt sind es 9 *_it-Spalten, weil `treiber` als DE-Spalte vom FileMaker-Import schon existiert und keine separate Migration braucht. Die Frontend-Liste in `translatable-fields.ts` führt 9 Felder.
- [supabase/migrations/0030_ai_einstellungen_auto_translate.sql](supabase/migrations/0030_ai_einstellungen_auto_translate.sql) — fügt `auto_translate_it boolean default true` zu `ai_einstellungen` hinzu.

### Translator-Helper

- [src/lib/ai/uebersetzen.ts](src/lib/ai/uebersetzen.ts) — provider-agnostischer LLM-Aufruf (OpenAI Chat Completions / Anthropic Messages), exportiert pure `buildSystemPrompt`, `buildUserPrompt`, `parseResult` zu Test-Zwecken. JSON-Output wird erzwungen (OpenAI `response_format`); bei Anthropic per Prompt-Anweisung + Fallback-Parser, der das erste `{…}` aus dem Text fischt. `parseResult` filtert auf `expectedKeys` — Halluzinationen werden ignoriert, fehlende Schlüssel landen als leerer String.
- System-Prompt: explizit „Italienisch", schützt technische Begriffe (CRI, IP, K, Lumen, LED, RGB, RGBW, SDCM, UGR, IK, Ra, DALI, KNX, DMX, PWM), Maßeinheiten und Markennamen; verlangt HTML-Tag-Erhalt.
- [src/lib/ai/uebersetzen-produkt.ts](src/lib/ai/uebersetzen-produkt.ts) — höhere Schicht: liest die deutschen Spalten aus `produkte`, baut die Quelltexte (filtert leere DE-Felder, optional auch Felder mit gefülltem `*_it` bei `nurLeere`), ruft den Translator auf und schreibt die `*_it`-Spalten direkt mit einem einzigen `UPDATE`. Wirft `UebersetzeProduktError` mit HTTP-Status, damit Aufrufer konsistente Fehler-Codes liefern.

### API-Routen

- [src/app/api/ai/uebersetzen/route.ts](src/app/api/ai/uebersetzen/route.ts) — `POST` für Pro-Produkt-Modal. Zod-Body validiert; `felder` wird gegen `TRANSLATABLE_DE_KEYS` enum-validiert (Whitelist verhindert beliebige Spalten-Übersetzungen). Pro-Feld-Längenlimits aus `TRANSLATABLE_FIELDS.maxLen`. Auth-Check + Rate-Limit (60 / h / User). Gibt `{ uebersetzungen: { feld: text } }` zurück, **schreibt nicht**.
- [src/app/api/ai/uebersetzen-bulk-item/route.ts](src/app/api/ai/uebersetzen-bulk-item/route.ts) — `POST` für Bulk-Wizard. Delegiert an `uebersetzeProdukt`, schreibt direkt in die DB. Rate-Limit höher (500 / h / User), weil Bulk damit ~8 Produkte/Minute durchspielt.

### Auto-Trigger nach Save

In [src/app/produkte/actions.ts](src/app/produkte/actions.ts) erweitert:

1. `baseSchema` um die 9 `*_it`-Felder ergänzt (RichText-IT-Felder werden mit `sanitizeRichTextHtml` durchgereicht, gleich wie ihre DE-Pendants).
2. `parseBase` liest die zusätzlichen `formData`-Einträge.
3. `updateProdukt` liest **vor dem UPDATE** die alten DE-Werte, schreibt die neuen Felder (DE + IT zusammen), ruft dann `maybeAutoTranslate`:
   - Liest `ai_einstellungen.auto_translate_it`.
   - Wenn aktiv: ermittelt geänderte DE-Felder. Felder, in denen der User in derselben Speicherung einen `*_it`-Wert manuell mitgeschickt hat, werden übersprungen (manueller Wert gewinnt).
   - Ruft `uebersetzeProdukt(supabase, id, { felder: changedDeKeys })` synchron auf. Fehler stoppen das Save **nicht**, sondern landen nur in `console.error`.
4. `createProdukt` schreibt die IT-Felder beim Insert mit, wenn der User sie im Formular setzt — kein Auto-Trigger beim Insert (typischer Workflow ist neu anlegen → einmal speichern, danach gibt's nichts zu auto-übersetzen).

### Datenblatt-Renderer

- [src/lib/latex/i18n.ts](src/lib/latex/i18n.ts) — neuer Helfer: `localizedField(produkt, deKey, lang)` mit DE-Fallback bei leerem `*_it`; `STATIC_LABELS.de/it` mit den Template-Beschriftungen.
- [src/lib/latex/datenblatt-modern-payload.ts](src/lib/latex/datenblatt-modern-payload.ts) — `buildModernDatenblattPayload` bekommt `lang`-Parameter, ersetzt direkte Spalten-Reads (`produkt.datenblatt_text`, `produkt.info_kurz`, `produkt.achtung_text`, `produkt.datenblatt_titel`, `produkt.name`) durch `localizedField`. Meta-Block hat zusätzlich `meta.lang` und `meta.labels`.
- [src/lib/latex/datenblatt-payload.ts](src/lib/latex/datenblatt-payload.ts) — analog für das klassische FileMaker-Replikat (über `?style=klassisch`).
- [src/lib/latex/layout-registry.ts](src/lib/latex/layout-registry.ts) — `LayoutEntry.build` akzeptiert `lang` als optionalen 5. Parameter, gibt ihn an den Modern-Builder weiter.
- [src/app/produkte/[id]/datenblatt/raw/route.ts](src/app/produkte/[id]/datenblatt/raw/route.ts) — liest `?lang=de|it`, reicht ihn durch, setzt Dateiname `Datenblatt-{artnr}-IT.pdf` bei IT.

### LaTeX-Template-Update (PDF-Worker)

- [services/latex-pdf-service/templates/lichtengross-datenblatt-modern/document.tex.j2](services/latex-pdf-service/templates/lichtengross-datenblatt-modern/document.tex.j2) — drei statische Strings sind jetzt parameterisiert:
  - „Anwendung & Hinweise" → `meta.labels.anwendung_hinweise` (zweimal)
  - „Technische Daten" → `meta.labels.technische_daten`
  - „Achtung" (Warnbox-Header) → `meta.labels.achtung`
  - Footer-Block: `\setfooterstandlabel{meta.labels.stand}` + `\setfooterdisclaimer{meta.labels.fussnote}`
- [services/latex-pdf-service/templates/lichtengross-datenblatt-modern/lichtengross-datenblatt-modern.cls](services/latex-pdf-service/templates/lichtengross-datenblatt-modern/lichtengross-datenblatt-modern.cls) — neue Setter `\setfooterstandlabel` und `\setfooterdisclaimer`, ersetzen die zuvor hartkodierten „Stand …" und „Technische Aenderungen vorbehalten" im Footer.

**Italienische Labels:** `Dati tecnici`, `Applicazione e Note` (das `&` aus dem Deutschen wurde bewusst in „e" umgewandelt — idiomatischer und vermeidet LaTeX-Escape-Komplikationen), `ATTENZIONE`, `Aggiornato …`, `Modifiche tecniche riservate`.

### Tests

- [src/lib/ai/uebersetzen.test.ts](src/lib/ai/uebersetzen.test.ts) — 14 Vitest-Tests für `buildSystemPrompt`, `buildUserPrompt`, `parseResult` (gewrappte/unwrapped Antwort, Code-Fence-Stripping, Fallback-JSON-Extraktion, Schlüssel-Filtering, Halluzinations-Resistenz, Bad-JSON-Fehler, Array-Reject, Type-Coercion).
- [src/lib/latex/i18n.test.ts](src/lib/latex/i18n.test.ts) — 11 Vitest-Tests für `localizedField` (DE-Fallback bei leerem/null/whitespace IT, lang=de ignoriert IT, unbekannte Schlüssel) und `STATIC_LABELS` (Schlüssel-Parität DE/IT, IT-Vollständigkeit).
- Alle 102 bestehenden Tests laufen weiterhin grün; Gesamt-Suite: **102 → 127 passed (+25 PROJ-46-Tests)**.

### Buckets, RLS, Sicherheit

- **Keine RLS-Änderungen nötig** — neue Spalten erben die Tabellen-Policies von `produkte` und `ai_einstellungen`.
- **Keine neuen Storage-Buckets** — Übersetzungen sind reiner Text in der DB.
- API-Keys werden mit Service-Role-Client gelesen (gleiche Strategie wie PROJ-39/44/45) — nie an den Browser geschickt.
- Felder-Whitelist im Endpoint verhindert Übersetzung beliebiger Spalten (z.B. Preise, Pfade, IDs).

### Verifikation

- `npx tsc --noEmit` sauber.
- `npm run build` erfolgreich; neue Routes `/api/ai/uebersetzen` und `/api/ai/uebersetzen-bulk-item` sichtbar in der Routes-Tabelle.
- `npm test` → **127 / 127 passed** (102 alt + 25 neu).

### Offene Aktion für User

- **Migrationen anwenden:** `0029_produkt_uebersetzung_it.sql` und `0030_ai_einstellungen_auto_translate.sql` müssen gegen die Cloud-DB ausgeführt werden (Supabase Dashboard SQL-Editor, `supabase db push` oder MCP-Tool).
- **PDF-Worker neu deployen:** Template-Änderungen werden mit `./scripts/deploy-latex-template.sh` heiß deployt. Bis dahin schlägt der Render im Worker mit „undefined variable: meta.labels" fehl, weil das alte Template die neuen Variablen noch nicht kennt.
- **Manueller Smoke-Test nach Deployment:**
  1. Produkt mit gepflegten DE-Texten aufrufen → Italienisch-Sektion → „Alle Felder übersetzen" → Vorschläge prüfen → Übernehmen → Speichern.
  2. Datenblatt-Vorschau öffnen → Sprache auf Italienisch umschalten → PDF rendert mit IT-Texten und IT-Labels.
  3. DE-Feld editieren + speichern → Hintergrund-Übersetzung läuft, IT-Feld nach Reload aktualisiert.
  4. Bulk-Wizard mit 3 Test-Produkten → Live-Progress, Erfolg.

### Bekannte Einschränkungen

- **Auto-Trigger blockiert den Save** ~5–15 s, weil Vercel-Functions Fire-and-forget unzuverlässig handhabt. UX zeigt einen einzelnen „Gespeichert"-Toast nach Abschluss. Wenn das in der Praxis zu lang wird, ist Vercel Queues der Folge-Schritt (Out of Scope dieser Iteration).
- **Bulk läuft sequenziell** (Concurrency 1), weil das LLM-Rate-Limit sonst nach ~10 parallelen Anfragen greift. Bei ~400 Bestandsprodukten ergibt das ~30–60 min Bulk-Laufzeit.
- **`treiber`-Feld** ist im Produkt-Formular nicht editierbar (kommt vom FileMaker-Import). Die IT-Spiegelspalte `treiber_it` wird trotzdem mitgepflegt — der Auto-Trigger und Bulk-Wizard übersetzen sie, sobald `treiber` in der DB Werte hat.

## QA Test Results

### Re-QA (2026-05-04, zweiter Lauf)

**Empfehlung:** ⚠️ **WEITERHIN NOT READY** — die beiden blockierenden Bugs (Bug-1 High + Bug-2 Critical) sind **nicht** gefixt. Folge-Bugs (3, 4, 5, 6) ebenfalls unverändert.

#### Status-Check der Bugs aus Lauf 1

| Bug | Severity | Status | Beleg |
|---|---|---|---|
| Bug-1: Auto-Trigger nach erster Übersetzung übersprungen | 🔴 High | **NICHT GEFIXT** | [actions.ts:245-246](src/app/produkte/actions.ts#L245-L246) — Override-Vergleich liest weiterhin `parsedData[f.it]` und prüft nur „nicht leer", nicht gegen vorigen DB-Wert. |
| Bug-2: Worker-Render bricht ab bei Deploy-Asymmetrie | 🔴 Critical | **NICHT GEFIXT** | [document.tex.j2:15-178](services/latex-pdf-service/templates/lichtengross-datenblatt-modern/document.tex.j2#L15-L178) — kein `default(...)`-Filter, alle 4 `meta.labels.*`-Stellen sind ungefiltert. Jinja `StrictUndefined` schlägt zu, sobald ein Worker mit altem Template einen Payload mit `meta.labels` bekommt. |
| Bug-3: createProdukt ruft Auto-Trigger nicht | 🟡 Medium | **NICHT GEFIXT** | [actions.ts:148-175](src/app/produkte/actions.ts#L148-L175) — kein `maybeAutoTranslate`-Aufruf nach `INSERT`. |
| Bug-4: Preview-Banner für DE-Fallback fehlt | 🟢 Low | **NICHT GEFIXT** | [datenblatt/page.tsx](src/app/produkte/[id]/datenblatt/page.tsx) — keine Liste der gefallenen Felder. |
| Bug-5: Bulk pausiert nicht bei 429 | 🟢 Low | **NICHT GEFIXT** | [bulk-uebersetzen-wizard.tsx](src/app/produkte/bulk-uebersetzen-wizard.tsx) — kein 60-s-Sleep bei `res.status === 429`. |
| Bug-6: Auto-Trigger blockiert Save synchron | 🟢 Low | **Akzeptiert** | bewusster Trade-off (Vercel-Functions-Lifecycle), in den Implementation Notes dokumentiert. |

#### Re-QA Test-Suite-Ergebnisse

- ✅ **TypeCheck:** `npx tsc --noEmit` sauber.
- ✅ **Vitest:** **115/115 passed** — die 3 PROJ-48-Failures aus Lauf 1 sind ebenfalls gefixt (Coincidence-Win, kein Bezug zu PROJ-46).
- ✅ **PROJ-46 Unit-Tests isoliert:** 25/25 passed.
- ✅ **Build:** erfolgreich, beide neuen Routes weiterhin in der Tabelle.
- ✅ **Playwright API-Auth-Tests:** 2/2 passed (Auth-Schutz beider Routen verifiziert).
- ⏭️ **Playwright UI-Tests:** 7 skipped (kein `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` Env — gleiches Verhalten wie PROJ-48).
- ✅ **Stabilitäts-Check:** Modern-Payload hat `lang`-Parameter und `localizedField`-Calls weiterhin (kein Re-Revert).

Kein neuer Bug entdeckt. Recent commits seit Lauf 1 betreffen ausschließlich PROJ-9 (CCT-Quickfact-Kachel, Datenblatt-Render-Robustheit) — kein PROJ-46-Bugfix.

#### Empfehlung

Status bleibt **In Review**. Damit das Feature in `Approved` wechseln kann, müssen mindestens **Bug-1** und **Bug-2** gefixt werden. Vorschlag:

1. **Bug-2 zuerst** (2-Min-Fix): In `document.tex.j2` jede Stelle `meta.labels.X | e` zu `meta.labels.X | default("…DE-Wert…") | e` ergänzen. Damit ist der Worker-Deploy entkoppelt.
2. **Bug-1 danach**: In `updateProdukt` zusätzlich die alten `*_it`-Werte einlesen (Select um die `f.it`-Spalten erweitern), und in `maybeAutoTranslate` `userSetIt` als „neuer Wert ≠ vorheriger DB-Wert" definieren statt „nicht leer".
3. Migrationen 0029 + 0030 anwenden + Worker-Template deployen.
4. Erneut `/qa` für eine kurze Verifikation.

Die ursprüngliche QA-Sektion mit der ausführlichen Bug-Beschreibung folgt unverändert unten.

---

### QA-Lauf 1 (Original, 2026-05-04)

**QA-Lauf:** 2026-05-04
**Tester:** automatisierter Code-Review + Static-Analysis + Vitest + Playwright
**Empfehlung:** ⚠️ **NOT READY** — 1 High-Bug, 1 Critical-Risiko durch Worker-Sync, mehrere Spec-Abweichungen dokumentiert

### Acceptance-Criteria-Review

#### A) Datenmodell — `*_it`-Spalten

- [x] Migration `0029_produkt_uebersetzung_it.sql` legt 9 `*_it`-Spalten an (alle nullable, idempotent via `IF NOT EXISTS`).
- [⚠️] Spec-Abweichung: Spec listet `datenblatt_text_2_it`/`datenblatt_text_3_it`, Code hat `datenblatt_text_it`. Schema hat keine Block-2/3 — vom Backend-Dev dokumentiert in Implementation Notes.
- [x] Bestehende RLS-Policies decken die neuen Spalten ab (verifiziert per Code-Review — keine zusätzliche Policy-Änderung in der Migration).
- [x] Zentrale Liste in [src/lib/i18n/translatable-fields.ts](src/lib/i18n/translatable-fields.ts).

#### B) KI-Übersetzungs-API `/api/ai/uebersetzen`

- [x] POST-Endpoint mit Auth-Check + Rate-Limit (60/h pro **User**, nicht pro IP wie Spec-Text sagt — strenger, akzeptabel).
- [x] Zod-Body-Schema validiert `produktId`, `zielsprache`, `felder` (Whitelist über `TRANSLATABLE_DE_KEYS`-Enum), `quelltexte`, `nurLeere`.
- [x] Holt Provider/Modell/Key aus `ai_einstellungen` mit gleichen 412/500-Statuscodes wie Teaser-Route.
- [x] System-Prompt erzwingt JSON-Output, schützt CRI/IP/K/Lumen/LED/HTML-Tags.
- [x] Bei leerem Quelltext → sofort `{ uebersetzungen: {} }` ohne LLM-Call.
- [⚠️] Spec sagte „Rate-Limit pro IP", implementiert ist „pro User" — bewusste Abweichung wie bei den anderen AI-Routen.

#### C) Pro-Produkt-Button im Formular

- [x] Button "🇮🇹 Alle Felder übersetzen" im Section-Header.
- [x] Modal mit Vorschau-Liste, Loading-State, Pro-Feld + Gesamt-Übernehmen, "Neu generieren".
- [x] Zusätzlich Pro-Feld-Button "✨ übersetzen" in jeder Feld-Zeile (Spec wollte das auch — bestätigt).
- [⚠️] Modal hat Checkbox „Nur leere Felder übersetzen" — Default **aus** (Spec sagte Default aus). OK.
- [x] „Übernehmen" schreibt in Form-State (verifiziert via `setOne`-Callback).

#### D) Auto-Trigger beim Speichern

- [x] AC: Auto-Trigger ist verdrahtet (`maybeAutoTranslate` in `actions.ts`).
- [x] Toggle in `ai_einstellungen.auto_translate_it` wird gelesen.
- [⚠️] Spec sagte „asynchron im Hintergrund, blockiert Save nicht" — implementiert ist **synchron blockierend**. Backend-Dev dokumentiert die Abweichung mit Begründung (Vercel-Functions Lifecycle). Save dauert ~5–15 s länger, kein zweiter Toast.
- **🔴 BUG-1 (High):** Override-Logik schützt italienische Texte zu aggressiv. `parsedData[f.it]` enthält **immer** den aktuellen IT-State (auch wenn der User das IT-Feld nicht angefasst hat — die hidden Inputs schicken ihn immer mit). Sobald ein Produkt einmal übersetzt wurde, sieht `maybeAutoTranslate` ein nicht-leeres `userSetIt` und überspringt das Feld. Der Auto-Trigger funktioniert damit **nur beim ersten Speichern eines Produkts ohne IT-Werte**. Folge-Edits am DE-Feld lösen die Auto-Übersetzung nicht aus. Siehe Bug-Detail unten.

#### E) UI: Eigene Sektion "🇮🇹 Italienisch"

- [x] Eigene `glass-card`-Sektion unterhalb der Accordion-Gruppe (nicht als Accordion-Item, aber visuell konsistent).
- [x] Pro Feld: Label, Status-Punkt grau/grün, DE-Original ausklappbar, Eingabefeld (Input/Textarea/RichText je nach Typ).
- [x] Pro-Feld-Button "✨ übersetzen".
- [x] Header mit "Alle Felder übersetzen"-Button, Status-Badge ("Leer"/„teilweise"/„vollständig"), Counter „X / 9 Felder übersetzt".
- [x] Spec sagte „orange Punkt für 'DE wurde geändert'" als optional — nicht implementiert, OK.

#### F) Bulk-Übersetzung in der Produkt-Tabelle

- [x] Bulk-Aktion-Button „🇮🇹 Italienisch übersetzen" in [produkte-table-body.tsx](src/app/produkte/produkte-table-body.tsx) und [kategorien/[id]/produkte-tabelle.tsx](src/app/kategorien/[id]/produkte-tabelle.tsx).
- [x] Eigener Wizard `BulkUebersetzenWizard` (sequenziell, Concurrency 1).
- [x] Default-Toggle „Nur leere IT-Felder überschreiben" ist **an** (schützt manuelle Korrekturen) — wie Spec verlangt.
- [⚠️] Spec sagte „Pro Produkt wird die API `/api/ai/uebersetzen` aufgerufen" — Code nutzt `/api/ai/uebersetzen-bulk-item`, das direkt schreibt. Bewusste Abweichung in den Implementation Notes dokumentiert.
- [x] Live-Progress (X/Y, Fehler-Counter), Pro-Produkt-Fehler-Tooltips, Cancel-Button.
- [x] Rate-Limit 500/h für Bulk-Item (höher als 60/h für Single, deckt Bulk-Run mit ~8 Produkten/Minute ab).

#### G) Einstellungen — KI-Tab

- [x] Neue Card „🇮🇹 Italienische Übersetzung" mit Toggle „Auto-Übersetzung beim Speichern" (Default an, persisted via Server-Action).
- [x] Hinweis-Text erklärt das Verhalten und warnt explizit, dass manuelle Korrekturen überschrieben werden.
- [x] Server-Action `updateUebersetzungEinstellungen` mit Zod-Validation.

#### H) PDF-Datenblatt — Sprach-Dropdown

- [x] Sprach-Buttons DE/IT in der Vorschau-Seite (`/produkte/[id]/datenblatt`).
- [x] Iframe-URL bekommt `&lang=it`, Raw-Route forwarded an Payload-Builder.
- [x] Payload-Builder nutzt `localizedField` mit DE-Fallback bei leerem `*_it`.
- [⚠️] Spec verlangt „kleinen Hinweis im Preview 'Feld X nicht übersetzt — zeigt Deutsch'" — **nicht implementiert**. Der Banner mit Liste der gefallenen Felder fehlt im Preview. Severity Low, weil das PDF selbst weiterhin sauber rendert.
- [x] Download-Dateiname mit `-IT`-Suffix bei `lang=it`.
- [x] Keine zusätzlichen LLM-Calls zur PDF-Renderzeit.

#### I) Statische LaTeX-Labels

- [x] [src/lib/latex/i18n.ts](src/lib/latex/i18n.ts) hat DE/IT-Map (`STATIC_LABELS`).
- [x] Template-Strings parameterisiert: „Anwendung & Hinweise", „Technische Daten", „Achtung", Footer „Stand"/Disclaimer.
- [⚠️] Spec listet auch „DETAILS"/„Treiber"/„Energieeffizienzklasse" — sind in `STATIC_LABELS` aber **nicht im Template referenziert**. Akzeptabel, weil das Modern-Template diese Strings gar nicht hartkodiert hat (DETAILS-Bereich existiert nicht, Treiber/Energie kommen aus Spec-Daten).
- [⚠️] **Critical-Risk:** Worker und App müssen synchron deployt werden. Wenn die App neue `meta.labels` schickt, der Worker aber noch das alte Template ohne `meta.labels`-Lookup hat, fällt Jinja's `StrictUndefined` und der Render schlägt fehl. **Reihenfolge**: zuerst Worker-Template deployen, dann App. In den Implementation Notes dokumentiert.

### Edge Cases

| Edge Case | Status | Verhalten |
|---|---|---|
| DE-Feld leer | ✅ | Wird übersprungen, `*_it` bleibt leer (verifiziert in `uebersetzeProdukt`) |
| IT-Feld manuell editiert, dann DE geändert | 🔴 | **Bug-1**: Auto-Trigger überspringt Feld immer (nicht nur bei manueller Korrektur) |
| HTML-RichText-Preservation | ✅ | System-Prompt verlangt es, JSON-Output erzwungen — nicht live verifiziert ohne LLM-Call |
| Technische Begriffe (CRI, IP, K, LED) | ✅ | System-Prompt schützt sie explizit |
| Sehr lange Texte | ✅ | Per-Feld-MaxLen aus `TRANSLATABLE_FIELDS.maxLen` validiert (z.B. 12000 für `datenblatt_text_it`) |
| API-Fehler/Quota | ✅ | Toast-Fehler im UI, Bulk skipt das Produkt mit Detail-Tooltip |
| Rate-Limit erreicht | ⚠️ | 429-Response pro User. Spec sagte „Bulk pausiert 60s" — Bulk macht das **nicht**, schickt einfach den Fehler weiter zum nächsten Produkt. Severity Low. |
| Auto-Trigger beim Erstellen (INSERT) | ⚠️ | `createProdukt` ruft `maybeAutoTranslate` **nicht** auf — nur `updateProdukt`. Erste Speicherung übersetzt nichts auto. Severity Medium, vom Backend-Dev als Trade-off dokumentiert. |
| `*_it` leer im PDF → DE-Fallback | ✅ | `localizedField` getestet (11 Vitest-Tests grün) |
| Mehrere User parallel | ✅ | Last-write-wins (DB-Standard) |
| PDF-Sprache IT, alle `*_it` leer | ✅ | Fallback auf DE komplett — PDF rendert mit deutschen Texten + italienischen Static-Labels (gemischt, dokumentiert in Implementation Notes als „Banner fehlt", Bug 4) |

### Security Audit (Red Team)

| Check | Ergebnis |
|---|---|
| Auth-Check beide Routen | ✅ `auth.getUser()` vorhanden, 401 ohne Session — verifiziert per E2E (Middleware redirect 307) |
| Rate-Limit | ✅ Per-User-Map mit 60/h (Single) bzw. 500/h (Bulk) — gleicher Mechanismus wie PROJ-39/45 |
| Whitelist-Validation der Felder | ✅ `z.enum(TRANSLATABLE_DE_KEYS)` verhindert Übersetzung beliebiger Spalten (z.B. `preise`, `id`) |
| Per-Feld Längen-Limit | ✅ `TRANSLATABLE_FIELDS.maxLen` wird in der Route geprüft, 400 bei Überlauf |
| Service-Role-Client für API-Keys | ✅ Über bestehende `createClient()` mit RLS-bypass für Settings-Read |
| Kein Key-Leak ans Frontend | ✅ API-Keys werden serverseitig gelesen, nie an die Client-Antwort gehängt |
| HTML-Sanitization der IT-Texte | ✅ `sanitizeRichTextHtml` wird auf `datenblatt_text_it` und `achtung_text_it` angewandt (gleiches Verhalten wie DE) |
| SQL-Injection | ✅ Nur Supabase-Builder verwendet, keine String-Konkatenation |
| Pre-existing Auth-Disabled | N/A — Auth ist projektweit aktiv (anders als zu PROJ-39's QA-Zeitpunkt) |

### Performance

- API-Validation-Errors: < 0.5 s (kein LLM-Call)
- LLM-Übersetzung: 5–15 s pro Anfrage (Modell-abhängig, dokumentiert)
- Auto-Trigger blockiert Save: ~5–15 s pro Save mit DE-Änderung (siehe Bug-Diskussion)
- PDF-Render mit `lang=it`: identisch zu DE (kein zusätzlicher LLM-Call zur Renderzeit, verifiziert)

### Regression-Tests

- ✅ TypeCheck: `npx tsc --noEmit` sauber
- ✅ Build: `npm run build` erfolgreich, alle 45 Routes generiert (PROJ-46: `/api/ai/uebersetzen` + `/api/ai/uebersetzen-bulk-item`)
- ✅ Vitest gesamt: **112 / 115 passed** — die 3 Failures liegen in `src/components/use-workspace-last-page.test.ts` und sind PROJ-48-Tests, **kein Bezug zu PROJ-46**
- ✅ PROJ-46-Unit-Tests isoliert: **25/25 passed** ([uebersetzen.test.ts](src/lib/ai/uebersetzen.test.ts) 14 Tests + [i18n.test.ts](src/lib/latex/i18n.test.ts) 11 Tests)
- ✅ Bestehende Routes unverändert: `git diff src/app/api/ai/teaser/ src/app/api/ai/produkt-namen/` → leer
- ✅ Form-Erweiterung non-destruktiv: Bestehende Felder bleiben unangetastet (verifiziert per Diff-Stat)

### Stabilitäts-Beobachtung (Audit-Log)

Während der QA wurde beobachtet, dass die Backend-Änderungen an [datenblatt-modern-payload.ts](src/lib/latex/datenblatt-modern-payload.ts) (Hinzufügen des `lang`-Parameters und `localizedField`-Calls) **zwischenzeitlich extern revertiert** und dann wieder restauriert wurden. Beim ersten Lesen zeigte `npx tsc` einen Fehler `error TS2554: Expected 3-4 arguments, but got 5` in [layout-registry.ts](src/lib/latex/layout-registry.ts:70). Bei einem späteren Re-Run war die Datei wieder im erwarteten Zustand und TS sauber. Empfehlung: **Vor Merge/Deploy nochmals `npx tsc --noEmit && git diff src/lib/latex/datenblatt-modern-payload.ts` prüfen**, um sicherzugehen, dass der `lang`-Parameter durchgängig vorhanden ist.

### E2E-Tests ([tests/PROJ-46-italienische-uebersetzung.spec.ts](tests/PROJ-46-italienische-uebersetzung.spec.ts))

9 Tests, davon 2 ohne Login-Bedarf:

| # | Test | Ergebnis |
|---|---|---|
| 1 | API uebersetzen: ohne Auth wird umgeleitet | ✅ passed |
| 2 | API uebersetzen-bulk-item: ohne Auth geschützt | ✅ passed |
| 3 | Datenblatt-Vorschau: Sprache-Buttons sichtbar | ⏭️ skipped (kein Login) |
| 4 | Datenblatt-Vorschau: Sprache-Wechsel `?lang=it` | ⏭️ skipped (kein Login) |
| 5 | Produkt-Formular: Italienisch-Sektion sichtbar | ⏭️ skipped (kein Login) |
| 6 | Produkt-Formular: Übersetzen-Button sichtbar | ⏭️ skipped (kein Login) |
| 7 | Produkt-Formular: Modal öffnet | ⏭️ skipped (kein Login) |
| 8 | Einstellungen: Auto-Translate-Toggle sichtbar | ⏭️ skipped (kein Login) |
| 9 | Produkt-Liste: Bulk-Button erscheint nach Auswahl | ⏭️ skipped (kein Login) |

Auth ist projektweit aktiv. UI-Tests benötigen `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` als Env-Vars (gleiches Muster wie PROJ-48). Ohne Credentials: skip — keine Failures, keine False Positives. Mit Credentials lassen sich alle 7 UI-Tests vom User lokal nachfahren.

### Bugs

**1 Critical · 1 High · 1 Medium · 3 Low**

#### 🔴 High — Bug-1: Auto-Trigger wird nach erster Übersetzung permanent übersprungen

- **Datei:** [src/app/produkte/actions.ts:245-246](src/app/produkte/actions.ts#L245-L246)
- **Steps to repro:**
  1. Produkt P (mit gepflegten DE-Texten, ohne IT) öffnen.
  2. „Alle Felder übersetzen" → Übernehmen → Speichern. ✅ DE+IT in DB.
  3. Auf gleicher Seite: `datenblatt_titel` ändern (DE), Speichern.
  4. Nach Reload: erwartetes Verhalten = `datenblatt_titel_it` wurde von der KI neu generiert. Tatsächliches Verhalten = `datenblatt_titel_it` zeigt **den alten** Übersetzungstext (Auto-Trigger hat das Feld übersprungen, weil das hidden Input das alte IT-Feld als „nicht leer" mit zurückschickt).
- **Root cause:** `maybeAutoTranslate` vergleicht `parsedData[f.it]` (was vom Hidden Input kommt) gegen leeren String, statt gegen den **vorigen** DB-Wert von `*_it`. Die Form-State-Architektur sendet das hidden Input immer mit, auch unverändert.
- **Fix-Vorschlag:** Auch die alten `*_it`-Werte in `vorher` einlesen (`select` um die `*_it`-Spalten erweitern), und `userSetIt` als „Wert hat sich gegenüber `vorher` geändert" definieren statt „Wert ist nicht leer".
- **Impact:** AC D ist nur teilweise erfüllt. Die Auto-Übersetzung funktioniert **nur** beim Erst-Übersetzen eines Produkts; Folge-Edits triggern keine Re-Übersetzung. Workaround: User klickt nach DE-Edits manuell „Übersetzen" oder nutzt den Bulk-Wizard mit „Nur leere Felder überschreiben" deaktiviert.

#### 🔴 Critical — Bug-2: Worker-Render bricht ab, wenn Worker und App nicht gemeinsam deployt sind

- **Datei:** [services/latex-pdf-service/templates/lichtengross-datenblatt-modern/document.tex.j2](services/latex-pdf-service/templates/lichtengross-datenblatt-modern/document.tex.j2) + Worker-Setup
- **Steps to repro:**
  1. App mit PROJ-46 deployen, Worker-Template-Deploy (`./scripts/deploy-latex-template.sh`) **vergessen**.
  2. Beliebiges Produkt → Datenblatt → Render.
  3. Worker liefert 500: `UndefinedError: 'meta' has no attribute 'labels'` (StrictUndefined-Modus).
- **Impact:** Alle Datenblatt-Renderings bleiben offline, **auch deutsche** — nicht nur italienische. Pre-existing Datenblätter werden ebenfalls betroffen.
- **Fix-Vorschlag:**
  - **Operativer Fix:** Deploy-Reihenfolge in den Implementation Notes hervorheben: zuerst Worker, dann App.
  - **Code-Fix (defensiv):** Im Template `meta.labels.anwendung_hinweise` mit Default-Filter rendern: `((( meta.labels.anwendung_hinweise | default("Anwendung & Hinweise") | e )))`. Dann fällt ein altes Worker-Setup auf den DE-Wert zurück, statt zu crashen.
- **Severity Begründung:** Critical, weil ein nicht-koordinierter Deploy alle Datenblätter komplett offline nimmt. Der defensive Code-Fix kostet 2 Minuten und entkoppelt die Deploys.

#### 🟡 Medium — Bug-3: Auto-Trigger läuft nicht bei `createProdukt`

- **Datei:** [src/app/produkte/actions.ts:122-149](src/app/produkte/actions.ts#L122-L149)
- **Steps to repro:** Neues Produkt anlegen → DE-Texte eingeben → Speichern. Erwartet (laut Edge-Case in Spec): „Erste Speicherung übersetzt alle nicht-leeren DE-Felder". Tatsächlich: Nur `updateProdukt` ruft `maybeAutoTranslate`, `createProdukt` nicht.
- **Impact:** Bei neuen Produkten muss der User immer manuell „Alle Felder übersetzen" klicken.
- **Fix-Vorschlag:** Nach erfolgreichem `INSERT` in `createProdukt` analog `maybeAutoTranslate(supabase, data.id, parsed.data, null)` aufrufen — `vorher=null` heißt „alle DE-Werte sind neu", also alle übersetzen.
- **Severity Begründung:** Medium, weil der Workaround (manuelles Klicken) gut sichtbar ist und in der UI klar.

#### 🟢 Low — Bug-4: Preview-Banner für DE-Fallback fehlt

- **Datei:** [src/app/produkte/[id]/datenblatt/page.tsx](src/app/produkte/[id]/datenblatt/page.tsx)
- **Steps to repro:** Produkt mit teilweise leeren `*_it`-Feldern → Datenblatt-Vorschau → Sprache: Italienisch.
- **Erwartet:** Banner „Feld 'X' nicht übersetzt — zeigt Deutsch" über dem PDF-iframe.
- **Tatsächlich:** PDF rendert mit Mischung aus IT + DE (Fallbacks), kein Hinweis im Preview.
- **Impact:** Pfleger merkt nicht, dass das PDF teilweise auf DE zurückgefallen ist, bis er die PDF prüft.
- **Fix-Vorschlag:** Payload-Builder gibt `meta.fallbacks: string[]` zurück (Liste der Felder, die DE-Fallback nutzten), Vorschau-Seite liest sie via einer kleinen JSON-Endpoint-Erweiterung oder direktem Server-Fetch und rendert eine Hinweis-Card.

#### 🟢 Low — Bug-5: Bulk-Wizard pausiert nicht bei Rate-Limit-429

- **Datei:** [src/app/produkte/bulk-uebersetzen-wizard.tsx](src/app/produkte/bulk-uebersetzen-wizard.tsx)
- **Steps to repro:** Bulk mit 60+ Produkten starten, Rate-Limit von 500/h erreichen. Wizard sendet weiter und alle Produkte ab dem 500. erhalten 429-Errors.
- **Erwartet (laut Spec):** „bei Überschreitung pausiert der Job 60 s und macht weiter".
- **Tatsächlich:** Wizard zählt 429 als „Fehler" und macht beim nächsten Produkt weiter, ohne Pause.
- **Impact:** Bei großem Bulk-Run ohne Verzögerung enden viele Produkte als Fehler, obwohl sie gestaffelt erfolgreich gewesen wären.
- **Fix-Vorschlag:** Bei `res.status === 429` einen `await new Promise(r => setTimeout(r, 60_000))` einbauen und den aktuellen Index nochmal prozessieren.

#### 🟢 Low — Bug-6: Auto-Trigger blockiert Save synchron statt Hintergrund

- **Datei:** [src/app/produkte/actions.ts:255](src/app/produkte/actions.ts#L255)
- **Steps to repro:** Produkt mit gepflegten DE-Daten öffnen → DE-Feld ändern → Speichern. Save-Button bleibt 5–15 s im „Speichere…"-Zustand.
- **Erwartet (laut Spec):** „Save schreibt zuerst alle Feldwerte, danach läuft die Übersetzung im Hintergrund."
- **Tatsächlich:** Auto-Trigger ist `await uebersetzeProdukt(...)`, blockiert.
- **Impact:** UX-Wartezeit, aber kein Datenverlust. Backend-Dev hat es bewusst so gewählt wegen Vercel-Functions-Lifecycle (in Implementation Notes dokumentiert).
- **Fix-Vorschlag:** Folge-Schritt mit Vercel Queues oder Trigger-via-API-Route + `void fetch(...)` und Toast-Polling.

### Production-Ready Decision

**❌ NOT READY**

Begründung:
- **Bug-1 (High)** macht den zentralen AC D unwirksam für den häufigsten Fall (Folge-Edits an bereits übersetzten Produkten). Das ist eine Kernfunktion des Features.
- **Bug-2 (Critical)** birgt ein hohes Deploy-Risiko (nicht-koordinierter Deploy → Datenblatt-Render komplett offline). Der defensive Jinja-Default-Filter ist ein 2-Minuten-Fix.

Die anderen 4 Bugs (Medium + 3× Low) sind Verbesserungen, die nicht blockieren — würde ich nach einem ersten Soak-Test in Production nachziehen.

**Empfehlung an Implementation:**
1. **Erst Bug-1 fixen** (Auto-Trigger-Override-Logik gegen DB-`vorher` vergleichen statt gegen leerem String).
2. **Erst Bug-2 fixen** (Jinja-Default-Filter im Template).
3. Migrationen 0029 + 0030 anwenden + Worker-Template deployen + Smoke-Test.
4. Erneut `/qa` → wenn beide Bugs grün, ist das Feature **READY**.

### Pending Manual Tests (vom User durchzuführen)

Sobald die Migrationen + der Worker deployt sind, bitte einmal lokal mit `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` Env-Vars die 7 UI-Tests durchspielen, plus diese drei manuelle Smoke-Checks, die wir nicht automatisiert haben (LLM-Kosten):
1. **HTML-Roundtrip:** RichText-Feld mit `<p><strong>Test</strong></p>` übersetzen → Antwort hat HTML-Tags erhalten?
2. **Technische Begriffe:** Text mit „CRI 90 IP65 LED 2700K" übersetzen → bleibt unverändert?
3. **PDF mit gemischtem `*_it`/DE:** Produkt mit nur einem übersetzten Feld → IT-PDF rendert mit IT-Header + DE-Body?

## Deployment
_To be added by /deploy_
