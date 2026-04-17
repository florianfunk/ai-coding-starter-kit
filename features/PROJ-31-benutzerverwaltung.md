# PROJ-31: Benutzerverwaltung

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-1 (Authentifizierung)

## User Stories
- Als Admin möchte ich neue Benutzer-Accounts anlegen können, damit neue Mitarbeiter Zugriff bekommen.
- Als Admin möchte ich bestehende Accounts deaktivieren können, wenn ein Mitarbeiter ausscheidet.
- Als Nutzer möchte ich mein eigenes Passwort ändern können.
- Als Admin möchte ich sehen, wann sich welcher Nutzer zuletzt eingeloggt hat.

## Acceptance Criteria
- [ ] Neue Route `/benutzer` (nur für angemeldete Nutzer, keine Rollen-Unterscheidung)
- [ ] Liste aller Supabase-Auth-User mit: Name, Email, Letzter Login, Status (aktiv/deaktiviert)
- [ ] "Neuer Benutzer"-Dialog: Email + Passwort + Name
- [ ] Account erstellen über Supabase Admin-API (Service Role Key, serverseitig)
- [ ] "Deaktivieren"-Button setzt User auf `banned: true` in Supabase Auth
- [ ] "Passwort zurücksetzen"-Button sendet Reset-Email
- [ ] Eigenes Profil: Name und Passwort ändern
- [ ] Maximal 10 Accounts (Business-Regel, kein technisches Limit)

## Edge Cases
- Letzter aktiver Account deaktivieren → Warnung "Mindestens ein Account muss aktiv bleiben"
- Einladungs-Email kann nicht zugestellt werden → Fehlermeldung
- Nutzer ändert eigene Email → nicht erlaubt (nur Admin kann das)
