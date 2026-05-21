# PROJ-16: Mein Profil — persönliche Stammdaten als LLM-Kontext

## Status: Planned
**Created:** 2026-05-21
**Last Updated:** 2026-05-21

## Dependencies
- Erweitert: PROJ-5 (Autonome Klassifizierung) — Stammdaten wandern in LLM-Prompt
- Erweitert: PROJ-15 (Klassifizierung-Pro) — neuer Kontextblock zusätzlich zu Kenntnis + Historie
- Berührt: PROJ-1 (Firmen-/Steuerprofil) — bewusst getrennt: PROJ-1 ist die *Selbständigkeits-Identität*, PROJ-16 die *Privat-Identität*

## Beschreibung
Die autonome Klassifizierung kennt heute den Buchungstext, optional eine
Empfänger-Web-Kenntnis (PROJ-15) und die eigene Historie. Was sie NICHT
kennt: **wer der Inhaber persönlich ist**. Konkretes Beispiel aus der
Praxis: 4 Buchungen von „Accenture GmbH" mit Verwendungszweck „Lohn /
Gehalt" werden als geschäftliche Umsatzerlöse 19 % USt klassifiziert,
weil das LLM nicht wissen kann, dass Accenture der *Arbeitgeber* des
Nutzers ist (parallel zur Selbständigkeit).

„Mein Profil" sammelt diese Kontext-Stammdaten und übergibt sie der
Pipeline als zusätzlichen LLM-Prompt-Block. Vier Kategorien:

1. **Arbeitgeber** — bei Buchungen *von* diesen Unternehmen ist das
   Angestellten-Gehalt (privat, neutral für EÜR), nicht Selbständigen-
   Umsatz.
2. **Wohnort + Adresse** — bei lokalen Empfängern (Strom, Müll, Wasser,
   Versicherung mit Bezug zur Wohnung, lokale Geschäfte) ist die
   Adress-Übereinstimmung ein starkes Privat-Signal.
3. **Familienmitglieder** — Überweisungen an diese Personen sind
   Privatentnahmen/Privateinlagen, kein Geschäftsverkehr. Außerdem:
   diese Namen werden NIE für Web-Lookups verwendet (DSGVO).
4. **Eigene Bankkonten** — Überweisungen zwischen diesen sind
   Geldtransit (neutral), nicht Einnahme/Ausgabe. Die App kennt
   schon die hinterlegten Konten (PROJ-4), aber die Pipeline nutzt
   dieses Wissen aktuell nicht für die Klassifizierung.

## User Stories
- Als Inhaber möchte ich meinen Arbeitgeber eintragen, damit
  Gehaltszahlungen automatisch als „Privat: Lohn/Gehalt" klassifiziert
  werden, nicht als Umsatzerlös 19 % USt.
- Als Inhaber möchte ich meinen Wohnort hinterlegen, damit lokale
  Anbieter (Strom, Wasser) korrekt als private Wohnnebenkosten erkannt
  werden.
- Als Inhaber möchte ich Familienmitglieder eintragen, damit
  Überweisungen an sie nicht im Web nachgeschlagen oder fälschlich als
  Geschäftspartner klassifiziert werden.
- Als Inhaber möchte ich meine eigenen Bankkonten markieren, damit
  Umbuchungen automatisch als Geldtransit eingeordnet werden.
- Als Inhaber möchte ich jede Profil-Information jederzeit
  bearbeiten/löschen können (DSGVO).

## Acceptance Criteria

### P0 — Datenmodell + UI
- [ ] Neuer Bereich `/profil` in der Sidebar (Sektion „Stammdaten" oder
  vergleichbar). Sidebar-Eintrag „Mein Profil".
