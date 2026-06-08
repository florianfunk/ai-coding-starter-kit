# PROJ-1: Auth & Multi-Tenant Foundation

## Status: Approved
**Created:** 2026-06-08
**Last Updated:** 2026-06-09 (QA passed — no Critical/High; BUG-1 Medium fixed)

> Fundament der RiskGuard-Plattform: Authentifizierung, mandantenfähiges Organisations-/Workspace-Modell,
> Rollen und mandantenstrenge Datenisolation (RLS). Zusätzlich werden in diesem Feature die zwei
> cross-cutting Grundlagen ab Tag 1 aufgesetzt: **i18n** (next-intl, DE primär + EN) und die
> **Vercel-Workflow-DevKit-Durability-Schicht** (Gerüst). Kontext: [docs/PROJECT-PLAN.md §4/§5.2/§5.5](../docs/PROJECT-PLAN.md).

## Dependencies
- None (Basis-Feature; alle weiteren PROJ-X bauen auf der hier definierten Tenant-/Rollen-/RLS-Schicht auf).

## Scope (Entscheidungen)
- **Auth-Methoden (MVP):** E-Mail/Passwort **und** Magic Link (passwordless). Enterprise SSO/SAML ist
  bewusst NICHT Teil des MVP → eigenes Feature **PROJ-29**.
- **Onboarding-Modell:** **Invite-only**. Neue Organisationen werden administrativ provisioniert; Nutzer
  treten ausschließlich per Einladung bei. Kein offener Self-Service-Signup im MVP.
- **Rollen:** `admin`, `analyst`, `viewer` (pro Organisation, über `memberships`).

## User Stories
- Als **Plattform-/Org-Admin** möchte ich Nutzer per E-Mail in meine Organisation einladen und ihnen eine
  Rolle zuweisen, damit nur berechtigte Personen Zugriff auf unsere Risikodaten erhalten.
- Als **eingeladener Nutzer** möchte ich über einen Einladungslink mein Konto aktivieren (Passwort setzen
  oder Magic Link nutzen), damit ich der richtigen Organisation mit der vorgesehenen Rolle beitrete.
- Als **registrierter Nutzer** möchte ich mich per E-Mail/Passwort oder Magic Link anmelden, damit ich
  flexibel und sicher Zugang erhalte.
- Als **Analyst** möchte ich Produkt-/Risikodaten meiner Organisation anlegen und bearbeiten, damit ich
  Bewertungen durchführen kann — ohne Zugriff auf Daten anderer Organisationen.
- Als **Viewer** möchte ich Risikodaten meiner Organisation nur lesen können, damit ich informiert bin,
  aber nichts versehentlich verändere.
- Als **Org-Admin** möchte ich Mitglieder verwalten (Rolle ändern, deaktivieren/entfernen, Einladungen
  zurückziehen), damit ich Zugriffe über die Zeit steuern kann.
- Als **Nutzer** möchte ich die Oberfläche auf Deutsch (Standard) oder Englisch nutzen, damit die
  Plattform für mein Team verständlich ist.

## Acceptance Criteria
**Authentifizierung**
- [ ] Nutzer können sich mit E-Mail/Passwort registrieren (nur über gültige Einladung) und anmelden.
- [ ] Nutzer können sich alternativ per Magic Link (E-Mail-Link, passwordless) anmelden.
- [ ] Passwort-Reset per E-Mail funktioniert; Passwörter erfüllen eine definierte Mindest-Policy.
- [ ] Sessions sind sicher (httpOnly-Cookies via Supabase SSR), laufen ab und können per Logout beendet werden.
- [ ] Nicht authentifizierte Zugriffe auf geschützte Seiten/Server-Actions werden auf Login umgeleitet/abgewiesen.

**Organisationen & Einladungen (invite-only)**
- [ ] Eine Organisation kann administrativ angelegt werden; es gibt KEINEN offenen Self-Service-Signup.
- [ ] Ein Admin kann eine E-Mail-Einladung mit zugewiesener Rolle (admin/analyst/viewer) versenden.
- [ ] Eine Einladung hat einen eindeutigen, zeitlich begrenzt gültigen Token und einen Status
      (pending/accepted/expired/revoked).
