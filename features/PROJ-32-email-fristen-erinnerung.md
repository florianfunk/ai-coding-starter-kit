# PROJ-32: E-Mail-Fristen-Erinnerung (USt-VA-Frist)

## Status: In Progress
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
- [ ] **AC1 — Auswahl-Logik (rein, testbar):** Funktion bestimmt aus
  `UstFristInfo` + bereits gesendeten `(periode_key, stufe)` die fällige
  Erinnerung (Stufen: 14T/3T/überfällig, abgeleitet aus `ampel`/`tage_bis_frist`
  /`ueberfaellig`). Liefert `null`, wenn nichts (mehr) fällig ist. Idempotent.
  Unit-getestet: jede Stufe genau einmal; neutral→keine Mail; überfällig.
- [ ] **AC2 — Mail-Adapter (no-op ohne Key):** `sendMail` sendet via Resend,
  wenn `RESEND_API_KEY` gesetzt ist; sonst no-op + `console`-Log, KEIN Fehler.
  Per Dependency-Injection/Mock testbar (kein echter Netzwerk-Call im Test).
- [ ] **AC3 — Template (rein, testbar):** Render-Funktion erzeugt Betreff +
  Text/HTML (deutsch, Periode, Resttage/überfällig, Link ins Tool). Snapshot-/
  Inhalts-getestet (enthält Periode + Frist).
- [ ] **AC4 — Cron-Endpoint geschützt:** `GET /api/cron/fristen-erinnerung`
  lehnt ohne gültiges `Authorization: Bearer $CRON_SECRET` mit 401 ab. Mit
  gültigem Secret: Profil laden → Auswahl → (Opt-in & Mailadresse vorhanden) →
  senden → Log schreiben → JSON-Summary. Ohne Opt-in: kein Versand.
- [ ] **AC5 — Idempotenz/DB:** Migration `fristen_erinnerung` (owner_id,
  periode_key, stufe, gesendet_am, unique(owner_id,periode_key,stufe)) + RLS
  owner-scoped. Zweiter Cron-Lauf am selben Tag sendet NICHT erneut. Opt-in-Feld
  (`firmenprofil.fristen_mail_aktiv`) in Migration ergänzt (default false).
- [ ] **AC6 — Keine echten Mails im Bau/Test; Doku:** Ohne `RESEND_API_KEY`
  läuft alles ohne Versand durch. README/Spec dokumentiert nötige ENV
  (`RESEND_API_KEY`, `CRON_SECRET`, Absender, App-URL) + vercel-Cron-Eintrag.
- [ ] **AC7 — Keine Regression:** tsc 0, build ok, alle Tests grün. Bestehender
  Fristen-Countdown (PROJ-27) unverändert. Neue Migration sauber additiv.

## Implementation Notes
_(von den Agenten zu füllen)_

### Hinweise für den Agenten
- Mail-Provider: **Resend** (`resend` npm). Nur Dep hinzufügen, NICHT senden.
- Auth-Mailadresse: Supabase Auth-User-E-Mail nutzen, falls verfügbar; sonst ein
  Profilfeld. Opt-in MUSS explizit sein (default aus).
- Cron-Schutz strikt nach Vercel-Doku (`CRON_SECRET`). Endpoint NICHT ohne Secret
  erreichbar machen.
- Migrationsnummern fortlaufend nach `0017` prüfen (höchste vorhandene + 1).
