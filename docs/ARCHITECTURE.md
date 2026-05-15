# STEUERAGENT — Gesamt-Architektur

> Architektur-Überblick für alle 12 Features. PM-lesbar, keine Implementierungsdetails.
> Single-Tenant Steuer-/Buchhaltungs-Agent für eine eigene Firma.

## 1. Leitprinzipien

1. **Single-Tenant, aber sicher** — genau ein Nutzer. Trotzdem strikte Authentifizierung und EU-Datenhaltung, weil Steuerdaten hochsensibel sind.
2. **Determinismus vor KI** — alle steuerlichen Endsummen (USt-VA, EÜR, ESt) werden rein rechnerisch gebildet, niemals von der KI. Die KI schlägt nur Kategorien/Klassifikationen vor.
3. **Nachvollziehbarkeit** — jede Agenten-Entscheidung hat Begründung, Konfidenz und einen Audit-Eintrag. Keine Blackbox.
4. **Unveränderliche Wahrheit** — manuell bestätigte Buchungen und abgeschlossene Steuerperioden sind „eingefroren" und überleben jeden Re-Lauf.
5. **Eine Datenquelle pro Sache** — Stammdaten, Kontenrahmen und Buchungen haben je genau einen verbindlichen Speicherort.

## 2. System-Überblick (Datenfluss)

```
Paperless-ngx  ──(API-Sync)──┐
                             ├──► [Belege + OCR-Text]
Excel/CSV-Upload ─(Import)───┘            │
   (Bank/PayPal/2x Kreditkarte)           ▼
                              ┌─────────────────────────┐
[Kontobuchungen] ───────────► │  KLASSIFIZIERUNGS-       │
                              │  PIPELINE (der Agent)    │
   Lernregeln ───(Vorrang)──► │  1. Regeln anwenden      │
   Kontenrahmen ───(Ziel)───► │  2. KI-Vorschlag (LLM)   │
                              │  3. Konfidenz bewerten   │
                              └───────────┬─────────────┘
                            hohe Konfidenz │ niedrige Konfidenz
                            ▼              ▼
                   [auto-verbucht]   [Prüfliste] ──► Nutzer entscheidet
                            │                              │
                            ▼              neue Lernregel ◄─┘
                   [Beleg↔Buchung-Matching]
                            │
                            ▼
        ┌──────────────┬─────────────┬──────────────┐
        ▼              ▼             ▼              ▼
    USt-VA         Jahres-EÜR    ESt-Vorschau    Export
   (PROJ-8)        (PROJ-9)      (PROJ-10)      (PROJ-11)
        └──────────────┴─────────────┴──────────────┘
                            ▼
                   Dashboard (PROJ-12)
```

## 3. Technische Grundsatzentscheidungen (mit Begründung)

### Backend: Supabase (PostgreSQL + Auth + Storage), EU-Region
**Warum:** Steuerdaten dürfen die EU nicht verlassen (DSGVO). Supabase bietet Auth, relationale DB und Datei-Storage in einem, in EU-Region hostbar. Bereits im Starter-Kit vorhanden.

### Authentifizierung: Supabase Auth, E-Mail/Passwort, genau ein Account
**Warum:** Single-Tenant. Eine Allow-List mit genau einer E-Mail verhindert Fremd-Registrierung. Alle Daten- und API-Zugriffe sind durch Session geschützt; zusätzlich Row-Level-Security als zweite Verteidigungslinie.

### KI-Strategie: LLM über serverseitigen Proxy, DSGVO-konform, mit Regel-Vorrang
**Warum:**
- Die KI läuft **nie im Browser**, sondern ausschließlich serverseitig (Next.js Route Handler), damit keine API-Schlüssel und keine Steuerdaten zum Client gelangen.
- **Datensparsamkeit:** an das LLM gehen nur Buchungstext, Betrag, Empfänger und ggf. Beleg-Stichworte — **keine** Steuernummer, USt-IdNr. oder vollständige Kontodaten.
- **EU-Verarbeitung & Zero-Retention:** Der LLM-Zugang wird über einen Anbieter mit EU-Datenverarbeitung und ohne Trainings-/Langzeitspeicherung der Eingaben angebunden (über AI Gateway konfigurierbar, Modell austauschbar).
- **Regeln schlagen KI:** gespeicherte Lernregeln werden **vor** dem LLM deterministisch angewandt. Die KI wird nur befragt, wenn keine Regel greift.
- **Fallback:** Ist der LLM-Dienst nicht erreichbar, greift nur die Regel-Engine; alles Übrige wandert in die Prüfliste. Kein Datenverlust, kein Raten.

