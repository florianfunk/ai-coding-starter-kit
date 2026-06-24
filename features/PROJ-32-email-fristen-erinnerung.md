# PROJ-32: E-Mail-Fristen-Erinnerung (USt-VA-Frist)

## Status: Deployed
**Created:** 2026-06-24
**Last Updated:** 2026-06-24
**Priorität:** P2

## Beschreibung
Der USt-VA-Fristen-Countdown (PROJ-27) ist heute **passiv** — er warnt nur,
wenn der Inhaber das Tool öffnet. Dieses Feature ergänzt eine **aktive
E-Mail-Erinnerung** an die hinterlegte Nutzer-Adresse, wenn eine USt-VA-Frist
näher rückt (Ampel `gelb`/`rot`) oder überfällig ist. Eine verpasste USt-VA-
Frist kostet real Geld (Verspätungszuschlag) — die Erinnerung ist der einzige
Baustein der aktuellen Roadmap mit echter Schutzwirkung.

Single-User-Tool: genau ein Empfänger (der eingeloggte Inhaber). Der Versand
läuft über einen **geschützten Cron-Endpoint** (Vercel Cron → `/api/cron/...`),
der die Fristenlogik aus PROJ-27 (`naechsteUstFrist`) wiederverwendet und bei
Bedarf eine Mail auslöst. **Idempotenz:** pro Periode+Stufe wird höchstens eine
Mail verschickt (Versand-Log in DB), damit der tägliche Cron nicht spammt.

> **Wichtig (outward-facing):** Tatsächlicher Mailversand braucht einen
> Provider (Resend) + API-Key + verifizierte Absender-Domain. Diese Einrichtung
> und der „scharfe" Versand bleiben Florians Entscheidung. Das Feature wird so
> gebaut, dass es ohne gesetzten `RESEND_API_KEY` **nichts sendet** (no-op mit
> Log) und erst nach Konfiguration aktiv wird. Der Agent versendet im Bau/Test
> KEINE echten Mails.

