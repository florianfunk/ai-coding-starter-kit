# PROJ-21: Lieferanten-Notizen (Notizen pro wiederkehrendem Empfänger)

## Status: Approved
**Created:** 2026-06-15
**Last Updated:** 2026-06-15
**Priorität:** P2

## Implementierungsnotizen
- **DB:** Migration `0011_lieferant_notiz.sql` — neue Tabelle `lieferant_notiz`
  (1:n je Lieferant), Schlüssel `owner_id + empfaenger_norm`. Indizes für
  Drilldown (`owner_id, empfaenger_norm`) und Übersicht
  (`owner_id, aktualisiert_am desc`). RLS owner-scoped (4 Policies, wie
  `empfaenger_kuendigung`). CHECK-Constraints auf `inhalt` (1–2000) und
  `empfaenger_norm` (2–300) als DB-seitige Härtung. **Kein** updated_at-Trigger
  (Tabelle nutzt `aktualisiert_am`, der gemeinsame Trigger schreibt
  `updated_at`) — `aktualisiert_am` wird im PATCH explizit gesetzt.
- **API:** `GET/POST /api/finanzen/lieferanten/notizen` und
  `PATCH/DELETE …/[id]`. GET hat drei Modi (alle gruppiert · `?norm=` flach ·
  `?buchung_id=` löst Empfänger auf, read-only). Alle Auth-Pflicht,
  Zod-validiert, owner-scoped, Audit-Eintrag (`entitaet="lieferant_notiz"`).
- **Lieferanten-Tab:** bestehende Route `/api/finanzen/lieferanten` um
  `notiz_anzahl` + `notiz_vorschau` je Item erweitert (eine Extra-Abfrage,
  per `.in(empfaenger_norm)` auf die Items gefiltert — kein N+1, kein Over-Fetch).
