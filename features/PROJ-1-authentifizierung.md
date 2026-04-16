# PROJ-1: Authentifizierung & Nutzerverwaltung

## Status: Architected
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- None (Fundament)

## User Stories
- Als interner Mitarbeiter möchte ich mich mit E-Mail und Passwort einloggen, damit nur autorisierte Personen Produktdaten sehen und ändern können.
- Als Nutzer möchte ich eingeloggt bleiben, damit ich nicht bei jedem Browserstart neu anmelden muss.
- Als Nutzer möchte ich mich ausloggen können, wenn ich an einem geteilten Gerät arbeite.
- Als Nutzer möchte ich mein Passwort zurücksetzen können, falls ich es vergesse.
- Als Administrator (technisch) möchte ich neue Nutzer per Supabase-Dashboard anlegen können, ohne eine eigene Admin-UI bauen zu müssen.

## Acceptance Criteria
- [ ] Login-Seite unter `/login` mit E-Mail + Passwort-Feld
- [ ] Falsche Credentials zeigen verständliche Fehlermeldung, verraten aber nicht, ob E-Mail existiert
- [ ] Erfolgreicher Login leitet auf die Startseite (`/`) weiter
- [ ] Nicht-eingeloggte Nutzer werden bei Aufruf geschützter Seiten auf `/login` umgeleitet
- [ ] Eine „Passwort zurücksetzen"-Funktion per E-Mail-Link ist verfügbar
- [ ] Logout-Button im Haupt-Navigationsbereich
- [ ] Session bleibt über Browser-Neustarts erhalten (Persistent Session)
- [ ] Es gibt genau eine Rolle („Mitarbeiter"); alle 3 Nutzer haben identische Rechte

## Edge Cases
- Was passiert bei 5+ fehlgeschlagenen Login-Versuchen? → Supabase-Standard-Ratelimit
- Was passiert, wenn die Session während des Bearbeitens abläuft? → Zurück auf `/login` mit Hinweis, sodass keine Daten verloren gehen können (Formular-State sichern nicht erforderlich im MVP)
- Was passiert beim Passwort-Reset-Link nach Ablauf? → Fehlermeldung + erneut anfordern
- Was passiert bei gleichzeitigem Login derselben E-Mail in zwei Browsern? → Beide Sessions erlaubt
- Was passiert bei deaktivierten/gelöschten Nutzern? → Automatischer Logout bei nächstem Request

## Technical Requirements
- Supabase Auth (E-Mail/Passwort-Provider)
- Login-Seite < 1 s Antwortzeit
- Passwörter nie im Klartext loggen
- Geschützte Routen per Middleware/Server-Component-Check
- HTTPS-only (über Vercel)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
/login (public route)
+-- LoginForm
|   +-- Email input
|   +-- Password input
|   +-- "Anmelden"-Button
|   +-- "Passwort vergessen?"-Link
|   +-- Error-Banner
/reset-password/request
+-- RequestResetForm (E-Mail eingeben)
/reset-password/confirm?token=...
+-- NewPasswordForm
/ (geschützt, alles andere)
+-- AppShell
    +-- TopBar mit User-Menü (Name, Logout)
    +-- Navigations-Bereich
    +-- Content-Outlet
```

### Data Model
Wir nutzen **Supabase Auth**, das bringt alles mit:
- `auth.users` (intern von Supabase verwaltet) — E-Mail, Passwort-Hash, Session
- Wir legen keine eigene `users`-Tabelle an, solange nur eine Rolle existiert. Sollte später Differenzierung nötig sein, wird eine `profiles`-Tabelle mit FK auf `auth.users.id` ergänzt.
- Die 3 Nutzer werden manuell im Supabase-Dashboard angelegt — keine Self-Signup-Seite.

### Tech-Entscheidungen
- **Supabase Auth mit E-Mail/Passwort**: kostenlos, ausgereift, integriert sich nahtlos mit der DB (RLS in allen Folge-Features nutzt `auth.uid()`).
- **Server-Components + Middleware für Route-Schutz**: geschützte Routen prüfen die Session serverseitig. Schneller und sicherer als Client-only-Redirects.
- **Kein Self-Signup im MVP**: 3 feste Nutzer, per Dashboard vom Admin angelegt — verhindert unbeabsichtigte Registrierungen.
- **Passwort-Reset per Supabase Magic Link (Mail)**: kein eigener Mail-Versand nötig, nutzt Supabase-eigene Vorlagen.
- **Session in sicheren HTTP-only Cookies** (Default des Supabase-SSR-Pakets).

### Abhängigkeiten (Pakete)
- `@supabase/supabase-js` — Supabase-Client
- `@supabase/ssr` — Server-Side-Rendering-Integration für Next.js
- `react-hook-form` + `zod` — Formulare & Validierung (bereits im Stack)

### Warum das sicher ist
- Passwörter werden nie im App-Code berührt, Supabase hasht sie.
- Middleware prüft jede geschützte Route serverseitig, nicht erst im Browser.
- Rate-Limiting kommt out-of-the-box von Supabase.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