### Steuerlogik: deterministische Rechenmodule, keine KI in Summen
**Warum:** USt-VA, EÜR und ESt-Schätzung müssen rechnerisch belastbar und reproduzierbar sein. Diese Module aggregieren ausschließlich bestätigte/auto-verbuchte Datensätze nach festen Regeln. Steuertarife und ELSTER-Feld-Mappings sind als pflegbare Stammdaten hinterlegt, nicht hartkodiert.

### Frontend: Next.js 16 App Router + shadcn/ui (vollständig vorhanden)
**Warum:** Komponenten-Bibliothek ist komplett installiert — keine UI-Bibliothek nachinstallieren. Server Components für Datenlisten, Client Components nur wo interaktiv (Formulare, Prüfliste).

### Lange Läufe: Hintergrund-Jobs statt Request-Blockierung
**Warum:** Paperless-Sync und Massen-Klassifizierung können tausende Datensätze betreffen. Diese laufen als asynchrone Jobs mit sichtbarem Fortschritt/Status, statt eine Seite minutenlang zu blockieren.

## 4. Gemeinsames Datenmodell (Klartext, kein SQL)

Zentrale Informationsobjekte, die quer über alle Features genutzt werden:

- **Firmenprofil** — Firmenstammdaten, Steuerprofil (Rechtsform, USt-Status, Wirtschaftsjahr, USt-VA-Rhythmus). *Genau ein Datensatz.* (PROJ-1)
- **Kontenrahmen-Kategorie** — EÜR-Kategorie mit Typ (Einnahme/Ausgabe/Privat/Neutral), USt-Satz, EÜR-Zeile, ELSTER-Kennzahl, aktiv/inaktiv. (PROJ-2)
- **Bankkonto** — ein Konto (Bank/PayPal/Kreditkarte) inkl. gespeicherter Spalten-Mapping-Vorlage. (PROJ-4)
- **Beleg** — aus Paperless importiertes Dokument: Paperless-ID, Datum, Korrespondent, Betrag, Tags, OCR-Volltext, Status. (PROJ-3)
- **Buchung** — eine Kontobewegung: Konto, Datum, Betrag, Verwendungszweck, Empfänger, plus Klassifizierungs-Ergebnis (Kategorie, privat/geschäftlich, Steuerrelevanz, Konfidenz, Begründung, Status: offen/auto-verbucht/zur-Prüfung/manuell-bestätigt). Kann in Teilbuchungen aufgeteilt sein. (PROJ-4/5/7)
- **Beleg-Buchung-Zuordnung** — Verknüpfung mit Match-Score, Kriterien, Status (auto/manuell/unsicher). N:M möglich. (PROJ-6)
- **Lernregel** — Bedingung (Muster auf Empfänger/Zweck, Konto, Betragsbereich) → Aktion (Kategorie, USt, privat/geschäftlich), Priorität, aktiv, Trefferzähler. (PROJ-7)
- **Steuerperiode** — USt-VA-Zeitraum bzw. Wirtschaftsjahr mit Status (offen/geprüft/abgeschlossen) und eingefrorenem Zahlen-Snapshot. (PROJ-8/9)
- **Audit-Eintrag** — wer/was/wann/welche Regel-oder-KI/Ergebnis. Quer über alle entscheidungsrelevanten Aktionen. (PROJ-5/7)
- **Job/Sync-Lauf** — Status, Fortschritt, Fehler eines Hintergrundlaufs (Paperless-Sync, Import, Massen-Klassifizierung). (PROJ-3/4/5)

Alle Tabellen tragen einen Eigentümer-Bezug und sind per Row-Level-Security abgesichert (Single-Tenant-Garantie auf DB-Ebene).

## 5. Modul-/Verzeichnisstruktur (geplant)