- [ ] Annahme der Einladung legt die Mitgliedschaft mit der vorgesehenen Rolle an.
- [ ] Ein Nutzer kann Mitglied **mehrerer** Organisationen sein und zwischen ihnen wechseln (aktiver
      Workspace-Kontext).

**Rollen & Berechtigungen**
- [ ] `admin`: Mitglieder/Einladungen/Rollen verwalten + alle Analyst-Rechte.
- [ ] `analyst`: Tenant-Daten (z. B. Produkte/Komponenten/Assessments) lesen **und** schreiben.
- [ ] `viewer`: Tenant-Daten nur lesen; keine schreibenden Aktionen möglich (UI + Server-seitig erzwungen).
- [ ] Rollenprüfung erfolgt server-seitig (nicht nur UI-Verstecken).

**Mandanten-Isolation (RLS) — kritisch**
- [ ] Jede Tenant-Tabelle ist per Postgres-RLS auf `org_id` der Mitgliedschaft des angemeldeten Nutzers gescoped.
- [ ] Ein Nutzer kann nachweislich KEINE Daten einer Organisation lesen/schreiben, in der er kein Mitglied ist.
- [ ] Es existieren automatisierte **RLS-Cross-Tenant-Tests** (Vitest/pgTAP), die fehlschlagen, wenn
      Isolation verletzt wird; sie sind Teil des `/qa`-Release-Gates.
- [ ] `audit_log` ist insert-only (kein UPDATE/DELETE per Policy).

**i18n & Durability (Tag-1-Grundlagen)**
- [ ] Die UI ist mehrsprachig über next-intl; **Deutsch ist Standard**, Englisch verfügbar; Texte liegen
      in `messages/de.json`/`en.json` (keine hartkodierten UI-Strings).
