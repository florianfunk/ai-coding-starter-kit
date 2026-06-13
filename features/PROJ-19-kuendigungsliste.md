# PROJ-19: Kündigungsliste für wiederkehrende Empfänger

## Status: In Review
**Created:** 2026-06-13
**Last Updated:** 2026-06-13

> Hinweis: Dieses Spec wurde **nachträglich** zur bereits erfolgten
> Implementierung geschrieben (Reverse-Spec / „as built"), damit das
> Feature den Tracking-Konventionen entspricht.

## Dependencies
- Requires: PROJ-15 (Klassifizierung-Pro) — `empfaenger_normalisiert`-Spalte / `normalisiereEmpfaenger()` als gemeinsamer Cache-Key
- Requires: PROJ-14 (Kategorien-Analyse) — Abo-Radar als Einstiegspunkt zum Markieren
- Requires: PROJ-1 (Auth) — `owner_id`/RLS, `getApiUser()`

## Beschreibung
Der Abo-Radar (PROJ-14) deckt wiederkehrende Abbuchungen auf. Oft will der
Inhaber daraufhin einen Empfänger **kündigen** (Streaming, Software-Abo,
Versicherung) und braucht eine Merkliste, die das über mehrere Monate und
über Re-Imports hinweg festhält — bis die letzte Abbuchung durch ist.

Dieses Feature gibt jedem normalisierten Empfänger eine optionale
**Kündigungs-Absicht** mit kleiner Status-Maschine
`offen → gekündigt → beendet`. Markiert wird direkt aus dem Abo-Radar
heraus; die eigene Seite `/kuendigungen` führt alle Markierungen mit
Status, Notiz und aggregierter Kostenschätzung zusammen.

Der Schlüssel ist `empfaenger_norm` (derselbe Cache-Key wie
`empfaenger_kenntnis` und `buchung.empfaenger_normalisiert`). Dadurch bleibt
die Markierung bei Re-Imports erhalten und gilt automatisch für alle
Buchungen desselben Empfängers — auch zukünftige.

## User Stories
- Als Inhaber möchte ich einen wiederkehrenden Empfänger aus dem Abo-Radar mit einem Klick „zur Kündigung markieren", damit ich ihn nicht vergesse.
- Als Inhaber möchte ich auf einer eigenen Seite alle markierten Empfänger sehen — mit geschätzter Jahresbelastung —, damit ich priorisieren kann, was sich zu kündigen lohnt.
- Als Inhaber möchte ich pro Eintrag den Status pflegen (offen → gekündigt → beendet) und eine Notiz hinterlegen, damit ich den Kündigungsfortschritt nachhalte.
- Als Inhaber möchte ich eine Markierung wieder entfernen können, wenn ich den Empfänger doch behalte.
- Als Inhaber möchte ich, dass die Markierung Re-Imports übersteht und für alle Buchungen desselben Empfängers gilt, damit ich sie nur einmal setzen muss.

## Acceptance Criteria
- [x] Neue Tabelle `empfaenger_kuendigung` (PK `owner_id, empfaenger_norm`), RLS owner-scoped (select/insert/update/delete), `updated_at`-Trigger
- [x] Status-Enum `offen | gekuendigt | beendet` per CHECK-Constraint, Default `offen`
- [x] Eigene Seite `/kuendigungen` (in Sidebar unter „Heute" verlinkt), lädt Daten clientseitig über die API (Refresh nach Mutation)
- [x] `GET /api/kuendigungen` liefert alle Markierungen des Owners + pro Empfänger aggregierte Statistik (Anzahl, Ø-Betrag, Jahresbelastung, Median-Intervall, letzte Buchung), berechnet aus `buchung` über `empfaenger_normalisiert`
- [x] `POST /api/kuendigungen` nimmt den **Rohwert** `empfaenger` an, normalisiert server-seitig via `normalisiereEmpfaenger()`, upsert (idempotent, `onConflict: owner_id,empfaenger_norm`)
- [x] `PATCH /api/kuendigungen/[norm]` setzt `status` und/oder `notiz` (Zod-validiert), 404 wenn Markierung fehlt
- [x] `DELETE /api/kuendigungen/[norm]` entfernt die Markierung
- [x] Abo-Radar-Item zeigt Toggle „Zur Kündigung markieren" / „Markierung entfernen"; Status fließt zurück in `/api/finanzen/wiederkehrend` (`kuendigung_status` pro Item)
- [x] Kopf der Seite zeigt Summe der **aktiven** (offen + gekündigt) Jahresvolumina als Hinweis
- [x] Empty-State: „Noch nichts zur Kündigung markiert …"

## Edge Cases
- Empfänger mit nur 1 Buchung → kein Median-Intervall berechenbar → `intervall_tage = null`, UI zeigt „—" statt eines Intervalls
- Empfänger ohne passende Buchungen mehr (alle gelöscht/umnormalisiert) → Statistik mit Nullwerten, Anzeige fällt auf `rohwert_beispiel` bzw. `empfaenger_norm` zurück
- Rohwert ergibt nach Normalisierung < 2 Zeichen → 422 (kein gültiger Schlüssel)
- Doppeltes Markieren desselben Empfängers → Upsert, kein Fehler (idempotent)
- Status auf denselben Wert setzen → No-Op (Client bricht früh ab)
- `beendet`-Einträge zählen NICHT ins aktive Jahresvolumen, bleiben aber sichtbar
- URL-Schlüssel wird `encodeURIComponent`/`decodeURIComponent`-sicher behandelt (Sonderzeichen im normalisierten Empfänger)

## Technical Requirements
- Sicherheit: `owner_id`-Scope per RLS **und** explizit in jeder Query; Zod-Validierung auf POST/PATCH; Service-Role wird nicht verwendet
- Konsistenz: Normalisierung ausschließlich über `normalisiereEmpfaenger()` (eine Quelle der Wahrheit, identisch zu `buchung.empfaenger_normalisiert`)
- Performance: Statistik on-the-fly aus `buchung` (gefiltert per `.in('empfaenger_normalisiert', [...])`), keine Materialisierung

---

## Tech Design

### Backend-Bedarf: Ja
Eine neue Tabelle + Listing/Mutations-Endpoints. Kein neuer Klassifizierungs-
oder Steuer-Code.

### Datenmodell
**Migration `0006_empfaenger_kuendigung.sql`:**
```
empfaenger_kuendigung(
  owner_id uuid -> auth.users(id) on delete cascade,
  empfaenger_norm text,
  rohwert_beispiel text,
  status text default 'offen' check (in offen|gekuendigt|beendet),
  notiz text,
  markiert_am timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (owner_id, empfaenger_norm)
)
index idx_kuendigung_owner_status (owner_id, status, markiert_am desc)
trigger trg_kuendigung_updated -> set_updated_at()
RLS: owner_id = auth.uid() für select/insert/update/delete
```

### API
- `GET /api/kuendigungen` → `{ data: KuendigungZeile[] }`
  - `KuendigungZeile`: `empfaenger_norm`, `empfaenger_anzeige`, `status`, `notiz`, `markiert_am`, `statistik`
  - `statistik`: `anzahl`, `durchschnitt`, `jahresbelastung`, `intervall_tage` (Median, `null` bei < 2 Buchungen), `letzte`
- `POST /api/kuendigungen` `{ empfaenger: string, notiz?: string }` → 201 `{ data }`; normalisiert server-seitig, Upsert
- `PATCH /api/kuendigungen/[norm]` `{ status?, notiz? }` → `{ data }` | 404
- `DELETE /api/kuendigungen/[norm]` → `{ ok: true }`
- Erweiterung `/api/finanzen/wiederkehrend`: pro Item zusätzlich `empfaenger_norm` + `kuendigung_status` (Join über `empfaenger_kuendigung`)

### Komponentenstruktur
```
/kuendigungen (page.tsx, Server) → PageShell/PageHeader
+-- KuendigungenListe (Client)
    +-- Kopf: Σ aktives Jahresvolumen
    +-- Zeile je Markierung
        +-- Empfänger, Intervall-Label, markiert-am
        +-- geschätzte Jahresbelastung
        +-- Status-Select (offen/gekündigt/beendet) → PATCH
        +-- Notiz → PATCH
        +-- Entfernen → DELETE

abo-radar.tsx (PROJ-14)
+-- toggleKuendigung() → POST / DELETE /api/kuendigungen
```

### Wiederverwendete Bausteine
- `normalisiereEmpfaenger()` (gemeinsamer Cache-Key)
- `getApiUser()` / `createClient()` (Server-Supabase, RLS)
- `set_updated_at()` (vorhandene Trigger-Funktion)
- `PageShell` / `PageHeader` (PROJ-12 Editorial-Layout)

### Was bewusst NICHT zur Spec gehört (YAGNI)
- Keine echte Kündigungs-Automatik (kein Versand, kein Brief-Generator)
- Keine Erinnerungen/Fristen-Tracking (Status ist manuell)
- Keine Verknüpfung zu einem Vertrags-/Dokumenten-Objekt
- Keine eigene Filter-/Such-/Pagination-UI (Single-User-Datenmenge)

## Implementierungsnotizen
- Client schickt bei POST bewusst den **Rohwert** (`item.empfaenger`), die API normalisiert selbst — dadurch keine Abhängigkeit von einer client-seitig schon normalisierten Form; DELETE/PATCH nutzen den bereits normalisierten Schlüssel aus der Liste
- Statistik (Median-Intervall, Jahresbelastung) wird im GET-Handler aus den Buchungen des Empfängers berechnet; einmalige Empfänger liefern `intervall_tage = null`
- Status-Maschine ist absichtlich frei wählbar (kein erzwungener Übergang), damit Korrekturen möglich sind
- Sidebar-Eintrag unter „Heute", da es eine wiederkehrende Pflege-Aufgabe ist
- Verifiziert: `npm run build` grün, gesamte Test-Suite (605 Tests) grün, Code-Review ohne Befund; DB enthält bereits reale Markierungen (Feature wurde im Dev benutzt)

## Test Plan
- API:
  - POST mit Rohwert „Netflix GmbH" → Markierung unter normalisiertem Schlüssel; erneuter POST → idempotent (kein Fehler)
  - PATCH status `gekuendigt` → persistiert, GET spiegelt es; PATCH auf nicht existierenden Schlüssel → 404
  - DELETE → Markierung weg, Abo-Radar-Toggle zeigt wieder „markieren"
  - GET-Statistik: 12× Monatsabbuchung → `intervall_tage ≈ 30`; 1× Buchung → `intervall_tage = null`
- UI (manuell):
  - Abo-Radar „Zur Kündigung markieren" → Eintrag erscheint auf `/kuendigungen`
  - Status-Select wechselt, „beendet" entfernt den Betrag aus dem aktiven Jahresvolumen
  - Empty-State bei keiner Markierung
- Build/Tests grün