- **Frontend:** wiederverwendbares `LieferantNotizenPanel` (CRUD, optimistisch,
  Lösch-Bestätigung via AlertDialog) im Drilldown (lazy) und auf der
  Übersichtsseite `/lieferanten-notizen` (Sidebar „Bücher"). Notiz-Badge in der
  Lieferanten-Zeile (Tooltip = Vorschau). Read-only Notiz-Block im
  Buchungs-Detail-Sheet (`components/buchungen/…`) mit Link zur Übersicht.
- **Helper:** reine Logik in `src/lib/finanzen/lieferant-notizen.ts`
  (`gruppiereNotizen`, `notizVorschau`) — 9 Unit-Tests.

## Dependencies
- Requires: PROJ-18 (Lieferanten-Tab) — liefert die Lieferanten-Sicht (Zeile + Drilldown) und die Empfänger-Aggregation
- Requires: PROJ-15 (Klassifizierung-Pro) — `empfaenger_normalisiert` als stabiler Lieferanten-Schlüssel
- Requires: PROJ-1 (Auth) — owner_id-Scope / RLS
- Verwandt: PROJ-20 (Merkliste) — gleiches Muster „Eintrag + eigene Übersichtsseite", aber auf Buchungs- statt Lieferantenebene

## Beschreibung
Der Inhaber will pro Lieferant (= wiederkehrender Empfänger aus dem
Lieferanten-Tab) freie Notizen festhalten — z. B. „Diese Abbuchung ist die
Adobe-Creative-Cloud-Lizenz, jährlich, geschäftlich" oder „PayPal-Belastung
gehört zu Lizenz X". Es geht **nicht** um Stammdaten (Adresse/Kontakt),
sondern um Gedächtnisstützen, die erklären, **wozu** die Buchungen eines
Empfängers gehören (Software, Lizenz, Vertrag, Zweck).

Analog zur Merkliste (PROJ-20), aber eine Ebene höher: nicht eine einzelne
Buchung wird gemerkt, sondern es hängen mehrere datierte Notiz-Einträge an
einem Empfänger. Da Lieferanten keine eigene DB-Tabelle haben (PROJ-18
aggregiert on-the-fly aus `buchung` nach `empfaenger_normalisiert`), werden
Notizen über den **normalisierten Empfänger** an den Owner gebunden.

## User Stories
- Als Inhaber möchte ich zu einem Lieferanten im Drilldown eine Notiz hinzufügen, damit ich festhalten kann, zu welcher Software/Lizenz/Abbuchung seine Buchungen gehören.
- Als Inhaber möchte ich mehrere Notizen pro Lieferant anlegen (mit Zeitstempel) und einzelne wieder löschen, damit ich nach und nach Erkenntnisse sammeln und veraltete Hinweise entfernen kann.
- Als Inhaber möchte ich in der Lieferanten-Liste auf einen Blick sehen, welche Lieferanten bereits eine Notiz haben, damit ich erkenne, wo schon Kontext hinterlegt ist.
- Als Inhaber möchte ich eine Übersichtsseite mit allen Lieferanten-Notizen, damit ich meinen gesammelten Kontext zentral durchsehen kann, ohne jeden Lieferanten einzeln aufzuklappen.
- Als Inhaber möchte ich beim Öffnen einer einzelnen Buchung sehen, ob für diesen Empfänger eine Lieferanten-Notiz existiert, damit ich den hinterlegten Zweck direkt beim Bewerten der Buchung vor Augen habe.

## Acceptance Criteria

### Notiz-Verwaltung (CRUD)
- [x] Pro Lieferant (Schlüssel: `owner_id` + `empfaenger_normalisiert`) können **mehrere** Notiz-Einträge angelegt werden
- [x] Ein Notiz-Eintrag hat: Freitext (Pflicht, nicht leer), Erstell-Zeitstempel, optional Bearbeitungs-Zeitstempel
- [x] Notiz hinzufügen: Eingabefeld + „Hinzufügen", neuer Eintrag erscheint sofort (optimistisch, mit Rollback bei Fehler)
- [x] Einzelne Notiz bearbeiten (Text ändern) und einzeln löschen
- [x] Notizen werden nach Erstell-Zeitpunkt sortiert (neueste zuerst)
- [x] Freitext-Länge begrenzt (z. B. max. 2.000 Zeichen), leere/whitespace-only Eingaben werden abgelehnt

### Lieferanten-Tab (PROJ-18) Integration
- [x] Im Lieferanten-Drilldown gibt es einen Notiz-Bereich: Liste vorhandener Notizen + Eingabe für neue Notiz
- [x] In der Lieferanten-Zeile (eingeklappt) zeigt ein dezentes Notiz-Icon/Badge an, dass ≥ 1 Notiz existiert; Tooltip/Hover zeigt die jüngste Notiz als Vorschau (gekürzt)
- [x] Lieferanten ohne Notiz zeigen kein Badge
- [x] Notiz-Badge respektiert den Empfänger-Schlüssel, nicht den Filter — d. h. eine Notiz bleibt sichtbar, egal welcher Zeitraum-/Konto-Filter aktiv ist

### Übersichtsseite
- [x] Eigene Seite (z. B. `/lieferanten-notizen`) mit Sidebar-Eintrag, listet alle Lieferanten, die mindestens eine Notiz haben
- [x] Pro Lieferant: angezeigter Empfänger-Name + alle Notizen (oder die jüngste mit „mehr"-Aufklappen) + Zeitstempel
- [x] Notizen können auf der Übersichtsseite bearbeitet/gelöscht werden (gleiche Aktionen wie im Drilldown)
- [x] Sortierung: nach jüngstem Notiz-Zeitpunkt absteigend (zuletzt ergänzte Lieferanten oben)
- [x] Leerer Zustand: Hinweis „Noch keine Lieferanten-Notizen — leg im Lieferanten-Tab beim Aufklappen eines Lieferanten eine Notiz an."

### Buchungs-Detail Integration
- [x] Beim Öffnen einer einzelnen Buchung (Buchung-Detail-Sheet) wird, falls für deren `empfaenger_normalisiert` eine Lieferanten-Notiz existiert, ein **read-only** Hinweisblock mit den Notizen dieses Empfängers angezeigt
- [x] Der Hinweis verlinkt/leitet zum Lieferanten (oder zur Übersichtsseite), wo die Notiz bearbeitet werden kann
- [x] Buchungen ohne `empfaenger_normalisiert` oder ohne Notiz zeigen keinen Block

### Sicherheit & Nachvollziehbarkeit
- [x] Alle Notiz-Operationen sind strikt owner-scoped (RLS + explizit in der Query)
- [x] Anlegen/Bearbeiten/Löschen erzeugt einen `audit_eintrag` (Quelle „nutzer")

## Edge Cases
- Empfänger ohne `empfaenger_normalisiert` (Altdaten) → Fallback auf `normalisiereEmpfaenger(empfaenger)` für den Notiz-Schlüssel; ist auch das leer → keine Notiz möglich
- Lieferant hat aktuell keine Buchungen mehr im aktiven Filterzeitraum → Notiz existiert weiter (an Empfänger gebunden) und erscheint auf der Übersichtsseite; im Lieferanten-Tab nur, wenn der Empfänger durch den Filter überhaupt als Lieferant auftaucht
- Mehrere Roh-Empfängerschreibweisen normalisieren auf denselben Schlüssel → teilen sich **eine** Notizsammlung (gewollt, das ist der Lieferant). Angezeigter Name = häufigste Roh-Schreibweise
- Sehr lange Notiz → wird in Zeile/Tooltip gekürzt, voll im Drilldown/Übersicht sichtbar
- Leere oder nur-Leerzeichen-Notiz → abgelehnt (Validierung), kein Eintrag angelegt
- Notiz löschen, während sie an anderer Stelle (Übersichtsseite vs. Drilldown) offen ist → optimistisches Entfernen, beim Reload verschwunden; kein harter Fehler bei Doppel-Löschung (idempotent)
- Empfänger, der gleichzeitig als Abo (PROJ-14) und nicht als Lieferant erscheint → Notiz ist trotzdem über den Empfänger-Schlüssel auffindbar (Übersichtsseite + Buchungs-Detail); ob im Abo-Tab ein Indikator gezeigt wird, ist NICHT Teil dieser Spec (siehe Non-Goals)

## Technical Requirements
- Performance: Notiz-Vorhandensein für die Lieferanten-Liste in **einer** Query laden (Set/Map von `empfaenger_normalisiert` → Notiz-Existenz/Count), kein N+1
- Sicherheit: neue Tabelle owner-scoped mit RLS; Zod-Validierung für Text (nicht leer, Längenlimit)
- Konsistenz: gleicher Normalisierungs-Helper wie PROJ-15/PROJ-18 (`normalisiereEmpfaenger`), damit Schlüssel zwischen Buchung, Lieferant und Notiz identisch sind

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Kernentscheidung
Ein „Lieferant" ist keine DB-Entität, sondern der **normalisierte Empfänger**
(`empfaenger_norm`) — derselbe Schlüssel, mit dem schon PROJ-15
(Empfänger-Cache), PROJ-18 (Lieferanten-Tab) und PROJ-19 (Kündigungsliste)
arbeiten. Notizen werden an `owner_id + empfaenger_norm` gehängt. Dadurch:
- teilen sich alle Buchungen desselben Empfängers automatisch eine Notiz-Sammlung,
- bleiben Notizen bei Re-Imports und Filterwechseln erhalten,
- gelten sie auch für künftige Buchungen.

Vorbild für das gesamte Muster ist **PROJ-19 (Kündigungsliste)** — gleiche
Schlüssel-Logik, gleiche RLS-Struktur. Unterschied: pro Lieferant gibt es
**mehrere** Notiz-Zeilen (1:n) statt einer Markierung (1:1).

### Datenmodell (Klartext)
Neue Tabelle **`lieferant_notiz`** — eine Zeile pro Notiz-Eintrag:
- `id` — eindeutige ID des Eintrags
- `owner_id` — Eigentümer (wie überall; RLS-Anker)
- `empfaenger_norm` — normalisierter Empfänger = der „Lieferant"
- `rohwert_beispiel` — eine Beispiel-Originalschreibweise (nur für die Anzeige)
- `inhalt` — der Notiztext (Pflicht, 1–2.000 Zeichen)
- `erstellt_am` / `aktualisiert_am` — Zeitstempel (Sortierung & „bearbeitet"-Hinweis)

Indizes: nach (`owner_id`, `empfaenger_norm`) für die Drilldown-/Detail-Abfrage
und nach (`owner_id`, `aktualisiert_am desc`) für die Übersichtsseite.
RLS: owner-scoped (SELECT/INSERT/UPDATE/DELETE), identisch zu
`empfaenger_kuendigung`. `set_updated_at`-Trigger wie gehabt.

**Keine** Änderung an `buchung` oder anderen Tabellen.

### API
- `GET /api/finanzen/lieferanten/notizen` — Liste. Drei Modi über Query:
  - ohne Parameter → alle Notizen des Owners (für die Übersichtsseite, gruppiert je Lieferant)
  - `?norm=<empfaenger_norm>` → nur die Notizen eines Lieferanten (Drilldown, lazy beim Aufklappen)
  - `?buchung_id=<id>` → löst serverseitig den `empfaenger_normalisiert` der Buchung auf und liefert dessen Notizen (read-only-Block im Buchungs-Detail; gleiche Mechanik wie `/api/empfaenger-kenntnis`)
- `POST /api/finanzen/lieferanten/notizen` — Notiz anlegen. Body `{ empfaenger, inhalt }`; Empfänger wird serverseitig normalisiert.
- `PATCH /api/finanzen/lieferanten/notizen/[id]` — Text einer Notiz ändern.
- `DELETE /api/finanzen/lieferanten/notizen/[id]` — Notiz löschen (idempotent).
- Alle: Auth Pflicht, Zod-validiert, owner-scoped, Audit-Eintrag (`entitaet="lieferant_notiz"`, quelle „nutzer").

### Anreicherung des Lieferanten-Tabs (PROJ-18)
Die bestehende Route `GET /api/finanzen/lieferanten` lädt zusätzlich die
Notiz-Anzahl + jüngste Notiz je `empfaenger_norm` (eine kleine Extra-Abfrage,
Tabelle ist winzig) und hängt pro Item `notiz_anzahl` und `notiz_vorschau`
an. Damit zeigt die Lieferanten-Zeile ein dezentes Notiz-Badge (Tooltip =
Vorschau) ohne N+1.

### Komponentenstruktur
```
Lieferanten-Tab (PROJ-18, bestehend)
+-- LieferantItemRow
    +-- Notiz-Badge (NEU, wenn notiz_anzahl > 0; Tooltip = Vorschau)
    +-- LieferantDrilldown (bestehend)
        +-- LieferantNotizenPanel (NEU, lazy)   ← wiederverwendbar
            +-- Notiz-Liste (Eintrag: Text + Datum + Bearbeiten/Löschen)
            +-- Neue-Notiz-Eingabe (Textarea + "Hinzufügen")

Seite /lieferanten-notizen (NEU, Sidebar „Heute")
+-- LieferantenNotizenAnsicht
    +-- pro Lieferant: Name + LieferantNotizenPanel (dieselbe Komponente)

Buchungs-Detail-Sheet (bestehend, components/buchungen/…)
+-- Lieferanten-Notiz-Hinweis (NEU, read-only; Link zur Übersicht)
```
`LieferantNotizenPanel` ist die zentrale, wiederverwendbare Einheit (CRUD,
optimistisch) — genutzt im Drilldown und auf der Übersichtsseite.

### Tech-Entscheidungen (Begründung)
- **Eigene Tabelle statt Spalte** (anders als Merkliste/PROJ-20): Mehrere
  datierte Einträge pro Lieferant brauchen 1:n — eine Spalte auf `buchung`
  würde nicht passen, zumal der Lieferant über `buchung` hinweg existiert.
- **Schlüssel = `empfaenger_norm`**: konsistent zu PROJ-15/18/19; macht die
  Notiz buchungs- und importübergreifend stabil.
- **Lazy-Laden im Drilldown**: hält die Lieferanten-Listen-Antwort schlank;
  volle Notizen erst beim Aufklappen.
- **Read-only im Buchungs-Detail**: Bearbeiten passiert an einem Ort
  (Lieferant), der Buchungs-Kontext zeigt nur den hinterlegten Zweck.

### Abhängigkeiten (Pakete)
Keine neuen. shadcn-Komponenten (Textarea, Card, Badge, Tooltip, Button)
sind vorhanden bzw. werden bei Bedarf via `npx shadcn add` ergänzt.

### Bewusst NICHT enthalten (YAGNI)
- Keine Lieferanten-Stammdaten (Adresse/Kontakt) — eigenes Feature.
- Kein Markdown/Datei-Anhang in Notizen — reiner Text.
- Kein Bearbeiten der Notiz aus dem Buchungs-Detail heraus (nur Anzeige + Link).
- Kein Notiz-Indikator im Abo-Radar (Scope auf Lieferanten-Tab begrenzt).

## QA Test Results

**Datum:** 2026-06-15 · **Ergebnis:** Production-ready (keine Critical/High offen)

### Automatisiert
- `npx tsc --noEmit` — fehlerfrei
- `npm run lint` — 0 Errors (nur vorbestehende Warnungen, nichts aus PROJ-21)
- `npm test` — **632 Tests grün** (34 Dateien), inkl. 9 neuer Unit-Tests für
  `gruppiereNotizen`/`notizVorschau`
- `npm run build` — erfolgreich; Routen registriert:
  `/lieferanten-notizen`, `/api/finanzen/lieferanten/notizen`,
  `/api/finanzen/lieferanten/notizen/[id]`

### Akzeptanzkriterien
Alle abgehakt (siehe oben). Notiz-CRUD, Drilldown-Panel, Zeilen-Badge,
Übersichtsseite und read-only Buchungs-Detail-Block implementiert und über
Build/Typen/Unit-Tests abgesichert.

### Security-Audit (Red-Team)
Eigene neue Dateien adversarial geprüft (Security Auditor Agent):
- **Keine** Critical-Findings, **kein** IDOR (jede Query owner-scoped + RLS),
  **kein** XSS (React-Escaping, kein `dangerouslySetInnerHTML`), keine
  SQL-Injection (Supabase-Parametrisierung), keine Secrets, `owner_id` nie in
  Responses.
- 2× High **behoben**: rohe Supabase-`error.message` wurde an den Client
  zurückgegeben → jetzt generische Meldung + serverseitiges `console.error`
  (POST/PATCH/DELETE).
- Härtungen **umgesetzt**: `norm`-Query auf 300 Zeichen gekappt;
  Notiz-Anreicherung per `.in(empfaenger_norm)` gefiltert (kein Over-Fetch);
  DB-CHECK-Constraints auf `inhalt`/`empfaenger_norm`.

### Hinweise / bewusst offen
- Keine E2E-Specs ergänzt — das Repo hat 0 Playwright-Specs; Konvention ist
  co-located Unit-Tests + Build (identisch zu PROJ-20). Browser-E2E bräuchte
  Login + geseedete Supabase-Daten.
- Idempotentes DELETE liefert auch bei fremder/fehlender ID `200 ok`
  (Single-Tenant, kein State-Change, kein IDOR) — bewusst so.

## Deployment
_To be added by /deploy_