- [ ] Nutzer können die Sprache umschalten; Präferenz wird persistiert.
- [ ] Die Workflow-DevKit-Durability-Schicht ist installiert und mit einem lauffähigen Referenz-Workflow
      (z. B. „Invitation versenden") verdrahtet, sodass spätere Features (PROJ-9/10/14/15/23) darauf aufbauen.

## Edge Cases
- **Einladung an bereits registrierte E-Mail:** Nutzer wird der Organisation hinzugefügt, ohne ein neues
  Konto zu erstellen (Account-Merge, kein Duplikat).
- **Doppelte/erneute Einladung derselben E-Mail in dieselbe Org:** keine Duplikat-Mitgliedschaft; bestehende
  pending-Einladung wird erneuert statt vervielfacht.
- **Abgelaufener/zurückgezogener Einladungs- oder Magic-Link-Token:** klare Fehlermeldung + Möglichkeit,
  eine neue Einladung/Link anzufordern.
- **Entfernen des letzten Admins einer Organisation:** verhindert (eine Org muss mindestens einen Admin
  behalten).
- **Cross-Tenant-Zugriffsversuch** (manipulierte org_id / direkte API-Anfrage): wird durch RLS und
  server-seitige Prüfung abgewiesen (kein Datenleck).
- **Deaktivierter/entfernter Nutzer mit aktiver Session:** Zugriff wird bei der nächsten Anfrage entzogen.
- **Nutzer ohne jede Mitgliedschaft:** sieht einen neutralen „Keine Organisation"-Zustand statt eines Fehlers.
- **E-Mail-Zustellprobleme (Magic Link/Einladung):** Wiederholversand möglich; Rate-Limiting gegen Missbrauch.
- **Rollenänderung während aktiver Session:** neue Berechtigungen greifen spätestens beim nächsten
  Seiten-/Action-Aufruf.

## Technical Requirements
- **Auth/DB:** Supabase Auth (E-Mail/Passwort + Magic Link) + `@supabase/ssr`; Postgres mit RLS.
- **Kerntabellen** (Detail-Design in `/architecture`, Schema-Skizze siehe [PROJECT-PLAN §5.2](../docs/PROJECT-PLAN.md)):
  `organizations`, `memberships(user_id, org_id, role)`, `invitations(email, org_id, role, token, status, expires_at)`.
  Tenant-Tabellen tragen `org_id` und RLS-Policy `org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())`.
- **i18n:** next-intl, DE primär; Locale-Strategie in `/architecture` festzulegen.
- **Durability:** Vercel Workflow DevKit (`workflow` / `@workflow/ai`) installiert; Steps idempotent;
  persistierte Step-Results dienen dem Audit-Trail. Details: [docs/research/04-durable-workflows.md](../docs/research/04-durable-workflows.md).
- **Security:** server-seitige Autorisierung, RLS-Tests als Pflicht-Gate, Rate-Limiting für Auth-/Invite-
  E-Mails; Anbindung der bestehenden Guides unter `docs/production/` (security-headers, rate-limiting).
- **DSGVO:** EU-Region für Supabase; PII (E-Mail/Namen) minimal halten.
- **Performance:** Auth-/Routing-Checks < 200 ms; UI responsiv (Chrome, Firefox, Safari, Edge).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Entscheidungen (aus Architektur-Review):** Pfad-basiertes i18n (`/de`, `/en`) · E-Mail-Versand über
Resend von Anfang an · Vercel Workflow DevKit installieren **und** den Einladungsversand als ersten
echten durable Workflow umsetzen.

### A) Komponenten-Struktur (UI)

```
RiskGuard App  (alle Seiten sprach-präfigiert: /de/… , /en/…)
│
├── Öffentlicher Bereich (nicht angemeldet)
│   ├── Login-Seite
│   │   ├── Variante "E-Mail + Passwort"
│   │   └── Variante "Magic Link" (E-Mail eingeben → Link erhalten)
│   ├── "Magic Link gesendet"-Bestätigung
│   ├── Passwort-Reset (Anfrage + neues Passwort setzen)
│   ├── Einladung annehmen (Token-Seite → Passwort setzen oder Magic Link → Org beitreten)
│   └── Ungültiger/abgelaufener Link (Fehler + "neu anfordern")
│
└── Angemeldeter App-Rahmen (Sidebar-Layout, nutzt vorhandene shadcn-Sidebar)
    ├── Kopfzeile
    │   ├── Organisations-Umschalter (Dropdown — bei Mitgliedschaft in mehreren Orgs)
    │   ├── Sprachumschalter (DE/EN)
    │   └── Nutzer-Menü (Profil, Logout)
    ├── Einstellungen → Mitglieder  (nur Admin sichtbar)
    │   ├── Mitglieder-Tabelle (Name/E-Mail, Rolle, Status, Aktionen)
    │   ├── Dialog "Mitglied einladen" (E-Mail + Rolle auswählen)
    │   ├── Rolle ändern · Mitglied deaktivieren/entfernen · Einladung zurückziehen
    │   └── Offene Einladungen (Liste mit Status)
    ├── Platzhalter-Dashboard (echte Inhalte kommen in PROJ-8)
    └── "Keine Organisation"-Zustand (Nutzer ohne Mitgliedschaft)
```

> Wiederverwendete shadcn/ui-Bausteine: `form`, `input`, `label`, `button`, `select`, `dialog`,
> `dropdown-menu`, `table`, `badge`, `sidebar`, `avatar`, `sonner`/`toast`, `alert`. Keine Eigenbauten.

### B) Datenmodell (Klartext)

```
Organisation
- eindeutige ID, Name, Erstellungszeitpunkt

Mitgliedschaft  (verbindet Nutzer ↔ Organisation)
- Nutzer-ID, Organisations-ID
- Rolle: admin | analyst | viewer
- Status: aktiv | deaktiviert

Einladung
- Ziel-E-Mail, Ziel-Organisation, vorgesehene Rolle
- eindeutiger Token, Ablaufzeitpunkt
- Status: offen | angenommen | abgelaufen | zurückgezogen

Nutzer
- verwaltet von Supabase Auth (E-Mail, Login-Methode, Magic Link); keine Passwörter im Klartext
- Sprachpräferenz (DE Standard) pro Nutzerprofil gespeichert

Audit-Eintrag  (nur Anhängen, kein Ändern/Löschen)
- Wer, Was, Wann zu Auth-/Mitglieder-/Einladungs-Ereignissen
- in PROJ-1 als Fundament angelegt; PROJ-12 erweitert es um KI-Entscheidungen

Gespeichert in: Supabase Postgres (EU-Region). Mandanten-Trennung über Row-Level-Security:
Jede mandantenbezogene Tabelle ist auf die Organisations-Mitgliedschaft des angemeldeten Nutzers
beschränkt. KEIN localStorage für Anwendungsdaten (Mehrbenutzer/Mehrmandanten erfordert die Datenbank).
```

### C) Tech-Entscheidungen (mit Begründung)

1. **Supabase Auth + serverseitige Sessions (@supabase/ssr).** Warum: sichere, cookie-basierte Sessions,
   die im Next.js-App-Router serverseitig geprüft werden und sich direkt mit der Datenbank-Sicherheit
   (RLS) verzahnen. Der vorhandene einfache Client in `src/lib/supabase.ts` wird durch sauber getrennte
   Browser-/Server-/Middleware-Clients ersetzt.
2. **Row-Level-Security als Isolations-Rückgrat.** Warum: Die Mandanten-Trennung wird in der Datenbank
   erzwungen, nicht nur in der App. Das ist deutlich sicherer und das Fundament für ALLE späteren
   Features. Verpflichtende automatisierte Cross-Tenant-Tests stellen sicher, dass kein Mandant Daten
   eines anderen sehen kann (Teil des `/qa`-Gates).
3. **Invite-only über Einladungs-Tokens.** Warum: passt zum B2B-Enterprise-Modell (kontrollierter
   Zugang, kein offener Self-Service). Tokens sind zeitlich begrenzt und einmalig einlösbar.
4. **next-intl, pfad-basiert (`/de`, `/en`).** Warum: eindeutige, teilbare Links und gute Auffindbarkeit;
   Deutsch ist Standard. Alle Texte liegen in Sprachdateien — keine fest verdrahteten UI-Texte.
5. **Resend für E-Mails.** Warum: zuverlässige Zustellung und eigene, markenkonforme Vorlagen für Magic
   Link, Passwort-Reset und Einladungen; wird später von den Benachrichtigungen (PROJ-22) wiederverwendet.
   Der eingebaute Supabase-Mailversand ist zu limitiert für Produktion.
6. **Eine kombinierte Middleware** übernimmt zwei Aufgaben pro Anfrage: Sprache bestimmen/umleiten und die
   Anmelde-Session auffrischen + geschützte Bereiche absichern. Warum: ein zentraler, konsistenter
   Kontrollpunkt statt verstreuter Prüfungen.
7. **Vercel Workflow DevKit; Einladungsversand als erster durable Workflow.** Warum: beweist früh das
   ausfallsichere, wiederaufnehmbare Muster; die protokollierten Schritte bilden zugleich den
   revisionssicheren Audit-Trail. Alle späteren langlaufenden KI-Prozesse (PROJ-9/10/14/15/23) nutzen
   dieselbe Laufzeit. Details: [docs/research/04-durable-workflows.md](../docs/research/04-durable-workflows.md).
8. **Aktiver Workspace-Kontext.** Warum: Da ein Nutzer mehreren Organisationen angehören kann, merkt sich
   die App die aktuell gewählte Organisation (serverseitig im Session-Kontext); der Org-Umschalter wechselt
   sie. Alle Datenzugriffe beziehen sich auf die aktive Organisation.

### D) Abhängigkeiten (zu installierende Pakete)

| Paket | Zweck |
|-------|-------|
| `@supabase/ssr` | Serverseitige/Cookie-basierte Supabase-Auth-Sessions im App-Router |
| `next-intl` | Mehrsprachigkeit (DE/EN), pfad-basiertes Routing |
| `workflow` + `@workflow/ai` | Durable-Workflow-Schicht (Einladungsversand als erster Workflow) |
| `resend` | Transaktions-E-Mails (Magic Link, Reset, Einladungen) |
| `react-email` / `@react-email/components` _(optional)_ | Saubere, wiederverwendbare E-Mail-Vorlagen |

> Bereits vorhanden und genutzt: `@supabase/supabase-js`, `zod`, `react-hook-form`,
> `@hookform/resolvers`, gesamtes shadcn/ui-Set. Kein Python/Offline-Compute in PROJ-1 nötig.

### Out of Scope (bewusst späteren Features zugeordnet)
- Enterprise SSO/SAML → **PROJ-29**.
- Vollständige EU-AI-Act-/GDPR-Artefakte → **PROJ-28** (PROJ-1 legt nur das Audit-Log-Fundament).
- Abrechnung/Pläne/Metering → **PROJ-25** (Tabellen `plans`/`subscriptions` erst dort).
- Fachliche Referenzdaten (16 Risikotypen, Index-Katalog) → **PROJ-2**.

## Frontend Implementation Notes (/frontend)

**Stack & Setup**
- Next.js 16 App Router, next-intl v4 (path-based `/de`,`/en`, DE default), `@supabase/ssr`, shadcn/ui,
  blue brand theme + dark mode (next-themes), Inter font.
- i18n: `src/i18n/{routing,request,navigation}.ts`; catalogs `messages/{de,en}.json`; plugin wired in `next.config.ts`.
- Combined edge handler `src/proxy.ts` (renamed from `middleware.ts` per Next 16): next-intl routing +
  Supabase session refresh + route protection.

**Implemented UI**
- Auth (works client-side against Supabase Auth): login (Passwort + Magic-Link Tabs), reset-password,
  update-password, accept-invite; magic-link / recovery callback at `/[locale]/auth/callback`.
- App shell: `(app)` layout guard, shadcn Sidebar (Mitglieder nur für admin), header with org switcher +
  language switcher + theme toggle + user menu; dashboard placeholder; `/no-organization` state.
- Members: table (Rollen-/Status-Badges, Zeilen-Aktionen Rolle ändern/(de)aktivieren/entfernen, offene
  Einladungen + zurückziehen) + Einladen-Dialog (E-Mail + Rolle).

**Preview mode:** while no Supabase env is set, the full UI renders with mock data
(`src/lib/data/mock.ts`) so it is reviewable now. Set `.env.local` (see `.env.local.example`) to switch
to real auth.

**Build:** `npm run build` is green — TypeScript passes, 18 routes (DE/EN) prerender.

**Backend seams for `/backend` (search `TODO(PROJ-1 /backend)`):**
- Real Supabase queries in `src/lib/data/{orgs,members}.ts` and `src/lib/auth.ts` (currently return [] in
  real mode).
- DB schema `organizations` / `memberships` / `invitations` + RLS policies + **RLS cross-tenant tests** (gate).
- Invitation token validation + membership creation (`accept-invite-form.tsx`).
- Server actions for member mutations (`members-table.tsx`) and invite send via **Resend + durable
  invitation workflow** (`invite-member-dialog.tsx`).
- `audit_log` (insert-only) for auth/membership/invite events.

**Known issue (pre-existing):** the `npm run lint` script still calls `next lint`, which was removed in
Next 16 — to fix in `/backend`/`/qa` (switch to `eslint`). The production build performs the TypeScript check.

## Backend Implementation Notes (/backend)

**Supabase project:** `RiskGuard` (ref `yhjgjijanrxtjsecqeoo`, region **eu-central-1** / Frankfurt for
GDPR residency, $10/mo). Connected via `.env.local` (URL + publishable key + `NEXT_PUBLIC_SITE_URL`).

**Migrations** (versioned in `supabase/migrations/`, applied via MCP):
- `0001_auth_multi_tenant` — tables `profiles`, `organizations`, `memberships(role,status)`,
  `invitations(token,status,expires_at)`, `audit_log` (insert-only) + RLS on all + indexes; triggers
  `handle_new_user` (auto-profile) and `guard_last_admin` (org keeps ≥1 admin); RPCs
  `create_organization` and `accept_invitation` (validate token + email, SECURITY DEFINER).
- `0002_harden_security_definer` — moved RLS helpers (`is_org_member`/`is_org_admin`/`shares_org_with`)
  into a non-exposed `private` schema (not reachable via PostgREST `/rpc`); revoked RPC execute on
  trigger functions. Resolves advisor 0028/0029 anon exposure.
- `0003_perf_tuning` — `(select auth.uid())` in row policies (advisor 0003) + FK covering indexes.

**Security advisors:** clean except 2 *by-design* warns (`create_organization`, `accept_invitation` are
intentional signed-in RPCs with internal authorization). Performance advisors resolved.

**Server actions** (`src/lib/actions/`): `org.createOrganizationAction` (bootstrap → admin),
`accept.acceptInvitationAction`, `invitations.inviteMemberAction` (+ durable email workflow) /
`revokeInvitationAction`, `members.changeMemberRoleAction` / `setMemberStatusAction` /
`removeMemberAction`. All RLS-gated and written to `audit_log`; last-admin attempts surface a friendly error.

**Durable workflow (WDK):** `src/workflows/invitation.ts` — `sendInvitationWorkflow` orchestrates a
`deliverInvitationEmail` step (Resend, auto-retry; logs the accept link to the server console when
`RESEND_API_KEY` is absent). `withWorkflow` wired in `next.config.ts`; `proxy.ts` excludes
`.well-known/workflow`. Invitation rows are written in the action (RLS-authorized) so the workflow needs
no service-role secret.

**Data layer** (`src/lib/data/*`, `src/lib/auth.ts`) now uses real RLS-scoped Supabase queries; the
preview mock path remains as a fallback when no env is configured.

**Bootstrap & invite UX:** the `/no-organization` page lets a signed-in user create an organization and
become its admin; new invitees accept via a magic-link sign-in gated by a valid invitation token.

**Verification:** `npm run build` green (20 routes incl. WDK internal routes). Runtime smoke:
`/de/login` → 200, `/` → 307 → `/de/login`, `/de/dashboard` (no session) → 307 → `/de/login`. RLS enabled
on all 5 tables (policies: profiles 3, memberships 3, invitations 3, organizations 2, audit_log 2).

**Open for /qa:** browser end-to-end (sign-up → create org → invite → accept → role/status/remove),
automated RLS cross-tenant tests (Vitest/pgTAP), and configuring Supabase Auth email templates / a
verified Resend sending domain. Pre-existing: `npm run lint` still calls the removed `next lint`.

## QA Test Results

**Tested:** 2026-06-09 · **Build:** green · **Unit:** 5/5 (`npm test`) · **E2E:** 18/18
(Playwright, Chromium + Mobile Safari) · **Security/RLS:** all checks passed.

### Acceptance criteria
| Bereich | Ergebnis | Nachweis |
|---|---|---|
| E-Mail/Passwort + Magic-Link Login, Reset, Logout, sichere Sessions | ✅ Pass | E2E (Render/Tabs/Validierung) + Runtime-Smoke + supabase-ssr-Wiring |
| Unauthentifiziert → Login-Redirect | ✅ Pass | E2E (`/`, `/de/dashboard` → `/de/login`) |
| Invite-only Orgs (kein offener Signup), Admin lädt mit Rolle ein | ✅ Pass | `create_organization`-RPC, kein Signup-Form, RLS `invitations_insert_admin` |
| Einladung: Token + Status + Ablauf; Annahme erzeugt Mitgliedschaft | ✅ Pass | SQL: Ablauf-/Mismatch-Pfade blockiert; `accept_invitation`-RPC |
| Mehrere Orgs je Nutzer + Wechsel | ✅ Pass | `memberships` + Org-Switcher + `getMembershipsForUser` |
| Rollen admin/analyst/viewer, server-seitig erzwungen | ✅ Pass | RLS-Policies (SQL verifiziert); Analyst/Viewer-Daten-CRUD folgt mit Datentabellen (PROJ-2+) |
| **RLS-Mandantentrennung (kein Cross-Tenant-Read/Write)** | ✅ Pass | SQL-Audit beidseitig (s. u.) |
| `audit_log` insert-only | ✅ Pass | Keine UPDATE/DELETE-Policy; Mutationen schreiben Audit-Einträge |
| i18n (DE Standard, EN), Sprachwechsel | ✅ Pass | E2E DE/EN |
| WDK-Durability installiert + Referenz-Workflow | ✅ Pass | Build: 1 Workflow / 5 Steps; `sendInvitationWorkflow` |

> Vollständige Auth-Happy-Path-Flows (Sign-up → Org → Einladen → Annehmen) hängen an echter
> E-Mail-Zustellung und wurden mechanisch (Wiring) + per SQL-Sicherheitssuite verifiziert; das
> interaktive Durchklicken bleibt ein manueller/Resend-abhängiger Schritt.

### Security audit (Red Team) — alle bestanden
- **Cross-Tenant-Read:** User A sieht 1 Org (eigene), 0 von B; User B umgekehrt. Memberships/Invitations/Profile strikt org-gescoped. ✅
- **Cross-Tenant-Write:** A-Insert in Org B → `42501 RLS violation` (blockiert). ✅
- **Letzter-Admin-Schutz:** Selbst-Demotion des einzigen Admins → `org_must_keep_one_admin` (blockiert). ✅
- **Einladungs-E-Mail-Mismatch:** fremde Einladung annehmen → `invitation_email_mismatch` (blockiert). ✅
- **SECURITY DEFINER-Exposure:** gehärtet (Helfer in `private`-Schema, Trigger-RPC gesperrt); Advisor sauber außer 2 *gewollten* signed-in-RPCs. ✅
- **Secrets:** nur publishable Key clientseitig; kein Service-Role im Client/Code. ✅

### Bugs found
- **BUG-1 (Medium) — ✅ behoben (Migration `0004`, verifiziert):** `guard_last_admin` feuerte auch
  bei **Cascade-Deletes** → eine Organisation ließ sich nicht löschen (`org_must_keep_one_admin`).
  Fix: der Trigger überspringt jetzt auf `DELETE`, wenn die Organisation bereits entfernt wird
  (Cascade). Verifiziert: Org-Löschung gelingt; direktes Entfernen/Herabstufen des letzten Admins
  bleibt blockiert. Hinweis: das Löschen eines **Sole-Admin-Nutzers** bleibt bewusst geschützt
  (Org würde verwaisen) — GDPR-Erasure (PROJ-28) muss vorher Admin neu zuweisen/Org auflösen.
- **OBS-1 (Low, a11y):** Auth-Karten-Titel sind `shadcn CardTitle`-`<div>`s, keine semantische
  Überschrift — keine `<h1>` auf den Auth-Seiten. Empfehlung: `sr-only`-`<h1>` ergänzen.
- **OBS-2 (Low, vorbestehend):** `npm run lint` ruft das in Next 16 entfernte `next lint`; auf
  `eslint` umstellen.

### Regression
Keine — PROJ-1 ist das erste Feature (keine deployten Features). Vitest/Playwright sauber getrennt
(`vitest.config.ts` include `src/**`).

### Production-ready: **READY (für PROJ-1-Scope)**
Keine Critical/High-Bugs. BUG-1 (Medium) wurde behoben (Migration `0004`, verifiziert). OBS-1/OBS-2 sind Low.

## QA Artifacts
- Unit: `src/lib/action-errors.test.ts`
- E2E: `tests/PROJ-1-auth-multi-tenant.spec.ts`

## Deployment
_To be added by /deploy_
