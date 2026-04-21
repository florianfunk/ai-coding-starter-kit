# PROJ-33: Performance-Optimierung Phase 1

## Status: Architected
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Erfordert: PROJ-5 (Produkte-CRUD), PROJ-6 (Preisverwaltung), PROJ-21 (Vollständigkeits-Indikator) — alle bereits umgesetzt
- Betrifft Datenbank aus: PROJ-2 (Datenmodell)

## Kontext & Problem
Die App ist auf Production spürbar träge. Messung/Code-Audit ergab fünf konkrete Engpässe:

1. **Dashboard** lädt bei jedem Request ~20.000 Rows (alle Produkte + alle `produkt_icons` + alle `produkt_bilder`) nur um den Durchschnitts-Vollständigkeits-Wert zu berechnen ([src/app/page.tsx:37-41](../src/app/page.tsx#L37-L41)).
2. **Dashboard** lädt bis zu 5000 Preise nur um Produkte mit Preis zu zählen ([src/app/page.tsx:30](../src/app/page.tsx#L30)).
3. **Produktliste** (`/produkte`) macht mehrere separate DB-Calls pro Request (Bereiche, Kategorien, Produkte, Preise, Icons, Galerie) statt in einer Query zu aggregieren ([src/app/produkte/page.tsx:25-60](../src/app/produkte/page.tsx#L25-L60)).
4. **Bilder** werden ohne `next/image` in voller Auflösung + Originalformat geladen — kein Resize, kein WebP, kein Lazy-Loading.
5. **Alle Seiten** sind `force-dynamic` ohne Caching. Slowly-changing Daten (Bereiche, Kategorien) werden bei jedem Request neu geholt.

## User Stories
- Als Produktpfleger möchte ich, dass das Dashboard in unter einer Sekunde lädt, damit der Arbeitseinstieg nicht frustriert.
- Als Produktpfleger möchte ich, dass die Produktliste in unter einer Sekunde lädt, damit Filtern und Navigieren flüssig sind.
- Als Produktpfleger möchte ich, dass Produktbilder schnell angezeigt werden, damit Scrollen durch Listen nicht hakt.
- Als Produktpfleger möchte ich, dass Navigation zwischen Seiten (Bereiche, Kategorien) sich schnell anfühlt, weil ich oft hin- und herspringe.
- Als Admin möchte ich, dass die Optimierungen keine funktionalen Regressions verursachen — alle bestehenden Features müssen weiterhin funktionieren (Suche, Filter, Vollständigkeits-Badges, Aufgaben-Widget, Produkt-Detailseiten).

## Acceptance Criteria
### Messbare Performance-Ziele (Server-Timing auf Production)
- [ ] Dashboard (`/`) — Server-Renderzeit **< 500ms** (heute ca. 3-5s)
- [ ] Produktliste (`/produkte`) — Server-Renderzeit **< 500ms** (heute ca. 1-2s)
- [ ] Produkt-Detail (`/produkte/[id]`) — Server-Renderzeit **< 400ms**
- [ ] DB-Query-Zeit für Dashboard-Completeness **< 100ms** (heute mehrere Sekunden durch Row-Transfer)

### Funktionale Erhaltung (keine Regressions)
- [ ] Dashboard zeigt identische Werte wie vorher: Bereiche/Kategorien/Produkte/Preise/Icons-Counts, Produkte-ohne-Preis, Produkte-ohne-Bild, Produkte-unbearbeitet, Durchschnitts-Vollständigkeit, "brauchen Aufmerksamkeit"-Zahl
- [ ] Produktliste zeigt identische Spalten, Filter, Sortierung, Pagination, Badges
- [ ] Vollständigkeits-Badges auf Produktliste sind pixelgenau wie vorher (Farbe, Prozent)
- [ ] Filter "Vollständigkeit" liefert identische Ergebnisse
- [ ] Suche & Filter funktionieren unverändert
- [ ] Produkt-Detailseite rendert alle Abschnitte wie vorher (technische Daten, Preise, Icons, Galerie, Datenblatt)
- [ ] Katalog-PDF-Generierung (PROJ-10) bleibt funktional

### Technische Kriterien
- [ ] Keine Schema-Änderungen an Haupttabellen (`produkte`, `preise`, `produkt_icons`, `produkt_bilder`) — nur additive Views, Indizes, RPC-Funktionen
- [ ] Neue Migration(en) sind idempotent und lassen sich auf leerer DB + auf befüllter DB fehlerfrei anwenden
- [ ] Produktbilder via `next/image` (automatisches Resize auf benötigte Größe, WebP-Auslieferung)
- [ ] Navigation, Layout-Chrome und häufig geteilte Daten (Bereiche-Liste, Kategorien-Liste) werden via `unstable_cache` oder `revalidate` gecached
- [ ] Supabase-Remote-Bild-Domains in `next.config.ts` whitelisted
- [ ] Keine neuen Runtime-Dependencies außer built-in Next.js-Features
- [ ] Kein externer Cache-Layer (Redis, Upstash etc.)

## Edge Cases
- **Materialized View staleness:** Wie frisch muss der Completeness-Aggregat-Wert sein? Entscheidung: Durchschnitt darf bis zu 5 Minuten alt sein (wird per `pg_cron` oder On-Write-Trigger refreshed). Für Detail-Ansichten wird weiterhin live berechnet.
- **Große Bildmenge in Produktgalerie:** Wenn ein Produkt 20+ Galeriebilder hat, dürfen nicht alle gleichzeitig in voller Auflösung laden. Lazy-Load per `next/image` lösen.
- **Leere DB:** Migration muss auch auf DB ohne Daten funktionieren (Views müssen mit 0 Rows umgehen).
- **Concurrency:** Mehrere gleichzeitige Dashboard-Requests dürfen die Materialized View nicht mehrfach refreshen. Lock-Strategie: `REFRESH CONCURRENTLY` oder Trigger-basiert mit Debouncing.
- **Neue Produkte ohne Completeness-Berechnung:** Produkt wird angelegt → erscheint sofort in der Liste, Completeness-Wert muss für neue Produkte korrekt sein (entweder live-berechnet oder durch Trigger).
- **Cache-Invalidierung bei Bereich/Kategorie-Update:** Wenn `revalidate` aktiv ist und ein Admin einen Bereich umbenennt, muss der Cache spätestens nach `revalidate`-Intervall aktuell sein, oder besser: durch Server-Action `revalidateTag()` sofort invalidiert.
- **`next/image` und Supabase-Signed-URLs:** Signed URLs haben Expiry. `next/image` cached das optimierte Bild — bei Expire darf das alte Bild nicht dauerhaft ausgeliefert werden. Lösung: Public Bucket oder längere Expiry-Zeiten.
- **Abwärtskompatibilität beim Deployen:** Wenn neue Code-Version deployed wird bevor Migration läuft (bzw. umgekehrt), darf die App nicht crashen. Migration vor Deploy ausführen.
- **Messbarkeit:** Woher wissen wir ob Ziele erreicht sind? Lösung: Server-Timing-Header in allen Pages, zusätzlich einmalige Lighthouse-Messung vor/nach auf Production.

## Technical Requirements
- **Performance-Ziele** (Production, warm cache, EU-Request):
  - Dashboard: TTFB < 500ms
  - Produktliste (50 Items/Seite): TTFB < 500ms
  - Produkt-Detail: TTFB < 400ms
- **DB-Constraints:**
  - Keine DDL-Änderungen an Haupttabellen
  - Nur additive Objekte (Views, Matviews, Functions, Indizes)
  - Alle neuen Objekte in eigenen Migrations-Dateien (0013+)
- **Next.js-Konventionen:**
  - `next/image` mit `remotePatterns` für Supabase Storage
  - `unstable_cache` mit Tags für manuelle Invalidierung
  - `revalidate`-Segments wo sinnvoll (nie auf User-Daten)
- **Rollback-Sicherheit:**
  - Jede Migration hat klare Rollback-Beschreibung im Kommentarblock
  - Views/RPC-Funktionen lassen sich ohne Datenverlust droppen
- **Messbarkeit:**
  - Server-Timing-Header (via Response-Headers oder React Server Component Timings)
  - Manuelle Vorher/Nachher-Messung dokumentieren

## Scope Boundaries
### In Scope (Phase 1)
- Dashboard-Aggregate via Materialized View oder RPC
- Produktliste via konsolidierter RPC oder View mit JOINs
- `next/image` für alle Produktbild-Stellen (Liste, Detail, Galerie-Thumbs)
- `unstable_cache` / `revalidate` für Bereiche & Kategorien
- Indizes für bekannte Filter-Spalten falls nötig

### Out of Scope (spätere Phasen)
- Kein Upgrade des Supabase-Plans (Micro → Small)
- Kein externes CDN
- Keine React-Rendering-Optimierungen (memo, virtualization — falls nötig, separates Feature)
- Keine Offline-Unterstützung / Service Worker
- Keine Bundle-Size-Optimierung (Dynamic Imports, Code-Splitting)
- Kein Real User Monitoring (Sentry, Vercel Analytics Pro)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (was verlangsamt heute was)
- **Dashboard** ([src/app/page.tsx](../src/app/page.tsx)) macht acht Count-Queries + lädt Einzeldaten aller 419 Produkte + aller 1212 Produkt-Icon-Verknüpfungen + aller Galerie-Bild-Verknüpfungen, nur um Durchschnitts- und „brauchen Aufmerksamkeit"-Werte live zu berechnen. Data-Transfer über das Netzwerk ist der Flaschenhals.
- **Produktliste** ([src/app/produkte/page.tsx](../src/app/produkte/page.tsx)) fetcht je Request Bereiche, Kategorien, 50 Produkte, deren aktive Preise, Icon-Joinings und Galerie-Joinings in mehreren separaten Round-Trips.
- **Bilder** ([src/lib/storage.ts](../src/lib/storage.ts)) kommen als frisch erzeugte 1h-Signed-URLs aus einem privaten Bucket, werden ohne Resize in Originalauflösung ins HTML geschrieben. Kein Browser-Cache-Reuse zwischen Requests, kein WebP, kein Resize.
- **Caching**: Alle Seiten sind `force-dynamic`. Slowly-changing Daten (Bereiche, Kategorien) werden bei jedem Aufruf neu geholt.

### High-Level-Lösungsbild

```
+------------------------ Browser ------------------------+
|  next/image Loader  -->  /_next/image-Optimizer         |
|                          (Resize, WebP, Cache)          |
+----------------------------|----------------------------+
                             v
+--------------------- Vercel Edge -----------------------+
|  Next.js Render                                         |
|  +-- unstable_cache (Bereiche, Kategorien, Stats)       |
|  +-- revalidateTag() bei Admin-Writes                   |
+----------------------------|----------------------------+
                             v
+---------------------- Supabase -------------------------+
|  Zugriff nur noch über:                                 |
|  * v_produkt_listing       (konsolidierte Produktliste) |
|  * v_dashboard_stats       (alles fürs Dashboard)       |
|  * mv_produkt_completeness (Materialized View, 5min)    |
|  * aktuelle_preise         (existiert bereits)          |
|  ------------------------------------------             |
|  Basistabellen (produkte, preise, ...) unverändert      |
+---------------------------------------------------------+
```

### Datenmodell-Additions (nur additiv, keine Breaking Changes)

#### Neue Datenbank-Objekte (Migration 0013)

| Objekt | Typ | Zweck |
|---|---|---|
| **`mv_produkt_completeness`** | Materialized View | Pro Produkt: `percent` (0-100), `is_complete` (Bool), Detail-Flags. Ersetzt die Client-seitige Schleife über 20.000 Rows. |
| **`v_dashboard_stats`** | View | Eine Zeile: alle Counts + Durchschnitts-Vollständigkeit + "braucht Aufmerksamkeit"-Zahl. Dashboard-Render muss dann nur eine Zeile lesen. |
| **`v_produkt_listing`** | View | Produkt-Row + gejointe Felder `bereich_name`, `kategorie_name`, `hat_preis` (Bool), `icon_count`, `galerie_count`. Ersetzt die 4-5 Parallel-Queries in der Produktliste. |
| **Indizes** | BTREE | `produkte(artikelnummer)`, `produkte(bereich_id)`, `produkte(kategorie_id)`, `produkte(artikel_bearbeitet)`, `produkt_icons(produkt_id)`, `produkt_bilder(produkt_id)`. Nur anlegen wenn nicht schon existierend. |

#### Refresh-Strategie für die Materialized View
- **Trigger-basiert**: Schreib-Operationen auf `produkte`, `produkt_icons`, `produkt_bilder`, `preise` setzen einen Dirty-Flag in einer kleinen Helper-Tabelle `_mv_refresh_queue`.
- **Background-Refresh**: Ein kleiner Edge-Function-Cron (oder Supabase `pg_cron` falls verfügbar) refresht die MV alle 5 Minuten **falls** das Dirty-Flag gesetzt ist. Kein Overhead bei inaktiver DB.
- **Fallback**: Refresh kann jederzeit manuell per Admin-Action ausgelöst werden (für neue Nutzer, die sofort aktualisierte Zahlen sehen wollen).
- **Konsistenzgarantie**: Detail-Seiten (Produkt-Detail, Produkt-Formular) berechnen Completeness weiterhin live. Nur Dashboard/Aggregat nutzt die MV.

### Frontend-Änderungen

#### Produktbild-Handling (next/image)
- **Neue Route**: `/api/bild/[bucket]/[...path]` — interner Proxy, der Supabase-Storage-Bytes mit User-Session authentifiziert ausliefert und mit sinnvollen Cache-Headern versieht (`s-maxage=3600, stale-while-revalidate=86400`).
- **Warum nicht direkt Signed URLs?** Signed URLs ändern sich bei jedem Render (neues Expiry) → `next/image` kann nicht cachen. Unser Proxy hat stabile URLs pro Pfad → perfekt für Cache & Optimizer.
- **Auth**: Der Proxy ist hinter der bestehenden Proxy-Middleware (Supabase-Session), keine zusätzliche Auth-Flow nötig.
- **Whitelisting in `next.config.ts`**: `images.remotePatterns` erlaubt den eigenen `/api/bild/**`-Pfad (und optional den Supabase-Storage-Host als Fallback).
- **Austausch in den Pages**: Überall wo aktuell `<img src={signedUrl}>` steht → ersetzt durch `<Image src="/api/bild/produktbilder/..." width height>`. Pages betroffen: Produktliste-Zelle, Produkt-Detail, Bereiche-Liste, Kategorien-Liste, Icon-Picker, Galerie-Thumbnails.

#### Caching-Strategie (Next.js Data Cache)
| Datensatz | Cache-Laufzeit | Invalidierung | Begründung |
|---|---|---|---|
| Bereiche-Liste | 1 h | Tag `bereiche` bei Create/Update/Delete | Ändert sich selten, nur durch Admin |
| Kategorien-Liste | 1 h | Tag `kategorien` bei Create/Update/Delete | Ändert sich selten |
| Dashboard-Stats (aus `v_dashboard_stats`) | 60 s | Tag `dashboard` bei Produkt/Preis-Writes | 60s-Alter auf Zahlen ist akzeptabel |
| Produktliste | Nicht cached | — | Filter-abhängig, RLS-relevant |
| Produkt-Detail | Nicht cached | — | User erwartet live-Daten beim Bearbeiten |

- **Tag-Invalidierung** via `revalidateTag()` aus den Server-Actions (z.B. `bereiche/actions.ts::updateBereich` → `revalidateTag("bereiche")`).
- **Kein `force-dynamic` entfernen**, wo heute gesetzt — das würde Seiten cachen, die User-abhängig sind. Nur **einzelne** Datenzugriffe via `unstable_cache`.

### Komponenten-Struktur (betroffene Dateien)
```
src/
  app/
    page.tsx                   [ändern] — ein fetch auf v_dashboard_stats statt 12 Queries
    produkte/
      page.tsx                 [ändern] — ein fetch auf v_produkt_listing statt 5 Queries
      produkte-table-body.tsx  [anpassen] — <Image> statt <img>
      [id]/page.tsx            [anpassen] — <Image> für hauptbild + galerie
    bereiche/page.tsx          [anpassen] — Image + unstable_cache
    kategorien/page.tsx        [anpassen] — Image + unstable_cache
    icons/page.tsx             [anpassen] — Image
    api/
      bild/
        [bucket]/[...path]/route.ts  [NEU] — Storage-Proxy mit Cache-Headern
  lib/
    cache.ts                   [NEU] — Cache-Helper (getBereiche, getKategorien, getDashboardStats)
    storage.ts                 [bleibt] — getSignedUrl weiter für PDF-Downloads verwendet
next.config.ts                 [ändern] — images.remotePatterns
supabase/migrations/
  0013_perf_views.sql          [NEU] — Views, MV, Indizes, Helper-Tabelle
  0014_perf_refresh_triggers.sql [NEU] — Trigger für Dirty-Flag
```

### Technische Entscheidungen & Begründung

| Entscheidung | Begründung |
|---|---|
| **Materialized View statt RPC-Function** für Completeness-Aggregat | Aggregat wird oft gelesen (jeder Dashboard-Call), selten geschrieben. MV = Lese-Kosten ≈ 0. RPC würde bei jedem Call neu rechnen. |
| **Views statt Stored Procedures** für Listings | Views sind in Supabase-JS transparent abfragbar (Filter/Sort/Pagination bleibt clientseitig deklarativ). RPC würde Filter-Parameter als Funktionsargumente erfordern und Code deutlich umschreiben. |
| **Eigener `/api/bild`-Proxy statt Public Bucket** | Bucket auf „public" zu schalten wäre ein Security-Downgrade (alle Bilder im Internet auffindbar). Proxy behält Auth + hat stabile URLs für `next/image`-Cache. |
| **Trigger-basierter MV-Refresh statt Zeitplan** | Trigger nur wenn Daten sich ändern → keine Refresh-Last bei inaktiver DB. |
| **Tag-basiertes Caching** über `unstable_cache` + `revalidateTag()` | Saubere Invalidierung aus Server-Actions. Keine Stale-Caches nach Admin-Edits. |
| **Keine Schema-Änderungen an Haupttabellen** | Risiko-minimaler Rollback. Views/MVs droppen ist folgenlos. |

### Rollback-Plan pro Change

| Change | Rollback |
|---|---|
| Migration 0013 (Views, MV, Indizes) | `drop materialized view ...`, `drop view ...`, `drop index ...` — keine Datenverlust, dauert Sekunden. |
| Migration 0014 (Trigger) | `drop trigger ...`, `drop function ...` — keine Datenverlust. |
| Code-Änderungen in Pages | Git-Revert des Deployment-Commits. Alte Code-Version nutzt weiterhin die Basistabellen direkt → läuft auch nach Revert. |
| `next.config.ts` | Git-Revert, kein DB-Impact. |
| `/api/bild`-Proxy | Git-Revert. Alte `<img src={signedUrl}>` funktioniert auch ohne Proxy weiter. |

### Messbarkeit (wie wir wissen, ob's geklappt hat)
- **Server-Timing-Header** in Production-Responses (einfache Next.js Middleware-Ergänzung). Zeigt in Chrome DevTools Network-Tab die Render-Zeit pro Seite.
- **Vorher/Nachher-Messung** auf `/`, `/produkte`, `/produkte/[erste-id]`: 10 Refreshes, Median notieren, im QA-Abschnitt dokumentieren.
- **DB-Query-Zeit** via Supabase Dashboard Query Performance Tab (nach Deploy sofort sichtbar).

### Abhängigkeiten (zu installierende Packages)
- **Keine**. Alle Features nutzen bereits installierte Libraries (`next`, `@supabase/ssr`, `@supabase/supabase-js`). `next/image` ist Built-in.

### Offene Entscheidungen (nichts kritisch — Default-Werte gewählt)
- Cache-Laufzeit für Bereiche/Kategorien: **1 Stunde** (kann später auf 24h angehoben werden wenn sich als stabil erweist).
- Dashboard-Cache-Laufzeit: **60 Sekunden** (Kompromiss zwischen Aktualität der „Aufgaben"-Zahlen und Last).
- MV-Refresh-Intervall: **5 Minuten** via Trigger-Dirty-Flag (nicht fix alle X Minuten, sondern nur wenn Änderungen vorlagen).

### Risiken & Mitigation
| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Neue Views haben andere Spalten-Namen als erwartet → Code-Fehler | Mittel | Mittel | Typgenerierung (`supabase gen types`) nach Migration, dann TypeScript fängt alles. |
| MV-Refresh-Trigger bremst Writes spürbar | Niedrig | Mittel | Trigger setzt nur `UPDATE`-Flag in kleiner Queue-Tabelle, kein Recompute inline. |
| `next/image`-Proxy bremst bei kaltem Cache | Mittel | Niedrig | Cache-Headers sorgen für Hit-Rate > 95% nach Warmup. Erster Render pro Bild ist langsamer als vorher. |
| Migration hängt/schlägt fehl in Production | Niedrig | Hoch | Vor Deploy auf Dev-Branch testen. Rollback-Plan pro Migration dokumentiert. |
| Index-Anlegen auf befüllter Tabelle lockt | Niedrig (419 Produkte) | Niedrig | `CREATE INDEX CONCURRENTLY` wo möglich. Bei 419 Rows sowieso < 1 Sekunde. |



## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