```
src/
  app/
    (auth)/login/                Login-Seite
    (app)/
      dashboard/                 PROJ-12  Startseite
      einstellungen/
        firma/                   PROJ-1   Firmen-/Steuerprofil
        kontenrahmen/            PROJ-2   EÜR-Kategorien
        paperless/               PROJ-3   Paperless-Verbindung
        konten/                  PROJ-4   Bankkonten + Mapping
        regeln/                  PROJ-7   Lernregel-Verwaltung
      belege/                    PROJ-3   importierte Belege
      buchungen/                 PROJ-4/5 Buchungsliste + Klassifikation
      pruefliste/                PROJ-7   Ausnahmen-Workflow
      abgleich/                  PROJ-6   Matching + Fehllisten
      ust-voranmeldung/          PROJ-8
      euer/                      PROJ-9
      einkommensteuer/           PROJ-10  ESt-Vorschau + Privatentnahmen
      export/                    PROJ-11
    api/
      paperless/sync/            PROJ-3   Sync-Job-Trigger/-Status
      konten/import/             PROJ-4   Excel/CSV-Verarbeitung
      klassifizierung/           PROJ-5   Pipeline-Trigger (serverseitig, LLM-Proxy)
      abgleich/                  PROJ-6   Re-Matching
      steuer/ust|euer|est/       PROJ-8/9/10  Berechnung
      export/                    PROJ-11
  lib/
    supabase.ts                  (vorhanden) DB-Client
    auth/                        Session-/Guard-Helfer
    paperless/                   Paperless-API-Adapter
    importer/                    Excel/CSV-Parser + Mapping
    classifier/                  Regel-Engine + LLM-Proxy + Konfidenz
    matching/                    Beleg↔Buchung-Algorithmus
    tax/                         USt-/EÜR-/ESt-Rechenmodule (rein deterministisch)
    export/                      PDF-/CSV-/ELSTER-Generatoren
  components/
    ui/                          (vorhanden) shadcn — NIE neu bauen
    <feature>/                   feature-spezifische Komponenten
```

## 6. Abhängigkeits- & Build-Reihenfolge

```
PROJ-1 ─► PROJ-2 ─► PROJ-3 ┐
                   PROJ-4 ┴─► PROJ-5 ─► PROJ-6 ─► PROJ-7
                                           ├─► PROJ-8 ┐
                                           └─► PROJ-9 ┴─► PROJ-10 ─► PROJ-11 ─► PROJ-12
```

Implementierungsreihenfolge: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12.
Begründung: Fundament (Auth/Profil) zuerst, dann Zielsystematik (Kontenrahmen), dann beide Datenquellen, dann das Herzstück (Klassifizierung), dann Abgleich/Ausnahmen, dann die Auswertungen, zuletzt Export und Übersicht.

## 7. Neue Abhängigkeiten (Pakete)

- **@supabase/ssr** — sichere Server-/Session-Anbindung von Supabase in Next.js (Auth-Guards).
- **xlsx (SheetJS)** — Excel-Dateien (Kontoauszüge) parsen.
- **ai** (Vercel AI SDK) — einheitlicher, anbieterunabhängiger LLM-Zugang über AI Gateway (serverseitig, austauschbares Modell, EU/Zero-Retention konfigurierbar).
- **@react-pdf/renderer** — PDF-Aufstellungen für EÜR/USt-VA/Privatentnahmen.
- **date-fns** — robuste Datums-/Periodenlogik (Wirtschaftsjahr, Zufluss-/Abflussprinzip).

shadcn/ui, Zod, react-hook-form, Supabase-Client sind bereits vorhanden und werden wiederverwendet.

## 8. Querschnitts-Sicherheit & DSGVO

- Alle App-Routen und APIs sind ohne gültige Session nicht erreichbar.
- Paperless-API-Token und hochgeladene Kontodateien werden verschlüsselt bzw. in geschütztem Storage abgelegt, nie geloggt, nie an den Client gegeben.
- An das LLM gehen ausschließlich minimierte Buchungsmerkmale, keine personenidentifizierenden Steuermerkmale.
- Row-Level-Security als zweite Schutzschicht auf jeder Tabelle.
- Steuerlich relevante Endergebnisse sind reproduzierbar und auditierbar.

---
_Erstellt von /architecture. Detail-Designs je Feature stehen im jeweiligen Spec unter „Tech Design (Solution Architect)"._