- [ ] Page mit vier Sektionen / Karten:
  1. **Arbeitgeber** (Liste, Inline-Add/Edit/Delete)
  2. **Wohnort** (einfaches Formular: Straße, PLZ, Ort, Land-Default DE)
  3. **Familienmitglieder** (Liste, Inline-Add/Edit/Delete mit Rolle:
     Ehepartner / Kind / Eltern / Sonstige)
  4. **Eigene Bankkonten** (Anzeige der bereits importierten Konten
     aus PROJ-4 + Toggle „Eigenes Konto / Drittkonto"; falls Toggle
     anders schon woanders existiert, dort wiederverwenden)
- [ ] Jede Sektion eigenständig speicherbar (kein „alles oder nichts").
- [ ] Toast/Feedback bei Änderungen, Audit-Eintrag pro Mutation.

### P0 — Datenbank
- [ ] Migration `0005_mein_profil.sql`:
  - Tabelle `mein_profil_arbeitgeber`: id, owner_id, name, name_normalisiert,
    aktiv_von date NULL, aktiv_bis date NULL, notiz text, created_at,
    updated_at. RLS owner-scoped.
  - Tabelle `mein_profil_familie`: id, owner_id, name, name_normalisiert,
    rolle text (ehepartner|kind|eltern|sonstige), notiz, created_at,
    updated_at. RLS.
  - Tabelle `mein_profil_adresse`: owner_id PK, strasse, plz, ort, land
    default 'DE', updated_at. RLS. (Single-Row pro Owner — kein id-Feld
    nötig, owner_id ist primary key.)
  - Konten: erweitere `konto` um `ist_eigenes_konto boolean default true`
    falls die Spalte noch nicht existiert (prüfen).

### P0 — Pipeline-Integration
- [ ] `lib/classifier/profil.ts` neu: lädt das Profil per `holeProfil(supabase,
  owner_id): Promise<MeinProfil | null>` mit Caching pro Klassifizierungs-Job.
  Pro Job ein einziger DB-Load, dann in-memory durchgereicht.
- [ ] LLM-Eingabe-Typ erweitern um `mein_profil?: MeinProfil`. Prompt
  erhält neuen Block:
  ```
  Persönliche Stammdaten des Inhabers:
  - Arbeitgeber: {Liste, kommasepariert}
  - Wohnort: {PLZ Ort}
  - Familienmitglieder: {Liste mit Rollen}
  - Eigene Bankkonten: {Liste der IBAN-Schwänze oder Bezeichnungen}
  
  WICHTIGE Regeln:
  - Eine Buchung VON einem Arbeitgeber ist Privat-Gehalt
    (Klassifikation 'privat', Kategorie: privat-gehalt-äquivalent).
  - Eine Buchung AN/VON einem Familienmitglied ist Privatentnahme/
    Privateinlage (neutral, neutral).
  - Eine Buchung zwischen eigenen Bankkonten ist Geldtransit (neutral).
  - Bei Übereinstimmung mit Wohnort/PLZ in Empfänger/Verwendungszweck
    deutet das auf Privat-Bezug hin (Wohnung, lokale Anbieter).
  ```
- [ ] Pipeline filtert Web-Recherche: wenn Empfänger einem Familien-
  mitglied entspricht (normalisierter Match), KEIN Firecrawl-Call.
- [ ] DSGVO: Web-Recherche-Gate `istRechercheKandidat` aus PROJ-15
  bekommt eine Negativ-Liste basierend auf `mein_profil_familie`.

### P0 — Regel-Vorschläge (Bonus, klein)
- [ ] Nach dem Anlegen eines Arbeitgebers: Toast-Hint „Soll ich für
  diesen Arbeitgeber automatisch eine Lernregel anlegen, die seine
  Buchungen als Privat-Gehalt klassifiziert?" mit Ja-Button. Wenn Ja:
  Lernregel mit `empfaenger_muster=<name_normalisiert>` und
  `aktion={klassifikation:'privat',kategorie_id:<gehalt-kategorie>}`.

### P1 — Auswirkung auf Re-Klassifizierung
- [ ] Beim nächsten Klassifizierungs-Lauf wird das Profil in den
  Pipeline-Kontext geladen und für alle Buchungen genutzt.
- [ ] `Profil geändert seit letztem Lauf` → Hint im Klassifizierungs-
  Panel: „Profil wurde geändert, ein Re-Lauf könnte 5 Buchungen neu
  klassifizieren."

## Edge Cases
- **Mehrere Arbeitgeber** (Job-Wechsel): beide Einträge bleiben mit
  `aktiv_von`/`aktiv_bis`. Pipeline beachtet das Datum.
- **Arbeitgeber identisch mit Geschäftskunde**: konfliktbehaftet. Heuristik:
  hat der Verwendungszweck „Lohn", „Gehalt", „Bezüge" → Privat-Gehalt.
  Sonst → Geschäftskunde-Default des LLMs. Im Zweifel Prüfliste.
- **Familienmitglied mit Firmen-Bezug** (Ehepartner ist auch Geschäftspartner):
  manuell entscheidbar. Profil-Eintrag hat optionales Feld
  `auch_geschaeftspartner: boolean`. Wenn true, kein automatischer
  Privat-Tag.
- **Adress-Match Fuzzy**: PLZ exakt prüfen, Ort case-insensitive, Straße
  Substring-Match. Falsch-Positive durch generische Orte („Münchner" in
  „Münchner Verkehrsverbund" → München-Match, aber MVV ist auch eigentlich
  privat → wahrscheinlich richtig). Keine perfekte Logik, dokumentieren.
- **Eigene Konten als Geldtransit**: wenn beide Konten der Buchung in
  `konto`-Tabelle stehen und beide `ist_eigenes_konto=true`, dann
  Geldtransit. Sonst nur Hint via Profil-Liste.

## Technical Requirements
- **Performance**: Profil wird pro Klassifizierungs-Job EINMAL geladen
  (DB-Call), nicht pro Buchung. In-Memory durchgereicht via
  `PipelineKontext.mein_profil`.
- **Sicherheit**: RLS auf allen neuen Tabellen, Owner-scoped. Audit-
  Einträge bei Mutationen. Familienmitglieder-Namen sind PII —
  niemals zu Firecrawl, niemals in Web-Cache.
- **Auditierbarkeit**: jede Profil-Mutation erzeugt `audit_eintrag` mit
  `aktion in ('profil_arbeitgeber_aktualisiert', ...)`.

---

## Tech Design

### Backend-Bedarf: Ja
4 neue Tabellen, 4-5 API-Routen, eine neue Pipeline-Komponente, UI-
Bereich mit 4 Sektionen.

### Datenmodell
Siehe oben. Schlüssel sind alle UUID, owner-scoped.

### Komponentenstruktur
```
/profil (neue Page)
├── ProfilArbeitgeberKarte  (Liste + Add/Edit-Dialog)
├── ProfilAdresseKarte      (Inline-Formular, single-row)
├── ProfilFamilieKarte      (Liste + Add/Edit-Dialog)
└── ProfilKontenKarte       (Anzeige existierender Konten + Toggle)

lib/classifier/profil.ts    (Service: holeProfil, formatiereFuerLlm)
lib/validation/profil.ts    (Zod-Schemata)

api/profil/arbeitgeber/route.ts        GET, POST
api/profil/arbeitgeber/[id]/route.ts   PATCH, DELETE
api/profil/familie/route.ts            GET, POST
api/profil/familie/[id]/route.ts       PATCH, DELETE
api/profil/adresse/route.ts            GET, PUT
api/profil/route.ts                    GET (alles zusammen, für Pipeline)
```

### LLM-Prompt-Erweiterung
Siehe Acceptance Criteria. Block wird nur eingefügt, wenn Profil
nicht leer.

### Abhängigkeiten (Pakete)
Keine neuen.

## Implementierungsnotizen
_(wird beim Bau gefüllt)_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
