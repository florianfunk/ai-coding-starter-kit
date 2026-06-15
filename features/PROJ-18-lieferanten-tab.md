# PROJ-18: Lieferanten-Tab (wiederkehrende Empfänger ohne Abo)

## Status: Deployed
**Created:** 2026-05-21
**Last Updated:** 2026-06-15

## Deployment
- **Production:** https://steueragent.vercel.app — deployed 2026-06-15
- Deployment-ID `dpl_9CqXMJDsQt5gWtmSYQszLFxQeWad` (target production, via `vercel --prod`)
- Commit `15f846b` (neutral-Geldtransit-Nachbesserung) + `ae951a0` (Logik-Fix). Preview-Build (Git-Integration) und Production-Build grün; Prod liefert erwartete `307 → /login`
- **Re-Deploy 2026-06-15 (Bugfix „fehlende Lieferanten"):** Commit `42ee190` (Abo-Markierung statt Ausschluss + Normalisierungs-Konsolidierung). Deployment-ID `dpl_G4bHKwVJujEQrpHorWg5kgkTytzL` (target production, `vercel --prod`, `READY`). Production-Build grün.
  - ⚠️ **Offen:** Backfill `npx tsx scripts/renormalisiere-empfaenger.ts` (212/2163 Zeilen) muss vom Inhaber noch ausgeführt werden, damit bestehende Buchungen neu gruppiert werden — der Code-Fix wirkt sonst nur für künftige Importe.

## Dependencies
- Requires: PROJ-14 (Kategorien-Analyse) — Tab-Host, Filter, Bulk-Endpoints
- Requires: PROJ-15 (Klassifizierung-Pro) — `empfaenger_normalisiert`-Spalte, Regel-Anlage
- Requires: PROJ-5 (Autonome Klassifizierung) — `klassifikation`-Feld auf Buchungen

## Beschreibung
Der Abo-Radar (PROJ-14) zeigt **regelmäßige** Wiederkehr (stabiler Betrag,
festes Intervall). Lieferanten wie Aldi oder MediaMarkt fallen dort durchs
Raster: gleicher Empfänger, aber stark schwankende Beträge und
unregelmäßige Abstände. Dieser Tab macht genau diese Empfänger sichtbar
und bietet dieselben Bulk-Aktionen wie der Abo-Radar — Kategorie auf alle
Buchungen anwenden, Regel lernen, privat/geschäftlich pauschal setzen.

Lieferanten gibt es in beiden Welten: geschäftlich (z. B. MediaMarkt →
Wareneinkauf) und privat (z. B. Aldi → Lebensmittel). Die Sektionen
spiegeln das wider.

## User Stories
- Als Inhaber möchte ich eine Liste meiner wiederkehrenden Lieferanten sehen (Aldi, MediaMarkt, Tankstelle), damit ich pro Lieferant einmal eine Regel anlege und nicht jede Buchung einzeln zuordnen muss.
- Als Inhaber möchte ich Lieferanten nach Geschäftlich / Privat / Unklar getrennt sehen, damit ich gezielt am richtigen Cluster arbeite.
- Als Inhaber möchte ich aus einem Lieferanten heraus mit einem Klick alle seine Buchungen auf eine Kategorie setzen und gleichzeitig die Empfänger-Regel lernen, damit künftige Buchungen automatisch korrekt landen.
- Als Inhaber möchte ich einen Lieferanten pauschal als „immer privat" oder „immer geschäftlich" markieren, damit die Klassifikation für alle bestehenden und künftigen Buchungen stimmt.
- Als Inhaber möchte ich denselben Zeitraum-/Konto-/Bereichs-Filter wie auf der Kategorien-Analyse-Seite nutzen, damit ich konsistent durch die Daten navigiere.

## Acceptance Criteria
- [ ] Neuer Tab „Lieferanten" in `kategorien-analyse-ansicht.tsx`, neben „Geldbewegungen" und „Abo-Radar"
- [ ] Tab nutzt denselben Zeitraum-/Konto-/Bereichs-Filter wie die anderen Tabs
- [ ] API `GET /api/finanzen/lieferanten` liefert alle Empfänger mit ≥ 3 Buchungen im Lookback, die **kein** gültiges Abo-Cluster bilden
- [ ] Lieferanten-Items werden in drei Sektionen gerendert: **Geschäftlich** / **Privat** / **Unklar**, abgeleitet aus dominanter Klassifikation
- [ ] Sortierung innerhalb jeder Sektion: nach Jahresumsatz absteigend
- [ ] Item-Zeile zeigt: Empfänger, Anzahl Buchungen, Gesamtsumme im Lookback, hochgerechneter Jahresumsatz, dominante Kategorie (Chip), Klassifikation-Indikator
- [ ] Drill-Down beim Aufklappen: Buchungsliste mit Datum, Konto, Betrag, Inline-Kategorie-Select, Status, Aktionen (Bestätigen / Für alle / Eye-Detail)
- [ ] Bulk-Aktion „Kategorie auf alle anwenden" + „Alle bestätigen & Regel lernen" — wie Abo-Radar
- [ ] Neue Aktion pro Lieferant: „Immer privat" / „Immer geschäftlich" — setzt `klassifikation` auf alle Buchungen + legt Empfänger-Regel mit nur `klassifikation` an
- [ ] Empty-State: „Keine Lieferanten erkannt — Empfänger mit ≥ 3 Buchungen ohne Abo-Muster erscheinen hier."
- [ ] Empfänger, die bereits im Abo-Radar als Wiederkehr-Item erscheinen, tauchen NICHT im Lieferanten-Tab auf

## Edge Cases
- Empfänger mit gemischter Klassifikation (3× privat, 2× geschäftlich) → Sektion „Unklar", Drill-Down zeigt alle, Inhaber kann pauschal entscheiden
- Empfänger mit nur einer Kategorie auf allen Buchungen → „Alle bestätigen & Regel lernen" sofort verfügbar (wie Abo-Radar)
- Empfänger mit ≥ 3 Buchungen, die aber ein Abo-Cluster bilden → werden ausgeschlossen (sind im Abo-Tab)
- Empfänger ohne `empfaenger_normalisiert` (Altdaten) → Fallback auf `normalisiereEmpfaenger(empfaenger)`
- Empfänger leer/NULL → wird übersprungen (keine Aussage möglich)
- Filter „nur steuerrelevant" eingeschaltet → privatklassifizierte Buchungen rausfiltern, Lieferant mit nur privaten Buchungen verschwindet
- Konto-Filter aktiv → nur Buchungen dieses Kontos zählen, was die Lieferanten-Liste verkürzen kann
- Lookback ist mind. 365 Tage (wie Abo-Radar), damit auch saisonale Lieferanten erfasst werden

## Technical Requirements
- Performance: eine Query auf `buchung` mit Limit 20.000, Gruppierung in Node, Abo-Ausschluss über vorhandene `erkenneCluster()`-Funktion
- Sicherheit: owner_id-Scope per RLS + explizit in der Query; Bulk-Aktionen über bestehende `/api/buchungen/bulk-kategorie` (validiert), neue Klassifikations-Bulk muss eigenen Zod-Schema-Check haben
- Nachvollziehbarkeit: jede Bulk-Aktion + jede gelernte Regel erzeugt audit_eintrag (Quelle „nutzer")

---

## Tech Design

### Backend-Bedarf: Ja
Ein neuer Listing-Endpoint + ein neuer Bulk-Klassifikations-Endpoint.

### Datenmodell
**Keine neue Migration.** Alles abgeleitet aus `buchung` (+ `kategorie`,
`konto` für die Anzeige). Empfänger-Bridge über die in PROJ-15 angelegte
`empfaenger_normalisiert`-Spalte.

### Komponentenstruktur
```
KategorienAnalyseAnsicht (bestehend)
+-- Tab "Geldbewegungen"
+-- Tab "Abo-Radar"
+-- Tab "Lieferanten" (NEU)
    +-- LieferantenListe
        +-- SektionBlock "Geschäftlich"
        |   +-- LieferantItemRow*
        +-- SektionBlock "Privat"
        |   +-- LieferantItemRow*
        +-- SektionBlock "Unklar"
            +-- LieferantItemRow*
                +-- LieferantDrilldown (Bulk + Tabelle + Inline-Edit)
+-- BuchungDetailSheet (geteilt mit anderen Tabs)
```

### API
- `GET /api/finanzen/lieferanten?jahr=&von=&bis=&konto_id=&bereich=&nur_steuerrelevant=`
  - Filter-Schema = `analyseFilterSchema` (wie `/api/finanzen/wiederkehrend`)
  - Response: `LieferantenResponse { items: LieferantItem[], lookback: { von, bis } }`
  - Lieferant-Item-Felder (knapp): `empfaenger`, `empfaenger_norm`, `anzahl`, `gesamt_summe`, `jahresumsatz`, `richtung` (einnahme/ausgabe — Mehrheit), `dominante_klassifikation` (`privat` | `geschaeftlich` | `unklar`), `dominante_kategorie` (`{ id, bezeichnung, typ, anteil }` | `null`), `erste`, `letzte`, `buchungen[]` (Drilldown, gleiche Form wie `WiederkehrendBuchung`)
- `POST /api/buchungen/bulk-klassifikation`
  - Body: `{ ids: string[], klassifikation: 'privat' | 'geschaeftlich' }`
  - Setzt `klassifikation` auf alle ids des Owners, schreibt audit_eintrag, gibt `{ aktualisiert, uebersprungen[] }` zurück
  - Wird auch von der „Immer privat / Immer geschäftlich"-Aktion auf Lieferanten genutzt
- Wiederverwendet: `/api/buchungen/bulk-kategorie`, `/api/regeln`, `/api/buchungen/[id]`, `/api/kontenrahmen`

### Lieferant-Erkennung (Algorithmus)
1. Lade Buchungen im Lookback (≥ 365 Tage, wie Abo-Radar), Filter wie im Endpoint
2. Gruppiere nach `empfaenger_normalisiert` (Fallback `normalisiereEmpfaenger`)
3. Pro Gruppe mit `anzahl >= 3`:
   - `erkenneCluster(buchungen)` aufrufen — wenn Cluster zurückkommt → `abo`-Feld setzen (Intervall, Intervall-Tage, Konfidenz); der Empfänger erscheint **zusätzlich** im Abo-Radar
   - in jedem Fall: Lieferant-Item bauen (Abos werden seit 2026-06-15 **nicht mehr übersprungen**, nur markiert — siehe Implementierungsnotizen)
4. `dominante_klassifikation`:
   - Wenn alle Buchungen `klassifikation === 'privat'` → `privat`
   - Wenn alle `klassifikation === 'geschaeftlich'` → `geschaeftlich`
   - Wenn `klassifikation` mehrheitlich (≥ 80%) einer Seite → diese Seite
   - sonst (gemischt oder ohne Klassifikation) → `unklar`
5. `dominante_kategorie`: häufigste `kategorie_id` (nicht NULL); `anteil = anzahl_mit_kat / gesamt`. NULL wenn alle ohne Kategorie.
6. `jahresumsatz`: `gesamt_summe * 365 / tage_zwischen(erste, letzte)`, gekappt nach unten auf `gesamt_summe` (wenn Span < 365 Tage)
7. Sortierung: pro Sektion nach `jahresumsatz` absteigend

### Wiederverwendete Bausteine
- `erkenneCluster()`, `normalisiereEmpfaenger()` aus `src/lib/finanzen/wiederkehrend-erkennung.ts`
- `analyseFilterSchema` aus `src/lib/validation/kategorien-analyse.ts`
- `istImBereich()` aus `src/lib/finanzen/bereich-filter.ts`
- `KategorieGruppen`-Komponente aus `abo-radar.tsx` (vor Refactor inline; bei Bedarf in eigene Datei extrahieren)
- `BuchungDetailSheet`-Komponente
- Bulk- und Regel-Lernlogik (`lerneRegelFuer`-Helper aus `abo-radar.tsx` — extrahieren nach `src/lib/finanzen/regel-helper.ts`, damit beide Tabs ihn nutzen)

### Abhängigkeiten (Pakete)
Keine neuen.

### Was bewusst NICHT zur Spec gehört (YAGNI)
- Keine eigene Tabelle `lieferant` in der DB — alles on-the-fly aus `buchung` aggregiert
- Keine „Lieferanten-Stammdaten"-Seite mit Adresse, Kontaktdaten, Notizen — wäre ein eigenes Feature
- Kein Lieferant „archivieren"/„beenden" — der Tab ist eine Analyse-/Aktions-Sicht ohne Lifecycle
- Keine Suche / Pagination — bei realistischer Single-User-Datenmenge nicht nötig (Limit 20k Buchungen reicht)
- Kein Export — die bestehende Export-Funktion (PROJ-11) deckt das ab

## Implementierungsnotizen
- API + UI implementiert wie geplant; keine DB-Migration
- `lerneRegelFuer` aus `abo-radar.tsx` in `src/lib/finanzen/regel-helper.ts` extrahiert und um `lerneKlassifikationsRegel` (für "Immer privat / Immer geschäftlich") ergänzt — Abo-Radar nutzt jetzt denselben Helper
- Bulk-Klassifikation als eigener Endpoint `POST /api/buchungen/bulk-klassifikation` (Schema in `src/lib/validation/buchungen-klassifikation-bulk.ts`), Status wird auf `manuell_bestaetigt` gesetzt + Audit-Eintrag
- 19 Unit-Tests in `src/lib/finanzen/lieferanten-erkennung.test.ts` decken Aggregation ab: Gruppierung, dominante Klassifikation (80%-Schwelle), dominante Kategorie mit Anteil, Abo-Ausschluss via `erkenneCluster()`, Jahresumsatz-Hochrechnung
- Schwelle `MIN_LIEFERANT_BUCHUNGEN = 3` als Konstante in `lieferanten-erkennung.ts`
- Spec-Erkenntnis während der Implementierung: `BuchungStatus` heißt `auto_verbucht` (nicht wie in einer früheren Spec-Variante `klassifiziert_auto`) — Tests-Fixtures entsprechend angepasst
- Nachbesserung (2026-06-15): Neutrale Buchungen (Geldtransit/Umbuchung zwischen Konten, `typ = "neutral"`) werden für **Richtung** (Header-Farbe) und **dominante Kategorie** (Badge) ausgeschlossen — sie verzerrten sonst die Empfänger-Anzeige (z.B. PayPal-Header „Privat/ausgabe", während sichtbare Zeilen Geldtransit waren). `LieferantenBuchung` um optionales `kategorie_typ` erweitert; Fallback auf die volle Gruppe, wenn ein Empfänger ausschließlich neutral ist. +2 Tests (jetzt 21)
- Nachbesserung (2026-06-15, UI): Im Drilldown werden neutrale Zeilen via `neutralAnsEnde()` ans Ende sortiert (Sortierung nur beim Laden → Inline-Edits springen nicht) und dezent abgesetzt (gedämpfter Hintergrund, Betrag in `text-muted-foreground` statt Grün/Rot, Tooltip „durchlaufender Posten")
- **Bugfix (2026-06-15): „Fehlende Lieferanten" — zwei Ursachen.** Der Inhaber meldete, dass monatlich gezahlte Empfänger (Scalable, NinjaOne) im Lieferanten-Tab fehlten.
  - **Ursache 1 — Abo-Ausschluss (Design):** Empfänger mit stabilem Rhythmus + Betrag wurden via `erkenneCluster()` komplett aus den Lieferanten entfernt (sie lebten nur im Abo-Radar). **Fix:** Abos werden nicht mehr übersprungen, sondern via neuem `abo`-Feld (`{ intervall, intervall_tage, konfidenz } | null`) markiert und mit einem „Abo · <Intervall>"-Badge angezeigt. Der Netflix-Test wurde von „erscheint NICHT" auf „erscheint MIT Abo-Markierung" umgestellt; +1 Aldi-„ohne Abo"-Test (jetzt 22 Tests).
  - **Ursache 2 — Normalisierungs-Fragmentierung (Bug):** `normalisiereEmpfaenger()` entfernte keine Städte/Filialnummern/Order-Tokens, sodass ein realer Empfänger in viele Schlüssel zerfiel (`ninjaone, oldsmar` vs `ninjaone, tampa`; `rewe markt muenchen` vs `rewe markt gruenwald`; 53 `amzn mktp de*<order>`-Schlüssel). Jeder Teil fiel unter `MIN_LIEFERANT_BUCHUNGEN = 3` und verschwand. **Fix:** `KONZERN_MARKER` in `src/lib/classifier/normalize.ts` zu `{ praefix, kanonisch }` erweitert (u. a. `amzn→amazon`, `dm-drogerie→dm`, `ninjaone`, `rewe`, `edeka`, `aldi`, `rossmann`, `mcdonalds`, `netto`, `audible`, `shopify`, `openai`, `allianz`, `signal iduna`, `tegut`, `dinzler`, `rackls`) + Wortgrenze auf Nicht-Wort-Zeichen erweitert (greift jetzt bei `ninjaone,`/`amzn `/`apple.com`, NICHT bei `amazonas reisen`). +19 Tests in `normalize.test.ts` inkl. Over-Merge-Schutz („Johannes Funk" ≠ „Johannes Wutz") und Idempotenz.
  - **Backfill:** `scripts/renormalisiere-empfaenger.ts` rechnet `empfaenger_normalisiert` für ALLE bestehenden Buchungen neu (im Gegensatz zum NULL-only-Backfill). Dry-Run: 212 / 2163 Zeilen konsolidieren. Vom Inhaber lokal auszuführen (Service-Role-Key): `npx tsx scripts/renormalisiere-empfaenger.ts [--dry-run]`.

## Test Plan
- API:
  - 5× Aldi-Buchungen mit unterschiedlichen Beträgen → erscheint als Lieferant
  - 12× Netflix-Buchungen mit identischem Betrag im Monatsabstand → erscheint als Lieferant MIT `abo`-Markierung (seit 2026-06-15; vorher: ausgeschlossen)
  - 2× MediaMarkt → unter Schwelle, NICHT als Lieferant
  - Mischbuchungen (3× privat Aldi, 2× geschäftlich MediaMarkt für denselben normalisierten Empfänger) → `dominante_klassifikation = 'unklar'`
- UI (manuell):
  - Tab-Wechsel lädt nur einmal
  - Drill-Down öffnet, Inline-Kategorie-Edit speichert
  - „Auf alle anwenden" setzt alle und legt Regel an (Toast „Regel gelernt")
  - „Immer privat" setzt `klassifikation` auf alle + legt Klassifikations-Regel an, Item wandert in Sektion „Privat"
  - Filter (Jahr, Konto, Bereich) reduziert die Liste plausibel
- Build (`npm run build`) ohne Type-Errors

## Design Doc
Siehe `docs/superpowers/specs/2026-05-21-lieferanten-tab-design.md` —
identischer Inhalt für die Brainstorming-/Plans-Skill-Konvention.