## Scope (festgelegt)
- **Fristen-Auswahl-Logik (rein, testbar):** entscheidet aus `naechsteUstFrist`
  + bereits versendeten Erinnerungen, OB und mit welcher Stufe
  (z. B. „14 Tage", „3 Tage", „überfällig") eine Mail fällig ist. Idempotent
  über einen Schlüssel `periode + stufe`.
- **Mail-Adapter:** dünne Abstraktion (`sendMail`) über Resend; ohne
  `RESEND_API_KEY` → no-op + Log (kein Fehler). Adapter-Aufruf testbar (Mock).
- **Mail-Template:** schlichte, deutsche Text/HTML-Mail (Betreff mit Periode +
  Resttagen, Link ins Tool). Reine Render-Funktion, testbar.
- **Cron-Endpoint:** `GET /api/cron/fristen-erinnerung`, geschützt über
  `CRON_SECRET` (Vercel-Standard: `Authorization: Bearer $CRON_SECRET`).
  Lädt Profil (Rhythmus, Dauerfrist, Mailadresse/Opt-in), ruft Auswahl-Logik,
  sendet via Adapter, schreibt Versand-Log. Antwortet mit JSON-Zusammenfassung.
- **DB:** Tabelle `fristen_erinnerung` (owner_id, periode_key, stufe,
  gesendet_am) für Idempotenz + Audit. RLS owner-scoped wie alle Tabellen.
  Opt-in-Flag + Mailadresse: bevorzugt aus Auth/Profil; falls nötig
  `firmenprofil.fristen_mail_aktiv` (boolean, default false → Opt-in).
- **vercel.json / vercel.ts:** Cron-Eintrag (täglich, z. B. 06:00) —
  dokumentiert, aber Florian aktiviert/deployt.

## Out of Scope
- Andere Fristen als USt-VA (EÜR/ESt) — spätere Iteration.
- Push/SMS/Slack — nur E-Mail.
- Mehrere Empfänger / Team-Verteiler (Single-Tenant).
- Tatsächliche Domain-Verifizierung & Scharfschaltung (Florian).

## User Stories
- Als Inhaber möchte ich rechtzeitig eine E-Mail bekommen, bevor eine USt-VA-
  Frist abläuft, damit ich keine Frist (und keinen Verspätungszuschlag) verpasse.
- Als Inhaber möchte ich nicht mehrfach für dieselbe Frist/Stufe gemailt werden.

## Acceptance Criteria
- [x] **AC1 — Auswahl-Logik (rein, testbar):** Funktion bestimmt aus
  `UstFristInfo` + bereits gesendeten `(periode_key, stufe)` die fällige
  Erinnerung (Stufen: 14T/3T/überfällig, abgeleitet aus `ampel`/`tage_bis_frist`
  /`ueberfaellig`). Liefert `null`, wenn nichts (mehr) fällig ist. Idempotent.
  Unit-getestet: jede Stufe genau einmal; neutral→keine Mail; überfällig.
- [x] **AC2 — Mail-Adapter (no-op ohne Key):** `sendMail` sendet via Resend,
  wenn `RESEND_API_KEY` gesetzt ist; sonst no-op + `console`-Log, KEIN Fehler.
  Per Dependency-Injection/Mock testbar (kein echter Netzwerk-Call im Test).
- [x] **AC3 — Template (rein, testbar):** Render-Funktion erzeugt Betreff +
  Text/HTML (deutsch, Periode, Resttage/überfällig, Link ins Tool). Snapshot-/
  Inhalts-getestet (enthält Periode + Frist).
- [x] **AC4 — Cron-Endpoint geschützt:** `GET /api/cron/fristen-erinnerung`
  lehnt ohne gültiges `Authorization: Bearer $CRON_SECRET` mit 401 ab. Mit
  gültigem Secret: Profil laden → Auswahl → (Opt-in & Mailadresse vorhanden) →
  senden → Log schreiben → JSON-Summary. Ohne Opt-in: kein Versand.
- [x] **AC5 — Idempotenz/DB:** Migration `fristen_erinnerung` (owner_id,
  periode_key, stufe, gesendet_am, unique(owner_id,periode_key,stufe)) + RLS
  owner-scoped. Zweiter Cron-Lauf am selben Tag sendet NICHT erneut. Opt-in-Feld
  (`firmenprofil.fristen_mail_aktiv`) in Migration ergänzt (default false).
- [x] **AC6 — Keine echten Mails im Bau/Test; Doku:** Ohne `RESEND_API_KEY`
  läuft alles ohne Versand durch. README/Spec dokumentiert nötige ENV
  (`RESEND_API_KEY`, `CRON_SECRET`, Absender, App-URL) + vercel-Cron-Eintrag.
- [x] **AC7 — Keine Regression:** tsc 0, build ok, alle Tests grün. Bestehender
  Fristen-Countdown (PROJ-27) unverändert. Neue Migration sauber additiv.

## Implementation Notes

### Was gebaut wurde (Dateien)
- `src/lib/fristen/erinnerung.ts` — reine Auswahl-Logik
  (`bestimmeFaelligeErinnerung`, `periodeKey`, `idempotenzSchluessel`). Leitet
  aus `UstFristInfo` (PROJ-27) + Set bereits gesendeter Schlüssel die fällige
  Stufe `14_tage | 3_tage | ueberfaellig` ab oder `null`. Idempotent.
- `src/lib/fristen/template.ts` — reine Render-Funktion
  `rendereErinnerungMail` → `{ betreff, text, html }` (deutsch, HTML-escaped,
  Periode + Abgabefrist + Resttage/Überfälligkeit + Tool-Link `…/ust-voranmeldung`).
- `src/lib/fristen/mailer.ts` — Mail-Adapter `sendMail`. **No-op ohne
  `RESEND_API_KEY`** (console-Log, kein Fehler, kein Netzwerk-Call). Realer
  Versand über **dynamischen** Resend-Import (Build bricht nicht, wenn Paket
  fehlt). Per `Versender`-Injection im Test mockbar.
- `src/lib/fristen/cron-runner.ts` — Orchestrierung `laufFristenErinnerung`:
  Profil + Opt-in laden, Auth-User-Mail (`auth.admin.getUserById`),
  abgeschlossene USt-VA-Perioden, bereits versendete Erinnerungen → Frist
  (`naechsteUstFrist`) → fällige Stufe → Render → `sendMail` → Log-Insert (nur
  bei erfolgtem Versand). Liefert maschinenlesbare `CronRunnerSummary`.
- `src/lib/supabase/admin.ts` — `createAdminClient()` (Service-Role, server-only;
  der Cron hat keine Nutzer-Session, owner-Scoping erfolgt im Runner-Code).
- `src/app/api/cron/fristen-erinnerung/route.ts` — dünner `GET`-Handler.
  Schutz strikt: ohne/mit falschem `Authorization: Bearer $CRON_SECRET` → 401;
  ohne gesetztes `CRON_SECRET` ist der Endpoint geschlossen (401). Delegiert an
  den Runner und gibt JSON-Summary zurück.
- `supabase/migrations/0018_fristen_erinnerung.sql` — neue Tabelle
  `fristen_erinnerung` (owner_id, periode_key, stufe, gesendet_am,
  `unique(owner_id, periode_key, stufe)`, RLS owner-scoped für SELECT/INSERT/
  UPDATE/DELETE, Index `(owner_id, periode_key)`) + `firmenprofil.fristen_mail_aktiv
  boolean not null default false`.
- `vercel.json` (neu) — Cron `GET /api/cron/fristen-erinnerung` täglich 06:00
  (`"0 6 * * *"`).
- `.env.local.example` — neue ENV-Variablen dokumentiert.
- Tests: `erinnerung.test.ts`, `template.test.ts`, `mailer.test.ts`,
  `cron-runner.test.ts` (gemockter Supabase-Client + injizierter Versender,
  KEIN echter Versand/DB).

### Benötigte ENV-Variablen
| Variable | Zweck | Pflicht für Versand |
|----------|-------|---------------------|
| `RESEND_API_KEY` | Resend-API-Key. **Fehlt er → no-op, keine Mail.** | ja |
| `FRISTEN_MAIL_FROM` | Absender (bei Resend verifiziert). Default `STEUERAGENT <onboarding@resend.dev>`. | empfohlen |
| `CRON_SECRET` | Schützt den Cron-Endpoint (`Authorization: Bearer …`). Ohne Secret → 401. | ja |
| `NEXT_PUBLIC_APP_URL` | Basis-URL für den Link in der Mail (Fallback `NEXT_PUBLIC_SITE_URL`, sonst localhost). | empfohlen |
| `SUPABASE_SERVICE_ROLE_KEY` | bereits vorhanden; vom Cron-Admin-Client genutzt (server-only). | ja |

Zusätzlich pro Inhaber: Opt-in `firmenprofil.fristen_mail_aktiv = true` setzen,
sonst sendet der Lauf bewusst nicht.

### Vercel-Cron / Deploy (Florian)
- `vercel.json` enthält den Cron-Eintrag (täglich 06:00 UTC). Vercel ruft den
  Endpoint dann automatisch mit `Authorization: Bearer $CRON_SECRET` auf —
  `CRON_SECRET` muss in den Vercel-Projekt-Env-Variablen gesetzt sein.
- **DB-Migration 0018 wurde NICHT in Prod ausgeführt** (Florian macht
  Migrationen selbst) — nur die `.sql`-Datei liegt im Repo.
- Scharfschaltung: `RESEND_API_KEY` + verifizierte Absender-Domain bei Resend
  setzen, `FRISTEN_MAIL_FROM` auf die verifizierte Adresse, Opt-in aktivieren.

### Status-/Test-Stand
- `npx tsc --noEmit`: 0 Fehler.
- `npm run build`: erfolgreich (`/api/cron/fristen-erinnerung` registriert).
- `npm test` (vitest): 908 grün / 1 skipped; davon 23 neu in `src/lib/fristen/`.
- `npm run lint`: 0 Errors (nur vorbestehende Warnings in fremden Dateien).
- `resend@4.8.0` per `npm install` ergänzt (package.json + lockfile).

### Hinweise für den Agenten
- Mail-Provider: **Resend** (`resend` npm). Nur Dep hinzufügen, NICHT senden.
- Auth-Mailadresse: Supabase Auth-User-E-Mail nutzen, falls verfügbar; sonst ein
  Profilfeld. Opt-in MUSS explizit sein (default aus).
- Cron-Schutz strikt nach Vercel-Doku (`CRON_SECRET`). Endpoint NICHT ohne Secret
  erreichbar machen.
- Migrationsnummern fortlaufend nach `0017` prüfen (höchste vorhandene + 1).
