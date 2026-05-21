# PROJ-17: KI-Chat zu Buchungen & Finanzdaten

## Status: In Progress
**Created:** 2026-05-21
**Last Updated:** 2026-05-21

## Dependencies
- Requires: PROJ-1 (Auth) — nur eingeloggter Owner darf chatten
- Requires: PROJ-2 (Kontenrahmen) — Kategorien als Kontext
- Requires: PROJ-4 (Kontoauszug-Import) — Buchungen als Datenbasis
- Requires: PROJ-5 (Autonome Klassifizierung) — Kategorisierte Buchungen
- Erweitert: PROJ-15 (Klassifizierung-Pro) — Empfänger-Kenntnis als Kontext
- Erweitert: PROJ-16 (Mein Profil) — Stammdaten fließen in Prompt
- Berührt: PROJ-13 (Adminbereich) — gleiche LLM-Einstellungen (Modell, AI-Gateway-Key)

## Beschreibung
Ein eigenständiger Chat-Bereich im Tool, in dem der Inhaber sowohl
**Fragen stellen** als auch **Aktionen auf Anweisung anstoßen** kann
— auf Deutsch, in natürlicher Sprache. Der Agent beantwortet Fragen,
indem er die vorhandenen Daten (Buchungen, Kategorien, Empfänger-
Kenntnis, Konten, Lernregeln, Audit-Spur, Profil-Stammdaten) liest;
er kann auf **explizite Anweisung** auch schreibende Aktionen ausführen
(neue Kategorie anlegen, Buchungen umbuchen, Lernregel anlegen,
Klassifikation überschreiben, manuell bestätigen).

**Zwei klare Tool-Klassen:**
- **Lese-Tools** (immer erlaubt, kein Confirm) — beantworten Fragen.
- **Schreib-Tools** (nur auf explizite Anweisung, mit
  Bestätigungs-Schritt) — verändern Daten.

Konkrete Beispielfragen (Lese-Modus):
- „Wie viel habe ich diesen Monat für Software ausgegeben?"
- „Zeig mir alle Buchungen von Amazon im März"
- „Wie viel Umsatzsteuer schulde ich aktuell?"
- „Welche Buchungen sind noch in der Prüfliste?"
- „Welche Abos kosten mich am meisten?"
- „Hat sich mein Einkommen seit Januar verändert?"

Konkrete Beispielanweisungen (Schreib-Modus):
- „Lege eine neue Kategorie ‚Coaching-Honorare 19 %' an"
- „Buche die drei Accenture-Buchungen aus März auf ‚Privat: Lohn/Gehalt'"
- „Bestätige alle Buchungen von Skandia als finalisiert"
- „Mach eine Lernregel: Empfänger ‚IEP Pullach' → Kategorie
  ‚Privat: Strom/Gas'"

Der Chat nutzt Vercel AI SDK v6 mit **Tool-Calling**: das LLM bekommt eine
Sammlung von Lese- und Schreib-Tools, die die existierenden API-Routen (oder
direkte Service-Funktionen) wrappen. So bleibt RLS aktiv, kein Doppel-Layer.

### Schreib-Modus: Confirmation-Flow

**Kein Schreib-Tool wird direkt ausgeführt.** Stattdessen läuft jeder
Schreib-Aufruf zweistufig:

1. **Plan-Phase**: LLM beschreibt, was es tun würde (Tool-Name, Parameter,
   Auswirkung in Klartext) — z. B. „Ich würde 3 Buchungen umbuchen auf
   Kategorie ‚Privat: Lohn/Gehalt'. Diese 3: [Liste]. Bestätigen?"
2. **Confirm-Phase**: User klickt „Bestätigen" oder „Abbrechen" im UI.
   Erst bei „Bestätigen" wird die eigentliche DB-Mutation ausgeführt,
   inkl. Audit-Eintrag mit `quelle='chat'`.

Damit ist garantiert: Das LLM kann nichts verändern, was der User nicht
explizit freigegeben hat. Auch nicht durch versehentliche Tool-Aufrufe
oder Prompt-Injection im Verwendungszweck einer Buchung.

## User Stories
- Als Inhaber möchte ich eine Frage in natürlicher Sprache zu meinen
  Buchungen stellen und eine prägnante Antwort bekommen, damit ich nicht
  selbst durch Tabellen klicken muss.
