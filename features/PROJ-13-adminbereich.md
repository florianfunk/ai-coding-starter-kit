# PROJ-13: Adminbereich (Systemkonfiguration & Benutzerverwaltung)

## Status: In Progress
**Created:** 2026-05-19
**Last Updated:** 2026-05-19

## Dependencies
- Requires: PROJ-1 (Auth & Steuerprofil) â geschÃ¼tzter Zugriff, Benutzerkontext
- Bezieht sich auf: PROJ-5 (KI-Klassifizierung) â AI-Gateway-Key wird hier konfiguriert

## Beschreibung
Zentraler Adminbereich (`/einstellungen/admin`), damit der Inhaber das System
selbst konfigurieren kann, ohne `.env.local`/SQL anfassen zu mÃ¼ssen: KI-Zugang
(AI-Gateway-Key verschlÃ¼sselt), eigene Benutzerverwaltung inkl. PasswortÃ¤nderung,
System-Status/Health-Ãbersicht und gefÃ¤hrliche Daten-Wartungsaktionen.

## User Stories
- Als Inhaber mÃ¶chte ich den AI-Gateway-Key + Modell in der App eintragen/Ã¤ndern, damit die KI-Klassifizierung ohne Server-Zugriff aktivierbar ist.
- Als Inhaber mÃ¶chte ich mein Passwort in der App Ã¤ndern (mit Eingabe des aktuellen Passworts), damit ich sicher selbst die Zugangsdaten verwalten kann.
- Als Inhaber mÃ¶chte ich meine E-Mail und letzte Anmeldung sehen, damit ich meinen Account im Blick habe.
- Als Inhaber mÃ¶chte ich einen System-Status sehen (Supabase, Paperless, KI, ESt-Tarife, letzte Jobs), damit ich erkenne was konfiguriert/funktionsfÃ¤hig ist.
- Als Inhaber mÃ¶chte ich Daten gezielt zurÃ¼cksetzen kÃ¶nnen (Buchungen/Belege/Klassifizierung, Kontenrahmen neu seeden), damit ich einen sauberen Neuanfang machen kann.

## Acceptance Criteria
- [ ] Admin-Seite `/einstellungen/admin` nur mit gÃ¼ltiger Session erreichbar; in Settings-Navigation verlinkt
- [ ] KI-Konfiguration: AI-Gateway-Key + Modell speichern; Key verschlÃ¼sselt at rest (`crypto.ts`), nie im Klartext an den Client, nur âgesetzt: ja/nein"
- [ ] KI-Key aus DB hat Vorrang vor `AI_GATEWAY_API_KEY`-Env; Klassifizierung nutzt den DB-Key, wenn vorhanden
- [ ] PasswortÃ¤nderung: aktuelles Passwort wird serverseitig per Re-Auth geprÃ¼ft, danach neues Passwort gesetzt (MindestlÃ¤nge validiert)
- [ ] Benutzerinfo: E-Mail + letzte Anmeldung werden angezeigt
- [ ] System-Status: Supabase erreichbar, Paperless konfiguriert (ja/nein), KI konfiguriert (ja/nein), ESt-Tarife vorhanden (Jahre), letzter Paperless-Sync / Kontoimport / Klassifizierungs-Job
- [ ] Daten-Wartung: âBuchungen+Klassifizierung zurÃ¼cksetzen", âBelege zurÃ¼cksetzen", âKontenrahmen neu seeden" â je mit expliziter BestÃ¤tigung (AlertDialog), owner-scoped
- [ ] Alle Admin-APIs: getApiUserâ401, Zod-Validierung, owner_id-Scoping zusÃ¤tzlich zur RLS

