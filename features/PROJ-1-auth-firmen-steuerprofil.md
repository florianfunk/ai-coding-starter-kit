# PROJ-1: Auth & Firmen-/Steuerprofil-Stammdaten

## Status: In Progress
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- None

## Beschreibung
Single-User-Login und zentrale Stammdaten der eigenen Firma. Fundament für alle weiteren Features — definiert das Steuerprofil (Rechtsform, USt-Pflicht, Wirtschaftsjahr), das Klassifizierung und Steuerberechnungen steuert.

## User Stories
- Als Inhaber möchte ich mich sicher einloggen, damit niemand sonst Zugriff auf meine Steuerdaten hat.
- Als Inhaber möchte ich meine Firmenstammdaten (Name, Steuernummer, USt-IdNr., Adresse) hinterlegen, damit sie in Auswertungen und Exporten erscheinen.
- Als Inhaber möchte ich mein Steuerprofil festlegen (Einzelunternehmer/Freiberufler, USt-pflichtig Regelbesteuerung, Wirtschaftsjahr, USt-Voranmeldungsrhythmus), damit der Agent korrekt rechnet.
- Als Inhaber möchte ich meine USt-Voranmeldungsperiode (monatlich/quartalsweise) setzen, damit USt-VA-Zeiträume korrekt gebildet werden.
- Als Inhaber möchte ich mein Profil später ändern können, damit Anpassungen (z.B. Wechsel des Rhythmus) möglich sind.

## Acceptance Criteria
- [ ] Login mit E-Mail/Passwort über Supabase Auth; ausschließlich ein autorisierter Account (Single-Tenant)
- [ ] Ohne gültige Session ist keine geschützte Seite/API erreichbar (Redirect zum Login)
- [ ] Firmenstammdaten erfassbar/editierbar: Firmenname, Inhaber, Steuernummer, USt-IdNr., Anschrift, Finanzamt
- [ ] Steuerprofil erfassbar: Rechtsform (Einzelunternehmer/Freiberufler), USt-Status (Regelbesteuerung), Wirtschaftsjahr (Beginn/Ende), USt-VA-Rhythmus (monatlich/quartalsweise/jährlich)
- [ ] Pflichtfelder werden validiert (Steuernummer-Format, USt-IdNr.-Format); Fehler werden klar angezeigt
- [ ] Stammdaten werden persistiert und stehen anderen Features als Single Source of Truth zur Verfügung
- [ ] Sensible Felder werden DSGVO-konform in EU-Region gespeichert

## Edge Cases
- Was passiert bei mehrfachen fehlgeschlagenen Login-Versuchen? (Rate-Limiting/Sperre)
- Was passiert, wenn das Steuerprofil noch nicht ausgefüllt ist und andere Features darauf zugreifen? (Hinweis/Block bis vollständig)
- Wie wird ein Wechsel des USt-VA-Rhythmus mitten im Jahr behandelt? (Gültig-ab-Datum)
- Was passiert bei ungültigem Steuernummer-/USt-IdNr.-Format?
- Wie wird verhindert, dass ein zweiter Account angelegt wird (Single-Tenant-Garantie)?

## Technical Requirements
- Security: Authentifizierung Pflicht, Session-Schutz auf allen geschützten Routen/APIs
- Datenschutz: Supabase EU-Region, sensible Stammdaten geschützt gespeichert
- Single-Tenant: genau ein Nutzer-Account

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (Supabase)
Login + persistente Stammdaten erfordern Datenbank und Auth. localStorage scheidet aus (Steuerdaten, geräteübergreifend, sensibel).

### Komponentenstruktur
```
Login-Seite (/login)
+-- E-Mail/Passwort-Formular (shadcn form + input + button)
+-- Fehler-/Sperrhinweis (shadcn alert)

Einstellungen › Firma (/einstellungen/firma)  [auth-geschützt]
+-- Stammdaten-Formular (Firmenname, Inhaber, Steuernummer, USt-IdNr., Anschrift, Finanzamt)
+-- Steuerprofil-Formular (Rechtsform, USt-Status, Wirtschaftsjahr, USt-VA-Rhythmus)
+-- Speichern-Aktion + Erfolg-/Validierungs-Feedback (toast/alert)
```

### Datenmodell (Klartext)
Ein **Firmenprofil**-Datensatz (genau einer): Firmenstammdaten + Steuerprofil-Felder + Gültig-ab-Datum für Rhythmuswechsel. Speicherort: Supabase (EU). Zugriff nur mit Session; RLS bindet den Satz an den einen erlaubten Account.

