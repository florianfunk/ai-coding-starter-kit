# PROJ-33: Performance-Optimierung Phase 1

## Status: Planned
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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