## Edge Cases
- Was passiert bei falschem aktuellem Passwort? (Re-Auth schlÃ¤gt fehl â klare Fehlermeldung, kein Wechsel)
- Was passiert, wenn weder DB-KI-Key noch Env-Key gesetzt ist? (KI-Status ânicht konfiguriert", Pipeline-Fallback greift wie in PROJ-5)
- Was passiert beim ZurÃ¼cksetzen, wenn abgeschlossene Steuerperioden existieren? (Warnung â Snapshots bleiben unberÃ¼hrt, nur Rohdaten betroffen)
- Wie wird verhindert, dass Daten-Wartung versehentlich ausgelÃ¶st wird? (Pflicht-BestÃ¤tigung mit Tippen/Checkbox)
- Was passiert mit dem KI-Key bei leerer Eingabe beim erneuten Speichern? (bestehender Key bleibt erhalten â wie Paperless-Token-Pattern)

## Technical Requirements
- Security: Secret verschlÃ¼sselt at rest, nie geloggt/an Client; PasswortÃ¤nderung mit Re-Auth
- Konsistenz: KI-Key-AuflÃ¶sung zentral (DB vor Env), eine Quelle der Wahrheit
- DatenintegritÃ¤t: Wartungsaktionen owner-scoped, abgeschlossene Snapshots unangetastet

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Single-Tenant. Wiederverwendung etablierter Patterns aus PROJ-3 (verschlÃ¼sselte
> Secrets via `crypto.ts`, Status statt Klartext) und PROJ-1 (Auth-Guard).

### Datenmodell
Neue Tabelle **app_einstellung** (genau ein Datensatz pro owner): `ai_key_cipher`
(verschlÃ¼sselt, leer = nicht gesetzt), `ai_model` (Klartext, unkritisch),
`updated_at`. RLS owner-gebunden wie alle anderen Tabellen.

### Komponentenstruktur
```
Einstellungen âº Admin (/einstellungen/admin)
+-- Tab "KI": AI-Gateway-Key (Status statt Klartext) + Modell, speichern
+-- Tab "Benutzer": E-Mail, letzte Anmeldung, Passwort Ã¤ndern (aktuell+neu)
+-- Tab "System": Status-Kacheln (Supabase/Paperless/KI/ESt-Tarife/letzte Jobs)
+-- Tab "Daten": Wartungsaktionen mit AlertDialog-BestÃ¤tigung
```

### API
- `GET/PUT /api/admin/ki` â AI-Key (verschlÃ¼sselt) + Modell
- `POST /api/admin/passwort` â Re-Auth (aktuelles PW) + neues PW
- `GET /api/admin/status` â aggregierter System-Status
- `POST /api/admin/wartung` â typisierte Reset-Aktion (Zod-Enum), owner-scoped

### KI-Key-AuflÃ¶sung
Zentrale Helper-Funktion `ladeAiKey()`: liest DB-Key (entschlÃ¼sselt), Fallback
auf `process.env.AI_GATEWAY_API_KEY`. `lib/classifier/llm.ts` nutzt diese statt
direktem Env-Zugriff.

### AbhÃ¤ngigkeiten (Pakete)
Keine neuen.

## Implementierungsnotizen

### Erstellte Dateien
- `src/lib/admin/ai-key.ts` â zentrale Helper-Funktion `ladeAiKey()` (DB-Key
  entschlÃ¼sselt mit Vorrang vor `AI_GATEWAY_API_KEY`-Env; Modell-AuflÃ¶sung
  inkl. Fallback `STEUERAGENT_LLM_MODEL` â `anthropic/claude-haiku-4-5`).
  Wirft niemals: ohne Session/DB sauberer Env-Fallback (Tests/Build).
- `src/lib/validation/admin.ts` â Zod-Schemas `aiEinstellungSchema`,
  `passwortAendernSchema`, `wartungSchema` (+ `WARTUNG_AKTIONEN`-Konstante).
- `src/lib/validation/admin.test.ts` â 12 Unit-Tests (alle 3 Schemas).
- `src/app/api/admin/ki/route.ts` â GET (ai_model + ai_key_gesetzt:boolean,
  nie Klartext), PUT (Upsert owner_id; encrypt() bei nicht-leerem Key, sonst
  bestehenden Cipher behalten â Paperless-Token-Pattern 1:1).
- `src/app/api/admin/passwort/route.ts` â POST: Re-Auth via
  `signInWithPassword` (403 âAktuelles Passwort falsch."), dann `updateUser`.
- `src/app/api/admin/status/route.ts` â GET: aggregierter owner-scoped Status
  (supabase_ok, paperless_konfiguriert, ki_konfiguriert + Quelle/Modell,
  est_tarife[], letzte_jobs je Art).
- `src/app/api/admin/wartung/route.ts` â POST {aktion}: buchungen_reset /
  belege_reset (CASCADE rÃ¤umt beleg_buchung automatisch) / kontenrahmen_reseed
  (nur LÃ¶schen + Hinweis, Seed-Logik NICHT dupliziert). Gibt {ok, betroffen}.
- `src/app/(app)/einstellungen/admin/page.tsx` â Server Component (requireUser),
  lÃ¤dt KI-Status + Benutzerinfo (E-Mail, last_sign_in_at).
- `src/components/admin/admin-tabs.tsx` â shadcn Tabs-Container (4 Tabs).
- `src/components/admin/ki-panel.tsx` â KI-Formular (react-hook-form + zod,
  Status statt Klartext, Hinweis vercel.com/dashboard â AI Gateway, vck_).
- `src/components/admin/benutzer-panel.tsx` â E-Mail/letzte Anmeldung
  read-only + Passwort-Ã¤ndern (client-seitige LÃ¤ngen-/WiederholungsprÃ¼fung).
- `src/components/admin/system-panel.tsx` â Status-Kacheln aus
  `/api/admin/status` mit Lade-/Fehler-/LeerzustÃ¤nden + Aktualisieren.
- `src/components/admin/daten-panel.tsx` â 3 Wartungs-Cards je mit
  AlertDialog-BestÃ¤tigung, Toast + router.refresh() nach Erfolg.

### GeÃ¤nderte Dateien
- `src/lib/classifier/llm.ts` â minimal-invasiv: statt direktem
  `process.env.AI_GATEWAY_API_KEY`/`STEUERAGENT_LLM_MODEL` jetzt
  `ladeAiKey()`; Modell via `createGateway({ apiKey }).(model)`. Bestehender
  `LlmKlassifiziererError` bei fehlendem Key bleibt erhalten. `modellName()`
  entfernt (durch zentrale AuflÃ¶sung ersetzt).
- `src/app/(app)/layout.tsx` â Nav-Link âAdmin" (`/einstellungen/admin`) im
  SETTINGS-Array ergÃ¤nzt.

### Abweichungen / Entscheidungen
- `kontenrahmen_reseed` lÃ¶scht nur `kategorie` (owner-scoped) und gibt einen
  Hinweis zurÃ¼ck, dass der Standard-Kontenrahmen unter
  âEinstellungen âº Kontenrahmen" neu zu seeden ist â Seed-Logik wird bewusst
  NICHT dupliziert (eine Quelle der Wahrheit).
- `beleg_buchung` wird bei buchungen_reset/belege_reset automatisch per
  ON DELETE CASCADE gerÃ¤umt (kein expliziter Delete nÃ¶tig).
- Steuerperioden/Snapshots werden von keiner Wartungsaktion angefasst.
- `ai`-Paket v6: `createGateway` aus `"ai"` (kein neues npm-Paket).

### Verifikation
- `npx tsc --noEmit`: 0 Fehler (gesamtes Projekt).
- `npx eslint` (alle PROJ-13-Pfade): 0 Fehler / 0 Warnungen.
- `npx vitest run`: 18 Test-Dateien, 319 Tests grÃ¼n (inkl. 12 neue
  admin-Tests; classifier-Tests unverÃ¤ndert grÃ¼n, da sie `llmFn` injizieren).

## QA Test Results

**Stand:** Approved (2026-05-19) — automatisierte QA + End-to-End-Test grün.

- tsc --noEmit: fehlerfrei · eslint: 0 Fehler · vitest: 319/319 grün · next build: 45 Routen grün
- E2E durch laufende App mit echter Session: Admin-Seite 200, status-API korrekt aggregiert, KI-Key speichern/laden ohne Klartext (DB-Verschlüsselung AES-GCM verifiziert), Passwort-Re-Auth lehnt falsches PW mit 403 ab, API ohne Session 401 JSON
- KI-Key-Vorrang DB vor Env in classifier/llm.ts verifiziert

## Deployment
_To be added by /deploy_