- Als Inhaber möchte ich nachfragen können („zeig mir mehr Details" /
  „nur den letzten Monat"), ohne meine ursprüngliche Frage zu wiederholen,
  weil der Chat den Konversations-Kontext kennt.
- Als Inhaber möchte ich frühere Chats wiederfinden, damit ich nicht
  dieselbe Recherche zweimal machen muss.
- Als Inhaber möchte ich sehen, welche Datenquelle die Antwort gestützt
  hat (Liste der genutzten Tools), damit ich der Antwort vertrauen kann.
- Als Inhaber möchte ich einen Chat löschen können (DSGVO,
  Datenhygiene).
- Als Inhaber möchte ich dem Agenten **Anweisungen** geben können
  („Lege Kategorie X an", „Buche diese drei um", „Mach eine Regel"),
  damit ich Pflege-Aufgaben aus dem Chat heraus erledigen kann, ohne
  durch viele UI-Masken zu klicken.
- Als Inhaber möchte ich vor jeder schreibenden Aktion einen
  **Bestätigungs-Schritt** sehen mit klarer Beschreibung, was geändert
  wird, damit kein Datenverlust durch Missverständnisse entsteht.

## Acceptance Criteria

### P0 — Chat-Grundfunktionen
- [ ] Neuer Sidebar-Eintrag „KI-Chat" mit eigener Seite `/chat`.
- [ ] Layout: Liste der Konversationen links (mit Titel + Datum), aktive
  Konversation rechts mit Eingabefeld unten.
- [ ] Neue Konversation per „+ Neuer Chat"-Button im linken Panel.
- [ ] Eingabefeld unterstützt Multiline (Shift+Enter = Zeilenumbruch,
  Enter = Senden), Submit-Button daneben.
- [ ] Streaming-Ausgabe: die Antwort wird Token für Token gerendert.
- [ ] Konversationen werden persistiert: nach Reload sind sie wieder da.
- [ ] Konversations-Titel wird vom LLM nach der ersten Antwort
  automatisch vorgeschlagen (kurze Zusammenfassung der Frage).
- [ ] Konversation löschbar (Button mit Bestätigungs-Dialog).

### P0 — Lese-Tools (immer erlaubt, kein Confirm)
Das LLM bekommt diese Tools zur Verfügung. Jedes Tool ruft eine bestehende
API-Route oder Service-Funktion auf:

- [ ] `suche_buchungen` — Filter: Zeitraum (von/bis), Empfänger-Substring,
  Verwendungszweck-Substring, Kategorie, min/max Betrag, Status,
  Richtung (Einnahme/Ausgabe), Limit (max 100). Liefert Liste mit
  Datum/Empfänger/Zweck/Betrag/Kategorie/Status/Konfidenz.
- [ ] `aggregat_kategorien` — Aggregat je Kategorie für Zeitraum (Anzahl,
  Summe, Durchschnitt, Ø-Konfidenz). Basis: `/api/kategorien-analyse`.
- [ ] `cockpit_kennzahlen` — Monatsverlauf, Einnahmen, Ausgaben, Saldo
  für einen Zeitraum. Basis: `/api/finanzen/cockpit`.
- [ ] `wiederkehrende_buchungen` — Liste der erkannten Abos/wiederkehrende
  Einnahmen mit Intervall, Jahresvolumen, Aktiv-Status. Basis:
  `/api/finanzen/wiederkehrend`.
- [ ] `pruefliste` — Buchungen mit `status='zur_pruefung'`, gruppierbar
  nach Pruef_grund.
- [ ] `umsatzsteuer_stand` — aktuelle USt-Zahllast aus der laufenden
  Periode (Basis: PROJ-8 USt-Voranmeldung, falls schon umgesetzt;
  sonst aus `buchung` aggregiert).
- [ ] `buchung_details` — vollständige Details inkl. Audit-Historie zu
  einer einzelnen Buchung (per ID). Basis: `/api/buchungen/[id]/detail`.
- [ ] `empfaenger_kenntnis` — Cache-Eintrag (Branche, Leistung,
  Web-Snippets) zu einem normalisierten Empfänger.
- [ ] `lernregeln` — Liste der aktiven Lernregeln.
- [ ] `mein_profil` — Arbeitgeber, Adresse, Familie, eigene Konten (PROJ-16).
- [ ] `kategorien_liste` — alle verfügbaren Kategorien des Kontenrahmens
  (Bezeichnung, Typ, USt-Satz, Steuerrelevanz). Wichtig als Basis für
  Schreib-Tools.

Jedes Tool ist owner-scoped (RLS-Filter via Supabase-Client mit Auth-Cookie).
Tool-Aufrufe werden im UI als kleines Badge unter der Antwort angezeigt
(„Genutzt: suche_buchungen, aggregat_kategorien").

### P0 — Schreib-Tools (nur auf explizite Anweisung, mit Confirm)

**Wichtig:** Diese Tools führen die DB-Mutation NICHT direkt aus. Sie
geben einen strukturierten "Aktions-Vorschlag" zurück, der im UI als
Bestätigungs-Karte angezeigt wird. Erst Klick auf "Bestätigen" löst die
echte Mutation aus (via separater API-Route, die den Vorschlag entgegen-
nimmt und ausführt).

- [ ] `lege_kategorie_an` — Parameter: bezeichnung, typ
  (`einnahme`|`ausgabe`|`privat`|`neutral`), ust_satz (0|7|19),
  steuerrelevant (bool), nummer (optional). Confirm-Karte zeigt:
  „Neue Kategorie wird angelegt: …".
- [ ] `aendere_kategorie` — Parameter: kategorie_id, neue Felder
  (mindestens eines: bezeichnung, ust_satz, steuerrelevant, aktiv).
  Confirm-Karte zeigt Vorher/Nachher.
- [ ] `loesche_kategorie` — Parameter: kategorie_id. Confirm-Karte zeigt
  Anzahl betroffener Buchungen, die auf `null` fallen.
- [ ] `bucheBuchungenUm` — Parameter: buchung_ids (max 100),
  neue_kategorie_id, neue_klassifikation (optional). Confirm-Karte
  zeigt Liste der Buchungen mit Vorher/Nachher.
- [ ] `manuell_bestaetige_buchungen` — Parameter: buchung_ids (max 100).
  Setzt `status='manuell_bestaetigt'`. Confirm-Karte zeigt Liste.
- [ ] `lege_lernregel_an` — Parameter: bedingung (empfaenger_muster
  ODER zweck_muster ODER beide), aktion (kategorie_id,
  klassifikation, ust_satz), prioritaet, bezeichnung. Confirm-Karte
  zeigt das Regel-Schema + prognostizierte Wirkung („würde X
  bestehende Buchungen rückwirkend treffen").
- [ ] `aendere_lernregel` — Parameter: regel_id + neue Felder.
- [ ] `loesche_lernregel` — Parameter: regel_id.
- [ ] `setze_empfaenger_kenntnis` — Parameter: empfaenger_norm,
  branche, leistung, klassifikation_default. `quelle='manuell'`.
  Confirm-Karte zeigt Vorher/Nachher des Cache-Eintrags.
- [ ] `loesche_empfaenger_kenntnis` — Parameter: empfaenger_norm.
  Confirm-Karte erklärt: Recherche wird beim nächsten Vorkommen
  neu ausgeführt.

**Was Schreib-Tools NIEMALS dürfen:**
- Konten löschen oder ändern (eigene Bank-Konten-Verwaltung,
  zu sensibel).
- Profil-Daten ändern (Arbeitgeber/Familie/Adresse — eigene UI).
- Importe rückgängig machen oder Buchungen löschen.
- Steuerperioden abschließen oder Exporte starten.
- DSGVO-Daten löschen (z. B. ganze Audit-Spur).

Diese Begrenzung kommt aus dem System-Prompt UND ist in der Tool-
Bibliothek hartkodiert (die Tools existieren schlicht nicht).

### P0 — Confirm-Flow (UI + Backend)

- [ ] LLM gibt strukturierten Aktions-Vorschlag im `tool_results` als
  `{aktion: 'lege_kategorie_an', parameter: {...}, vorschau: 'Klartext'}`
  zurück. Status: `pending_confirm`.
- [ ] UI rendert eine Confirm-Karte mit:
  - Aktions-Titel (z. B. „3 Buchungen umbuchen")
  - Klartext-Vorschau aus `vorschau`
  - Tabelle mit Details (Buchungs-IDs, Vorher/Nachher etc.)
  - Buttons „Bestätigen" (primary) und „Abbrechen" (ghost)
- [ ] Klick „Bestätigen" → POST auf neue Route
  `POST /api/chat/[konversation_id]/aktion/[message_id]` →
  serverseitige Ausführung (mit erneuter Owner-/Auth-Prüfung) →
  Audit-Eintrag mit `quelle='chat'`, `aktion`, `parameter`,
  `nachricht_id` als Referenz.
- [ ] Klick „Abbrechen" → Vorschlag als `cancelled` markiert, keine
  Mutation. Status bleibt in der DB sichtbar (Audit der Konversation).
- [ ] Nach erfolgreicher Ausführung schreibt das System eine
  Assistant-Bestätigungsnachricht ("Erledigt: 3 Buchungen
  umgebucht auf …") in den Chat.
- [ ] Bei Fehlschlag während der Ausführung: klare Fehlermeldung in
  der Confirm-Karte, Vorschlag bleibt im Status `error`, kann erneut
  versucht werden.
- [ ] **Idempotenz**: ein bereits ausgeführter Vorschlag kann nicht
  ein zweites Mal bestätigt werden (Schutz vor Doppel-Klick / Replay).

### P0 — Datenbank
- [ ] Migration `0009_chat.sql`:
  - Tabelle `chat_konversation`: id, owner_id, titel, created_at,
    updated_at. RLS owner-scoped. Index auf `(owner_id, updated_at desc)`.
  - Tabelle `chat_nachricht`: id, konversation_id (FK ON DELETE CASCADE),
    owner_id, rolle (`user`|`assistant`|`tool`), inhalt text, tool_calls
    jsonb, tool_results jsonb, tokens_in int, tokens_out int, created_at.
    RLS owner-scoped. Index auf `(konversation_id, created_at)`.
  - Tabelle `chat_aktion`: id, konversation_id (FK), nachricht_id (FK),
    owner_id, aktion text (Tool-Name), parameter jsonb, vorschau text,
    status text CHECK in (`pending_confirm`, `confirmed`, `cancelled`,
    `error`), audit_eintrag_id uuid NULL (Referenz nach Ausführung),
    fehler_text text NULL, created_at, updated_at. RLS owner-scoped.
    Index auf `(konversation_id, status)`. — Diese Tabelle speichert
    den Confirm-Flow-State.
- [ ] Trigger `set_updated_at` auf `chat_konversation` und `chat_aktion`.

### P0 — Backend & Pipeline
- [ ] API-Route `POST /api/chat/[konversation_id]/nachricht` —
  empfängt Nutzer-Nachricht, lädt Konversations-Historie, ruft LLM mit
  Tools auf, streamt die Antwort zurück. Schreibt am Ende sowohl die
  User-Nachricht als auch die LLM-Antwort + Tool-Calls in die DB.
- [ ] API-Route `GET /api/chat/konversationen` — Liste mit Titel,
  letzter Aktivität, Vorschau der letzten Nachricht.
- [ ] API-Route `POST /api/chat/konversationen` — neue Konversation
  anlegen, liefert ID.
- [ ] API-Route `DELETE /api/chat/[konversation_id]` — Konversation +
  alle Nachrichten löschen (Audit-Eintrag).
- [ ] API-Route `GET /api/chat/[konversation_id]` — Konversations-
  Header + alle Nachrichten + alle Aktions-Vorschläge.
- [ ] API-Route `POST /api/chat/[konversation_id]/aktion/[aktion_id]/bestaetigen`
  — führt den Vorschlag aus (re-validiert Owner via Auth-Cookie, lädt
  Vorschlag, ruft interne Service-Funktion, schreibt Audit-Eintrag,
  setzt status='confirmed' + audit_eintrag_id). Idempotent: doppelter
  Aufruf bei `status='confirmed'` liefert 409.
- [ ] API-Route `POST /api/chat/[konversation_id]/aktion/[aktion_id]/abbrechen`
  — setzt status='cancelled'. Idempotent.
- [ ] Auto-Titel: nach der ersten Antwort einen separaten kleinen
  LLM-Call, der einen 3-6-Wort-Titel vorschlägt. Schreibt in
  `chat_konversation.titel`.
- [ ] System-Prompt: erklärt dem Modell die Trennung Lese-Tools (frei
  einsetzbar) vs. Schreib-Tools (nur auf explizite Anweisung des
  Nutzers, IMMER über den Confirm-Flow, NIE eigenmächtig). Beträge
  formatiert (1.234,56 €), Datumsangaben in DE-Format (TT.MM.JJJJ).
  Profil-Stammdaten (Arbeitgeber, Adresse) werden eingebettet.
  Klare Regel: „Wenn der Nutzer ‚zeige', ‚wieviel', ‚welche' fragt,
  nutze Lese-Tools. Wenn er ‚lege an', ‚buche um', ‚bestätige',
  ‚ändere', ‚lösche' sagt, nutze Schreib-Tools mit
  Confirm-Schritt."
- [ ] Token-Budgets: max 32k Input-Tokens (Konversations-Historie
  truncated bei Überlauf — älteste Nachrichten erst), max 4k
  Output-Tokens, max 6 Tool-Roundtrips pro Antwort.

### P0 — UI-Details
- [ ] Markdown-Rendering der Antworten (Tabellen, Listen, Bold).
- [ ] Code-Blöcke für strukturierte Daten (JSON / Buchungs-Listen).
- [ ] „Antwort kopieren"-Button pro Assistant-Nachricht.
- [ ] Leerzustand: Beispielfragen als Klick-Bubbles, die in das
  Eingabefeld vorgeladen werden.
- [ ] Loading-Indikator während des Streamings (animierter Cursor).
- [ ] Fehlerbehandlung: wenn der LLM-Call scheitert, Toast + Eintrag
  bleibt als „Fehler"-Nachricht in der Konversation stehen.

### P1 — Komfort
- [ ] Konversation umbenennen (Pencil-Icon neben dem Titel).
- [ ] Suche über alle Konversationen (Volltext über `chat_nachricht.inhalt`).
- [ ] Export einer Konversation als Markdown-Datei.
- [ ] Vorschlag „Weiterführende Fragen" am Ende der Antwort (3 Bubble-
  Buttons mit anschlussfähigen Fragen).
- [ ] Tool-Call-Inspektor: Klick auf das Tool-Badge öffnet ein Modal mit
  Input/Output des Tool-Calls (für Debug & Vertrauen).

### P2 — Späteres
- [ ] Sprachen-Schalter (DE/EN) — vorerst nur DE.
- [ ] Sharable Read-only-Link einer Konversation (Steuerberater-Sicht).
- [ ] Aktions-Tools (Klassifikation überschreiben, Regel anlegen) —
  bewusst aus dem MVP raus, weil das eine eigene Confirmation-UX braucht.

## Edge Cases
- **LLM ruft kein Tool**, sondern halluziniert eine Zahl → System-Prompt
  schärft: „Antworte NIE mit konkreten Beträgen oder Buchungslisten,
  ohne ein Tool aufgerufen zu haben."
- **Tool gibt 0 Treffer** → LLM soll das ausdrücklich sagen, nicht
  „leere" Antwort fabrizieren.
- **Sehr lange Konversation** → ältere Nachrichten ab dem 32k-Token-Limit
  werden gestrichen, aber System-Prompt + Profil + die letzten 6
  Nachrichten bleiben immer drin.
- **Mehrere parallele Streams in derselben Konversation** → der zweite
  Send-Klick wird vom UI verhindert (Button disabled), während ein
  Stream läuft.
- **DSGVO**: Konversationen sind owner-scoped, RLS aktiv. Beim Löschen
  einer Konversation werden auch alle `chat_nachricht`-Zeilen kaskadiert
  gelöscht. Aktions-Vorschläge in `chat_aktion` werden ebenfalls
  gelöscht; bereits ausgeführte Aktionen bleiben im `audit_eintrag`
  zurückverfolgbar (das ist gewollt — Audit-Spur muss bestehen bleiben).
- **Tool-Limit erreicht** (6 Roundtrips ohne Antwort) → LLM bekommt
  Final-Prompt: „Beende jetzt mit den Daten, die du hast", damit keine
  Endlosschleife entsteht.
- **Datenschutz Cache**: das Chat-LLM bekommt KEINE rohen
  OCR-Belegtexte als Kontext — nur Buchungs-Metadaten +
  Aggregate. Belege bleiben beim Detail-Tool, das nur Metadaten
  zurückgibt.
- **Kosten**: jede Antwort kostet (LLM-Tokens + ggf. mehrere Tool-
  Datenbank-Hits). Token-Verbrauch wird pro Nachricht persistiert für
  spätere Auswertung.
- **LLM ruft Schreib-Tool unaufgefordert auf** (z. B. weil der
  Verwendungszweck einer gefundenen Buchung sowas wie „Bitte
  umbuchen" enthielt — Prompt-Injection) → der Confirm-Flow fängt das
  ab. KEIN Schreib-Tool führt direkt aus, immer nur Vorschlag.
- **LLM schlägt destruktive Aktion vor** (z. B. „Lösche Kategorie XY")
  → System-Prompt fordert das LLM auf, vor dem Vorschlag IMMER
  zuerst `aggregat_kategorien` oder `suche_buchungen` aufzurufen,
  um die Konsequenzen zu prüfen und in der Vorschau zu zeigen
  (Anzahl betroffener Buchungen).
- **Bestätigungs-Race**: Nutzer klickt schnell zweimal „Bestätigen"
  → Idempotenz-Check (status='confirmed' → 409 Conflict).
- **Vorschlag bezieht sich auf veraltete Daten** (zwischen Vorschlag
  und Bestätigung wurden Buchungen geändert) → Ausführung prüft die
  betroffenen Datensätze nochmal, weicht das Ergebnis vom Vorschlag
  ab (z. B. eine Buchung wurde inzwischen manuell bestätigt), wird
  die Ausführung abgebrochen mit Hinweis: „Datensatz hat sich
  geändert, neuen Vorschlag bitte". Schutz vor Lost-Update.
- **Großer Batch** (z. B. „Buche alle 80 Amazon-Buchungen um") →
  Bulk-Mutation läuft in Batches von 50 server-seitig, Audit-Eintrag
  pro Buchung. Confirm-Karte zeigt vorher die Stichprobe und die
  Gesamtanzahl.

## Technical Requirements
- **Performance**: Streaming-Antwort startet < 1s nach Submit
  (TTFB-LLM). Tool-Calls sind in der Regel < 200 ms (DB-Aggregate auf
  indizierten Spalten).
- **Sicherheit**:
  - Tools nutzen den Auth-Cookie-Supabase-Client (RLS aktiv).
    Service-Role wird im Chat-Pfad NIE genutzt.
  - Schreib-Tools führen NIE direkt aus, sondern erzeugen einen
    `chat_aktion`-Eintrag mit `status='pending_confirm'`.
  - Confirm-Endpoint validiert nochmal Owner + lädt den
    Vorschlag aus DB (nie aus Request-Body — Replay-Schutz).
  - Schreib-Tool-Bibliothek ist eine **fixe Allowlist** — andere
    Mutationen sind technisch nicht möglich.
- **Auditierbarkeit**: jede Konversation hat eine vollständige Spur in
  `chat_nachricht`. Tool-Calls + Ergebnisse werden mitgespeichert.
  Jede ausgeführte Schreib-Aktion erzeugt einen `audit_eintrag` mit
  `quelle='chat'`, `aktion`, `parameter`, `chat_nachricht_id`.
- **Modell-Wahl**: dasselbe Modell wie die Klassifizierung (env
  `STEUERAGENT_LLM_MODEL`). Optional kann der Adminbereich (PROJ-13)
  später ein separates Chat-Modell hinzufügen.

---

## Tech Design

### Backend-Bedarf: Ja
1 neue Migration (3 Tabellen), 7 neue API-Routen, Tools-Sammlung
(Lese + Schreib), Confirm-Flow-Service, neuer System-Prompt.

### Datenmodell
Siehe Acceptance Criteria.

### Komponentenstruktur
```
/chat (neue Page)
├── ChatLayout                  (Sidebar links, Verlauf rechts)
│   ├── KonversationsListe      (Liste mit Titel, letzte Aktivitaet)
│   └── KonversationsAnsicht
│       ├── NachrichtenListe    (User + Assistant + Tool-Badges)
│       │   └── AktionsKarte    (Confirm-UI fuer Schreib-Tools)
│       └── Eingabefeld         (Textarea + Send-Button)

lib/chat/
├── tools-lese.ts               (Lese-Tool-Definitionen, Zod-Schemata)
├── tools-schreib.ts            (Schreib-Tool-Definitionen — geben
                                 NUR Aktions-Vorschlaege zurueck,
                                 keine direkten Mutationen)
├── aktion-ausfuehren.ts        (Service: lädt Vorschlag, führt
                                 Mutation aus, schreibt Audit)
├── system-prompt.ts            (Prompt-Builder mit Profil-Einbettung
                                 + klare Lese/Schreib-Trennung)
└── konversation.ts             (Service: holeKonversation,
                                 speichereNachricht, autoTitel)
```

### Abhängigkeiten (Pakete)
- Vercel AI SDK v6 (`ai`, `@ai-sdk/react` für `useChat`-Hook) — schon im
  Projekt.
- Markdown-Renderer: `react-markdown` + `remark-gfm` (neu).
- Syntax-Highlighting für Code-Blöcke: nicht im MVP nötig.

### Sicherheits-Hinweis
Alle Tools sind owner-scoped. Das LLM hat **keinen Zugriff auf
Service-Role-Credentials**. Tool-Calling läuft über die normale
App-Auth-Schiene.

---

## Tech Design (Solution Architect)

> Stand: 2026-05-21. PM-lesbares Architekturbild. Keine Implementierungs-
> details — das Backend-/Frontend-Team setzt das anhand der Specs um.

### Was wir bauen — in einem Satz
Einen vollwertigen Chat-Bereich im Tool, der dem Inhaber Antworten zu
seinen Buchungen gibt und auf klare Anweisung auch Pflege-Aufgaben
(Kategorien, Umbuchungen, Lernregeln) durchführt — jede Datenänderung
mit einem manuellen Bestätigungs-Klick abgesichert.

### Komponentenstruktur (UI-Bauplan)

```
/chat  (neue Seite, Sidebar-Eintrag "KI-Chat")
+-- Chat-Layout (zwei Spalten)
|   +-- Linke Spalte: Konversationsliste
|   |   +-- "Neuer Chat"-Button (oben)
|   |   +-- Suchfeld (nur P1)
|   |   +-- Liste der Konversationen (Titel + letzte Aktivitaet)
|   |       +-- Aktiver Eintrag visuell hervorgehoben
|   |       +-- Hover-Aktionen: Umbenennen / Loeschen
|   |
|   +-- Rechte Spalte: aktive Konversation
|       +-- Header: Konversations-Titel + Loeschen-Icon
|       +-- Nachrichten-Verlauf (scrollbar)
|       |   +-- User-Bubble (rechts ausgerichtet)
|       |   +-- Assistant-Bubble (links, Markdown-gerendert)
|       |   +-- Tool-Badge unter Assistant-Bubble
|       |   |   "Genutzt: suche_buchungen, aggregat_kategorien"
|       |   +-- Aktions-Karte (nur bei Schreib-Aktionen)
|       |       +-- Aktions-Titel ("3 Buchungen umbuchen")
|       |       +-- Klartext-Vorschau
|       |       +-- Tabelle Vorher/Nachher
|       |       +-- "Bestaetigen" (primary) / "Abbrechen" (ghost)
|       |       +-- Nach Bestaetigung: gruener Haken + Audit-Link
|       +-- Eingabe-Bereich (unten, sticky)
|           +-- Mehrzeiliges Textfeld
|           +-- Senden-Button (deaktiviert waehrend Stream)
|           +-- Beispielfragen-Bubbles (nur bei leerer Konversation)
```

### Datenmodell (Klartext)

**Konversation** — ein Chat-Faden:
- Eindeutige ID, Owner, Titel (vom LLM vorgeschlagen oder manuell)
- Zeitstempel: erstellt, zuletzt aktualisiert

**Nachricht** — ein einzelner Beitrag in der Konversation:
- Eindeutige ID, gehoert zu einer Konversation
- Rolle: Nutzer / Assistent / Tool-Ergebnis
- Inhalt als Text (Markdown bei Assistent)
- Tool-Aufrufe + deren Rohergebnisse (fuer Debug + Audit)
- Token-Verbrauch (Input/Output) fuer spaetere Kostenauswertung
- Zeitstempel

**Aktions-Vorschlag** — die zweite Stufe vom Confirm-Flow:
- Eindeutige ID, gehoert zu einer Konversation + Nachricht
- Aktions-Name (z. B. "bucheBuchungenUm")
- Parameter (z. B. Buchungs-IDs + Ziel-Kategorie)
- Klartext-Vorschau ("3 Buchungen umbuchen auf …")
- Status: wartet auf Bestaetigung / bestaetigt / abgebrochen / Fehler
- Bei Bestaetigung: Referenz auf den entstandenen Audit-Eintrag
- Zeitstempel

**Gespeichert in:** Supabase Postgres (gleiche DB wie alle anderen
Tool-Daten). RLS-Policy: jeder sieht nur seine eigenen Konversationen
und Aktionen.

### Wie eine Anfrage durch das System läuft

#### Fall A — Lese-Frage ("Wieviel habe ich diesen Monat für Software ausgegeben?")
1. Browser sendet die Frage an unsere Chat-API
2. Backend laedt: System-Prompt + Profil + bisheriger Konversations-Verlauf
3. Backend ruft das LLM auf, gibt ihm die Lese-Tools mit
4. LLM entscheidet: "Ich brauche suche_buchungen oder aggregat_kategorien"
5. Backend fuehrt Tool-Aufruf aus → liest aus der DB (mit Auth-Cookie, RLS aktiv)
6. LLM bekommt das Ergebnis, formuliert eine Antwort
7. Antwort wird **Token-fuer-Token** zurueck in den Browser gestreamt
8. Browser zeigt die Antwort live an
9. Am Ende: Browser zeigt unten die Tool-Badges ("Genutzt: …")

#### Fall B — Schreib-Anweisung ("Buche alle Accenture-Buchungen auf 'Privat: Lohn/Gehalt'")
1. Schritte 1-4 wie oben
2. LLM ruft erst Lese-Tools auf, um die Buchungen zu finden (suche_buchungen)
3. LLM ruft dann **bucheBuchungenUm** auf
4. Wichtig: Das Tool **fuehrt NICHTS aus**. Es legt einen
   Aktions-Vorschlag in der DB an (Status "wartet auf Bestaetigung")
   und gibt die Vorschau zurueck
5. LLM antwortet im Chat: "Ich wuerde 3 Buchungen umbuchen — bitte bestaetigen"
6. Browser zeigt **Aktions-Karte** mit Vorher/Nachher und zwei Buttons
7. User klickt "Bestaetigen" → Browser sendet an separate Confirm-API
8. Confirm-API laedt den Vorschlag aus der DB (nicht aus dem Request),
   prueft Owner, fuehrt die Mutation aus, schreibt Audit-Eintrag
9. Aktions-Karte zeigt gruenen Haken + Bestaetigungsnachricht erscheint im Chat

#### Sicherheits-Eigenschaften dieser Architektur
- **Das LLM kann nichts veraendern** — es kann nur Vorschlaege machen
- **Der Confirm-Schritt erzwingt einen menschlichen Klick** vor jeder Aenderung
- **Prompt-Injection ist neutralisiert**: selbst wenn jemand "lösche alles"
  in einen Verwendungszweck schreibt, der vom LLM gelesen wird, kommt
  das nicht weiter als ein Vorschlag, den der User ablehnen kann
- **Replay-Schutz**: ein bereits bestaetigter Vorschlag laesst sich nicht
  doppelt ausfuehren
- **Lost-Update-Schutz**: zwischen Vorschlag und Bestaetigung wird die
  DB nochmal gepruft — wenn Buchungen geaendert wurden, Abbruch
- **RLS bleibt aktiv**: alle Tool-Aufrufe nutzen den Auth-Cookie, kein
  Service-Role

### Tech-Entscheidungen (warum so?)

**Vercel AI SDK v6 mit `streamText`+Tools** statt eigener Stream-Lösung.
*Warum:* Im Projekt schon eingebaut (Klassifizierung nutzt `generateObject`
aus derselben Bibliothek). Tool-Calling, Streaming und Token-Tracking
out-of-the-box. Kein eigener Code für Server-Sent-Events nötig.

**Tools rufen interne Service-Funktionen direkt auf** statt HTTP-Aufrufe
gegen die eigenen API-Routen.
*Warum:* Schneller (kein HTTP-Round-trip im Server-Prozess), einfacher
zu testen, gleiche Auth-Kontext-Übergabe. Falls eine Funktionalität
heute nur in einer API-Route liegt, wird die Logik in ein
`lib/services/*.ts`-Modul refactored und die Route nutzt sie ebenfalls.
Die externe API bleibt unverändert.

**Schreib-Tools als zweistufiger Flow** statt direkter Ausführung.
*Warum:* Kontrolle vor Geschwindigkeit. Buchhaltung verzeiht keine
versehentlichen Massen-Mutationen. Der eine zusätzliche Klick ist
deutlich besser als ein Undo-Mechanismus, der nie alle Edge-Cases
abdeckt. Außerdem schließt das den größten LLM-Sicherheitsrisikofaktor
(Prompt-Injection) komplett aus.

**Schreib-Tools sind eine fixe Allowlist** statt parametrisierbare
„mach was ich sage"-Tools.
*Warum:* Was nicht in der Allowlist steht, kann das LLM nicht. Konten,
Profil-Stammdaten, Importe und DSGVO-Aktionen sind bewusst **nicht**
in der Allowlist, weil sie eigene UI-Workflows haben und für den
Chat zu riskant sind.

**Persistenz in Supabase** statt Browser-LocalStorage.
*Warum:* Konversationen sollen auch nach Browser-Wechsel verfügbar
sein. RLS schützt sie auf DB-Ebene. Token-Verbrauch wird zentral
sichtbar (spätere Auswertung).

**Markdown-Rendering der Antworten** mit `react-markdown` + `remark-gfm`.
*Warum:* Das LLM antwortet ohnehin häufig mit Tabellen und Listen.
Schöner gerendert wirkt es ruhiger. GFM für GitHub-Flavored-Markdown
(Tabellen).

**Modell-Wahl: gleicher LLM wie die Klassifizierung** (über `STEUERAGENT_LLM_MODEL`).
*Warum:* Ein Modell weniger zu konfigurieren. Wenn der Adminbereich
(PROJ-13) später ein separates Chat-Modell ermöglichen will, kann
das als zusätzliche Env-Variable kommen — kein architektonischer
Umbau nötig.

**Auto-Titel über separaten kurzen LLM-Aufruf** statt erste User-Nachricht
verwenden.
*Warum:* "Wie viel hab ich diesen Monat ausgegeben?" als Titel ist
schlechter als "Software-Ausgaben Mai 2026". Der zusätzliche Mini-Call
ist günstig und macht die linke Konversationsliste sofort scanbar.

### Dependencies (neue Pakete)

- **`react-markdown`** — Markdown-Rendering der Assistent-Antworten.
- **`remark-gfm`** — GitHub-Flavored-Markdown-Erweiterung (Tabellen,
  Strikethrough, Aufgabenlisten).

Schon vorhanden und wiederverwendet:
- `ai` (Vercel AI SDK v6) — Streaming + Tool-Calling
- `@ai-sdk/anthropic` — Claude-Provider (gleiche Quelle wie
  Klassifizierung)
- `zod` — Tool-Parameter-Validierung
- `sonner` — Toasts
- shadcn/ui — alle UI-Bausteine (Card, Button, ScrollArea, Dialog,
  Textarea, Skeleton)

### Was im MVP NICHT drin ist (bewusst raus)

- **Aktions-Tools für Konten, Profil, Importe** — eigene UIs sind besser.
- **Sharable Read-only-Links** für den Steuerberater — kommt in P2.
- **Sprachen-Schalter (DE/EN)** — Tool ist Single-User, DE reicht.
- **Voice Input/Output** — nicht in der Vision verankert.
- **Bilder/Belege im Chat-Stream** — Belege bleiben im Beleg-Detail.
- **Mehrere parallele LLM-Modelle parallel** (Vergleich) — Komplexität
  ohne Mehrwert.

### Wie wir wissen, ob es funktioniert (Akzeptanz auf einen Blick)
1. Eine Frage ("Wieviel habe ich für Software ausgegeben?") liefert
   eine konkrete Zahl, die mit der Kategorien-Analyse-Tab-Ansicht
   übereinstimmt.
2. Eine Anweisung ("Buche XYZ um") führt **nicht** zur sofortigen
   Mutation, sondern zu einer Confirm-Karte mit klarer Vorschau.
3. Klick auf Bestätigen schreibt einen `audit_eintrag` mit
   `quelle='chat'` — sichtbar in der Buchungs-Detail-Audit-Spur.
4. Klick auf Abbrechen ändert nichts.
5. Bei Browser-Reload sind alle Konversationen + Nachrichten +
   Aktions-Karten noch da.

## Implementierungsnotizen

### 2026-05-21 — Frontend-Initial: UI gegen Mock-Daten

Komplette UI gebaut, vorerst gegen `src/lib/chat/mock-daten.ts` (Promise-
basierte Attrappen + AsyncIterable für den Stream). Keine echten API-
Routen, keine Migration — beides folgt im Backend-Schritt.

Neu angelegt:
- `src/lib/chat/typen.ts` — Frontend-Typen (Konversation, Nachricht,
  Aktion, ToolBadge).
- `src/lib/chat/mock-daten.ts` — drei Beispiel-Konversationen, simulierter
  Token-Stream (40-60 ms Pause), Heuristik für Tool-Badges +
  Aktions-Vorschläge bei Schreib-Anweisungen.
- `src/lib/chat/datum.ts` (+ Test) — relativ-Datum-Helfer für die Liste.
- `src/components/chat/chat-layout.tsx` — Zwei-Spalten-Layout (Desktop)
  bzw. Mobile-Schichtung mit Toggle (Liste ↔ Ansicht).
- `src/components/chat/konversations-liste.tsx` — Liste + Empty-/
  Loading-State, Drei-Punkte-Menü mit Umbenennen + Löschen.
- `src/components/chat/konversations-ansicht.tsx` — Header, Scroll-
  Bereich, Sticky-Eingabe, Empty-State mit Beispielfragen.
- `src/components/chat/nachrichten-liste.tsx` — User-/Assistant-
  Bubbles, Markdown-Rendering (`react-markdown` + `remark-gfm`),
  Tool-Badges mit Popover-Inspektor, Streaming-Cursor, Copy-Button.
- `src/components/chat/aktions-karte.tsx` — Confirm-Flow-Karte mit
  Vorher/Nachher-Tabelle, allen vier Statusvarianten und optimistic-
  Loader.
- `src/components/chat/eingabe-feld.tsx` — Auto-Resize-Textarea,
  Enter/Shift+Enter, Senden-Button mit Stream-Indikator.
- `src/components/chat/beispielfragen-bubbles.tsx` — 6 Bubbles für den
  Leerzustand.
- `src/components/chat/chat-page-inhalt.tsx` — Top-Level-State-Container.
- `src/app/(app)/chat/page.tsx` — Server-Component (laedt Initial-Daten
  aus den Mocks).

Sidebar-Eintrag „KI-Chat" wurde in `NAV_HEUTE` direkt nach „Dashboard"
eingehängt — der Chat ist die zentrale Interaktion, daher prominent.

Pakete neu: `react-markdown`, `remark-gfm` (per `npm install`).

`npm run lint` läuft mit 0 Errors. `npm run build` ist erfolgreich;
`/chat` taucht in der Route-Liste auf.

**Was noch zu tun ist (Backend-Schritt):**
- Migration `0009_chat.sql` mit `chat_konversation`, `chat_nachricht`,
  `chat_aktion`.
- API-Routen: `GET/POST /api/chat/konversationen`,
  `GET/PATCH/DELETE /api/chat/[id]`,
  `POST /api/chat/[id]/nachricht` (Stream via Vercel AI SDK v6),
  `POST /api/chat/[id]/aktion/[aktion_id]/bestaetigen|abbrechen`.
- Tool-Bibliothek (Lese + Schreib) in `lib/chat/tools-*.ts`.
- System-Prompt-Builder mit Profil-Einbettung.
- Auto-Titel-Generator nach der ersten Antwort.
- In `mock-daten.ts` jede `mock*`-Funktion durch echten `fetch()`-Call
  ersetzen — die UI-Komponenten ändern sich dafür nicht.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
