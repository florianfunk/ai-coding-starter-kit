# PROJ-22: Globaler Jahreswähler (app-weiter Jahres-Modus)

## Status: Deployed
**Created:** 2026-06-16
**Last Updated:** 2026-06-16
**Priorität:** P2

## Deployment
- **Production:** https://steueragent.vercel.app — deployed 2026-06-16
- Deployment-ID `dpl_C6FEBYPj2aFbJoquLnDVa5AGN1U3` (target production, via
  `vercel --prod`), readyState READY, aliased.
- **DB-Migration `0012_firmenprofil_aktives_jahr.sql` auf Production-Supabase
  angewendet** (Projekt `xhrjtkcnbmknaribuhyo`, via MCP `apply_migration`).
  Spalte `aktives_jahr` angelegt; bestehendes Profil auf `2026` vorbelegt
  (jüngstes/einziges Datenjahr — alle 2163 Buchungen liegen in 2026). Security-
  Advisor nach DDL: kein neuer Lint (nur vorbestehende WARN „leaked password
  protection", unabhängig von PROJ-22).
- Smoke-Test Prod: Seiten (`/kategorien-analyse`, `/buchungen`, `/pruefliste`,
  `/euer`, `/ust-voranmeldung`, `/merkliste`, `/belege`, `/kuendigungen`) →
  `307 → /login`; APIs (`/api/firma/jahr` PATCH, `/api/finanzen/bewegungen`,
  `/api/pruefliste`) → `401`; `/login` → `200`. Auth greift überall ✓
- Commit `0ec2d3a` (lokal auf `feat/steueragent-mvp`, **nicht** gepusht).
- **QA:** Adversarialer Review des PROJ-22-Diffs (QA Backend) + breiter
  App-Sweep (general-purpose): **keine Critical/High**. Clamp-Logik und
  „Alle Jahre"-Pfad verifiziert, kein Auth-/await-/Scope-Fehler, Client↔Server-
  Parameter-Wiring sauber. Minor/uncertain Notizen ohne Auswirkung auf aktuelle
  Daten (alles 2026): abgleich-POST-Param-Namenskonsistenz; abgleich-„unsichere
  Zuordnungen" mit jahresübergreifendem Beleg/Buchung. Ein **vorbestehender**
  (nicht aus PROJ-22) Medium-Befund dokumentiert: `konten/import` schluckt einen
  möglichen `job_lauf`-Insert-Fehler → verwaiste `import_lauf_id=null`.

## Implementierungsnotizen
- **DB:** Migration `0012_firmenprofil_aktives_jahr.sql` — Spalte
  `firmenprofil.aktives_jahr` (smallint, nullable, CHECK 2000–2100 oder NULL).
  `NULL` = „Alle Jahre". Einmalige Vorbelegung bestehender Profile auf das
  jüngste Buchungsjahr (Default „letztes Jahr mit Daten"). Keine RLS-Änderung
  (owner-scoped ALL-Policy deckt die Spalte mit ab).
- **Zentrale Logik:** `src/lib/jahr/aktives-jahr.ts` — reine Helper
  (`jahrZuZeitraum`, `clampZeitraum`, `verfuegbareJahre`, `parseJahrParam`) +
  DB-Loader (`ladeAktivesJahr`, `ladeJahrKontext`, `aktiverZeitraum`). 19
  Unit-Tests. `aktiverZeitraum` ist die Single Source of Truth für die
  serverseitige Fensterauflösung (expliziter `?jahr=` > globales Jahr; explizite
  von/bis werden bei bestimmtem Jahr darauf geklammert = harte Klammer; „Alle
  Jahre" = unbegrenzt).
- **Context/UI:** `JahrProvider` (`src/components/jahr/jahr-provider.tsx`,
  serverseitig im `(app)/layout` geseedet) + `JahresWaehler` (Topbar, shadcn
  `Select`, „Alle Jahre" + Datenjahre). Auswahl → PATCH `/api/firma/jahr` →
  optimistisches Context-Update + `router.refresh()`. Wähler auf
  `/einstellungen` und `/profil` ausgeblendet.
- **API:** `PATCH /api/firma/jahr` setzt `aktives_jahr` (owner-scoped, Zod,
  Audit-Eintrag `aktion="aktives_jahr_gesetzt"`).
- **Konsumenten (serverseitig über `aktiverZeitraum`):** bewegungen,
  kategorien-analyse (+ buchungen-drilldown), cockpit, abgleich (GET, beide
  Datumsspalten), prüfliste (neu), kündigungen (neu); Server-Pages belege
  (`beleg_datum`), merkliste, buchungen; Dashboard-Loader (`refDatum` aufs
  aktive WJ). Lieferanten/Wiederkehrend bewusst unverändert (365-Tage-Lookback
  bleibt; sie erhalten ihr Fenster bereits vom geklammerten Picker).
- **Konsumenten (clientseitig aus Context):** Kategorien-Analyse-Ansicht
  (Default-Zeitraum = aktives Jahr, Detail-Picker wird auf das Jahr geklammert;
  kaskadiert auf Geldbewegungen/Cockpit/Abo-Radar/Lieferanten/Tabelle).
- **Steuer/Export-Seiten:** USt-VA (hardcodiertes `getFullYear()` behoben,
  liest jetzt aktives Jahr + `?jahr=`), EÜR/ESt/Export übernehmen das aktive
  Jahr als Vorauswahl (`key`-Remount bei globalem Jahreswechsel); ihre eigenen
  Jahr-Dropdowns bleiben für die per-Jahr-Steuersicht erhalten.
- **Verifikation:** `tsc` fehlerfrei, `lint` 0 Errors, `npm test` 669 grün,
  `npm run build` erfolgreich (Route `/api/firma/jahr` registriert).
- **Bekannte Grenze:** Topbar (und damit der Wähler) ist nur ≥ md sichtbar
  (bestehende Shell-Konvention); mobile Platzierung nicht Teil dieses MVP.

## Beschreibung
Der Inhaber arbeitet die Buchhaltung Jahr für Jahr ab (z. B. erst 2026
fertig, dann 2025). Heute gibt es **kein** app-weites Jahreskonzept: jede
Seite entscheidet eigenständig (mal `new Date().getFullYear()`, mal ein
`?jahr=`-URL-Param, mal ein eigener `ZeitraumPicker`, einige Seiten filtern
gar nicht nach Zeit). Dadurch ist „ich bearbeite jetzt nur 2025" nicht
durchgängig möglich.

PROJ-22 führt einen **globalen Jahreswähler** in der Topbar ein. Die Auswahl
ist eine **harte Klammer**: ist ein bestimmtes Jahr aktiv, zeigen alle
buchhaltungsrelevanten Ansichten ausschließlich Daten dieses Jahres; andere
Jahre sind nirgends sichtbar. Zusätzlich gibt es eine **„Alle Jahre"**-Option,
die den Filter aufhebt — für jahresübergreifende Analysen (z. B. Abo-/
Wiederkehr-Erkennung). So liefert ein einziger Schalter beide Modi:
fokussiertes Bearbeiten eines Jahres **und** den Mehrjahres-Blick.

Das aktive Jahr wird in der DB (`firmenprofil`) gespeichert — eine globale
Wahrheit, die Reload und Neustart überlebt und (Single-User) geräteübergreifend
gilt.

## User Stories
- Als Inhaber möchte ich oben in der App ein Jahr (oder „Alle Jahre") wählen, damit alle Ansichten sofort nur die Daten dieses Jahres zeigen und ich fokussiert eine Periode abarbeiten kann.
- Als Inhaber möchte ich, dass die Jahreswahl erhalten bleibt, wenn ich die App neu lade oder neu starte, damit ich nicht jedes Mal neu umstellen muss.
- Als Inhaber möchte ich auf „Alle Jahre" umschalten können, damit wiederkehrende Empfänger / Abos über mehrere Jahre hinweg erkannt werden.
- Als Inhaber möchte ich, dass der Jahreswähler nur dort erscheint, wo er Sinn ergibt (nicht in den Einstellungen), damit die Oberfläche nicht mit bedeutungslosen Schaltern überladen wird.
- Als Inhaber möchte ich, dass die Steuer-Ansichten (USt-VA, EÜR, ESt) das aktive Jahr als Vorauswahl übernehmen, damit ich nicht doppelt einstellen muss.

## Bedeutung der Jahreswahl (festgelegt)
- Ein gewähltes Jahr bedeutet das **Kalenderjahr** (1. Jan – 31. Dez). Die
  Wirtschaftsjahr-Logik (`firmenprofil.wirtschaftsjahr_beginn`) bleibt
  ausschließlich in den Steuermodulen erhalten, wo sie heute schon greift
  (EÜR rechnet weiterhin mit `wirtschaftsjahrGrenzen`). Für die meisten Profile
  ist `wirtschaftsjahr_beginn = 1`, also Kalender = Wirtschaftsjahr.
- „Alle Jahre" = kein Datumsfilter.

## Acceptance Criteria

### Jahreswähler (UI)
- [ ] In der Topbar des App-Bereichs gibt es einen kompakten Jahreswähler (shadcn `Select`)
- [ ] Die Optionen sind „Alle Jahre" + jedes Jahr, für das tatsächlich Buchungen existieren (abgeleitet aus min/max `buchung_datum`), absteigend sortiert; das aktuelle Kalenderjahr ist immer wählbar, auch ohne Daten
- [ ] Auswahl ändert das aktive Jahr sofort: persistiert in der DB **und** alle sichtbaren Ansichten laden neu auf das neue Jahr
- [ ] Der aktuell aktive Wert ist im Wähler erkennbar (selektiert)
- [ ] Auf reinen Einstellungs-Seiten (Firma, Konten, Kontenrahmen, Paperless, Regeln, Admin, Profil) ist der Wähler ausgeblendet

### Persistenz
- [ ] Das aktive Jahr wird in `firmenprofil` gespeichert (`aktives_jahr`, nullable: `NULL` = „Alle Jahre")
- [ ] Nach Reload / Neustart / auf einem anderen Gerät ist dasselbe Jahr aktiv
- [ ] Default beim ersten Mal (kein Wert gesetzt): **letztes Jahr mit Daten**; gibt es keine Buchungen, das aktuelle Kalenderjahr

### Harte Klammer — buchhaltungsrelevante Ansichten
Bei aktivem **bestimmten Jahr** zeigen folgende Ansichten ausschließlich Daten
dieses Kalenderjahres; bei **„Alle Jahre"** kein Datumsfilter:
- [ ] Buchungen / Geldbewegungen
- [ ] Kategorien-Analyse (inkl. Finanzen-Cockpit, Abo-Radar, Lieferanten-Tab)
- [ ] Abgleich (Beleg↔Buchung)
- [ ] Prüfliste (bekommt **erstmals** einen Datumsfilter über `buchung_datum`)
- [ ] Dashboard / Perioden-Übersicht
- [ ] Belege (gefiltert über `beleg_datum`)
- [ ] Kündigungsliste, Lieferanten-Notizen-Übersicht, Merkliste (folgen ebenfalls dem aktiven Jahr; „Alle Jahre" für den Mehrjahres-Blick)
- [ ] Die vorhandenen Detail-`ZeitraumPicker` (Monat/Quartal/frei) bewegen sich **nur innerhalb** des aktiven Jahres; sie können nicht über die Jahresgrenze hinaus wählen

### Steuer-Ansichten (genau ein Jahr nötig)
- [ ] USt-VA, EÜR, ESt und Export übernehmen das aktive Jahr als Vorauswahl
- [ ] Ist „Alle Jahre" aktiv, fallen diese Ansichten auf ihr bestehendes eigenes Jahr-Dropdown / das letzte Datenjahr zurück (sie zeigen nie „alle Jahre" gleichzeitig, da fachlich genau ein Jahr nötig ist)
- [ ] Die `/ust-voranmeldung`-Seite respektiert das gewählte Jahr (heute hardcodiert auf `getFullYear()` — wird behoben)

### Sicherheit & Konsistenz
- [ ] Lesen/Schreiben von `aktives_jahr` ist owner-scoped (RLS + explizit), genau wie das übrige `firmenprofil`
- [ ] Das Setzen des Jahres erzeugt einen `audit_eintrag` (Quelle „nutzer")
- [ ] Ein zentraler Helper übersetzt das aktive Jahr → `{ von, bis }` bzw. `null`; alle API-Routen nutzen denselben Helper (keine duplizierte Datumslogik)

## Edge Cases
- **Keine Buchungen vorhanden** → Wähler zeigt nur „Alle Jahre" + aktuelles Kalenderjahr; Default = aktuelles Kalenderjahr
- **`aktives_jahr` zeigt auf ein Jahr ohne Daten** (z. B. nach Löschen eines Imports) → Ansichten sind leer (korrekt); Wähler zeigt das Jahr weiter an, solange es gesetzt ist; Nutzer kann auf „Alle Jahre" oder ein Datenjahr wechseln
- **„Alle Jahre" + Steuer-Seite** → Steuer-Seite nutzt eigenes Jahr-Dropdown (Fallback: letztes Datenjahr), keine Vermischung
- **Detail-`ZeitraumPicker` hat einen gespeicherten Bereich außerhalb des aktiven Jahres** → wird beim Jahreswechsel auf das aktive Jahr geklammert (Bereich = Schnittmenge mit dem Jahr; leere Schnittmenge → ganzes Jahr)
- **Wirtschaftsjahr ≠ Kalenderjahr** (`wirtschaftsjahr_beginn ≠ 1`) → globale Klammer bleibt Kalenderjahr für die Listen-/Arbeitsansichten; nur die Steuermodule rechnen mit Wirtschaftsjahr-Grenzen (wie bisher). Bewusst kein Mischmodell.
- **Mehrere Tabs offen, in einem wird das Jahr geändert** → der andere Tab zeigt das alte Jahr bis zum nächsten Navigieren/Reload (kein Echtzeit-Sync nötig; Single-User, akzeptiert)
- **Direktlink mit `?jahr=` (z. B. aus der Perioden-Übersicht)** → expliziter Param übersteuert für diese Ansicht das globale Jahr (nötig für die Steuer-Drilldowns), ändert aber nicht das gespeicherte aktive Jahr

## Technical Requirements
- Performance: aktives Jahr + verfügbare Jahre werden **einmal** in der `(app)`-Layout-Server-Komponente geladen und per Context verteilt; kein zusätzlicher Roundtrip je Seite
- Konsistenz: ein einziger Helper `jahrZuZeitraum(aktivesJahr)` als Single Source of Truth für die Datumsableitung
- Kompatibilität: API-Routen lesen das aktive Jahr serverseitig aus dem Profil als Default; ein expliziter `?jahr=` (bzw. `?von/bis`) darf weiterhin übersteuern (Steuer-Drilldowns, teilbare Links)
- Keine neuen npm-Pakete; shadcn `Select` ist vorhanden

## Dependencies
- Requires: PROJ-1 (Auth & Firmenprofil) — `firmenprofil` ist Speicherort + RLS-Anker
- Berührt: PROJ-4/5/6/7 (Buchungen, Klassifizierung, Abgleich, Prüfliste), PROJ-8/9/10/11 (USt/EÜR/ESt/Export), PROJ-12 (Dashboard), PROJ-14 (Kategorien-Analyse), PROJ-18/19/20/21 (Lieferanten/Kündigungen/Merkliste/Notizen) — alle konsumieren künftig das aktive Jahr
- Verwandt: bestehende `ZeitraumPicker`-Logik (Kategorien-Analyse, Geldbewegungen) wird auf das aktive Jahr geklammert

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (im Brainstorming festgelegt)

### Kernentscheidungen
1. **Speicher:** neue Spalte `firmenprofil.aktives_jahr` (smallint, nullable).
   `NULL` = „Alle Jahre". Eine Migration, kein neues Table. Single-User → ein
   Wert = globale Wahrheit.
2. **Verteilung:** `JahrProvider` (React Context) in [layout.tsx](src/app/(app)/layout.tsx),
   serverseitig geseedet mit `{ aktivesJahr, verfuegbareJahre }`. Exponiert
   `{ aktivesJahr, setAktivesJahr, verfuegbareJahre }` für Client-Komponenten.
3. **UI:** `JahresWaehler` (shadcn `Select`) in der heute statischen Topbar.
   Bei Auswahl: PATCH `firmenprofil` → Context aktualisieren → `router.refresh()`.
   Ausgeblendet auf Einstellungs-Routen (Pfad-Check).
4. **Lesen in den APIs:** zentraler Helper `jahrZuZeitraum(aktivesJahr)` →
   `{ von: 'YYYY-01-01', bis: 'YYYY-12-31' } | null`. API-Routen lesen das
   aktive Jahr serverseitig aus dem Profil als Default; expliziter `?jahr=`/
   `?von/bis` übersteuert. Vermeidet, den Param durch jeden Fetch zu fädeln.
5. **Verfügbare Jahre:** aus `min/max(buchung_datum)` der Buchungen abgeleitet,
   plus aktuelles Kalenderjahr, plus „Alle Jahre".

### Betroffene API-Routen (Datumsklammer ergänzen/vereinheitlichen)
- `/api/finanzen/bewegungen`, `/api/kategorien-analyse`,
  `/api/finanzen/cockpit`, `/api/finanzen/lieferanten`,
  `/api/finanzen/wiederkehrend` — heute teils `von/bis`, Default auf aktives Jahr
- `/api/abgleich` — Datumsklammer als Default
- `/api/pruefliste` — **neu** Datumsfilter über `buchung_datum`
- `/api/dashboard` — auf aktives Jahr
- `/api/belege` (Belege-Seite) — über `beleg_datum`
- `/api/kuendigungen`, `/api/merkliste`, `/api/finanzen/lieferanten/notizen` — folgen aktivem Jahr
- `/api/steuer/ust`, `/api/steuer/euer`, `/api/steuer/est`, `/api/export` —
  aktives Jahr als Vorauswahl; „Alle Jahre" → eigenes Jahr-Dropdown / letztes Datenjahr
- `/api/firma` — GET liefert `aktives_jahr`, PATCH setzt es (Audit-Eintrag)

### Bewusst NICHT enthalten (YAGNI)
- Kein globaler Monats-/Quartalswähler — Detailgranularität bleibt in den
  bestehenden `ZeitraumPicker`n (innerhalb des Jahres geklammert)
- Kein Echtzeit-Sync zwischen mehreren Tabs
- Kein Mischmodus Kalender-/Wirtschaftsjahr in den Listenansichten
- Kein Mehrjahres-Range (z. B. „2024–2025") — nur ein Jahr oder „Alle Jahre"

## QA Test Results
**Datum:** 2026-06-16 · **Ergebnis:** Production-ready (keine Critical/High)
- Automatisiert: `tsc` fehlerfrei · `lint` 0 Errors · `npm test` 669 grün
  (inkl. 19 neuer Helper-Tests) · `npm run build` erfolgreich.
- Adversarialer PROJ-22-Review + breiter statischer App-Sweep (2 Subagents):
  keine Critical/High; Befunde siehe Deployment-Abschnitt.

## Deployment
Siehe Abschnitt „Deployment" oben (2026-06-16).