### Tech-Entscheidungen (Begründung)
- **Supabase Auth, E-Mail/Passwort, Single-Account-Allow-List:** verhindert Fremdregistrierung; einfachstes sicheres Modell für einen Nutzer.
- **Server-seitige Auth-Guards (@supabase/ssr):** geschützte Routen/APIs sind ohne Session nicht erreichbar.
- **Zod + react-hook-form:** Format-Validierung Steuernummer/USt-IdNr. bereits client- und serverseitig möglich (vorhanden).
- **Profil als Single Source of Truth:** alle Steuermodule lesen Rhythmus/Wirtschaftsjahr von hier.

### Abhängigkeiten (Pakete)
- `@supabase/ssr` — sichere Session-/Server-Anbindung.

### Edge-Case-Behandlung
Login-Rate-Limit via Supabase Auth; unvollständiges Profil blockiert abhängige Module mit Hinweis; Rhythmuswechsel über „gültig ab"; Single-Tenant-Garantie über Allow-List + RLS.

## Implementierungsnotizen

> Stand: Firmen-/Steuerprofil-Verwaltung implementiert. Auth (Login/Middleware/Guard/Signout) war bereits vorhanden und wurde nur genutzt, nicht verändert.

### Erstellte Dateien
- `src/lib/validation/firma.ts` — gemeinsames Zod-Schema (client + server), inkl. `FirmenprofilFormValues` und `FIRMENPROFIL_DEFAULTS`. Format-Validierung für Steuernummer, USt-IdNr. (mit Normalisierung), PLZ und `rhythmus_gueltig_ab`.
- `src/lib/validation/firma.test.ts` — Vitest-Unit-Tests (30 Tests, alle grün): Pflichtfelder, Steuernummer gültig/ungültig, USt-IdNr.-Format + Normalisierung, PLZ, Wirtschaftsjahr-Beginn 1–12, optionales Gültig-ab-Datum.
- `src/app/api/firma/route.ts` — `GET` (Profil laden) + `PUT` (Upsert auf `unique(owner_id)`). Auth via `getApiUser()` → 401 ohne Session; serverseitige Zod-Validierung → 422 bei Fehlern; Fehler als JSON `{error}` mit sinnvollen HTTP-Codes (400/401/422/500).
- `src/components/firma/firma-form.tsx` — Client-Formular (`"use client"`), react-hook-form + `zodResolver`, shadcn/ui (Card, Form, Input, Select, Button, Alert) + `sonner`-Toasts. Lade-/Submit-Status, Fehleranzeige (Alert + Toast), Leerzustand-Hinweis bei fehlendem Profil, responsive Grid.
- `src/app/(app)/einstellungen/firma/page.tsx` — Server Component: `requireUser()` + serverseitiges Laden des Profils (RLS-geschützt), rendert Client-Formular; leeres Formular wenn kein Profil existiert.

### Abweichungen / Entscheidungen
- **Single-Source-Select für `wirtschaftsjahr_beginn`:** Monatsauswahl als Dropdown (1–12) statt Freitext, da DB-Constraint `between 1 and 12`. Wert wird als Number gespeichert.
- **`zodResolver`-Typ-Cast:** Wegen Zod-4-`transform`-Feldern (String→undefined) divergieren Input-/Output-Typen des Schemas. Der Resolver wird mit einem lokalisierten `as any`-Cast eingebunden (RHF arbeitet auf den String-Form-Values, Server validiert/transformiert erneut). `tsc --noEmit` ist projektweit fehlerfrei.
- **USt-IdNr.-Normalisierung:** Whitespace entfernt + Uppercase vor Regex-Prüfung; normalisierter Wert wird gespeichert.
- **Steuernummer-Regex** bewusst tolerant (10–13 Ziffern, optionale Trenner `/ . -`), da bundeslandabhängige Formate existieren; bei Eingabe wird Plausibilität geprüft, Feld bleibt optional.
- Migration `0001_init_steueragent.sql` und `src/lib/types.ts` unverändert (wie vorgegeben).

### Verifikation
- `npx tsc --noEmit`: keine Fehler (projektweit).
- `npx vitest run src/lib/validation/firma.test.ts`: 30/30 Tests grün.
- Hinweis: `npm run lint` (`next lint`) ist im Projekt vorab fehlkonfiguriert (deprecated CLI) — unabhängig von dieser Änderung.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
