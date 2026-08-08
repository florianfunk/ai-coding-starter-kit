# STEUERAGENT — Setup

## Supabase-Projekt

- **Name:** Steueragent
- **Projekt-Ref:** `xhrjtkcnbmknaribuhyo`
- **Region:** eu-central-1 (Frankfurt) — DSGVO-konform
- **Dashboard:** https://supabase.com/dashboard/project/xhrjtkcnbmknaribuhyo

## Schema

Die versionierten Migrationen liegen unter `supabase/migrations`. Alle
mandantenbezogenen Tabellen verwenden Row Level Security; Server-Role-Zugriffe
werden zusätzlich im Anwendungscode explizit auf `owner_id` begrenzt.

## Lokale Entwicklung

1. `.env.local` mit echten Werten (siehe `.env.local.example` als Vorlage):
   - `NEXT_PUBLIC_SUPABASE_URL` — Projekt-URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/publishable Key
   - `STEUERAGENT_ALLOWED_EMAIL` — einzige erlaubte Login-E-Mail (Single-Tenant)
   - `STEUERAGENT_ENCRYPTION_KEY` — 32+ Zeichen Zufallswert (Paperless-Token-Verschlüsselung)
   - `AI_GATEWAY_API_KEY` + `STEUERAGENT_LLM_MODEL` — für KI-Klassifizierung (PROJ-5)
   - `SUPABASE_SERVICE_ROLE_KEY` — nur serverseitig für Cron/Wartung
2. `npm run dev` → http://localhost:3000

## Auth-User

Single-Tenant: genau ein Account. Der User wird in Supabase Auth angelegt;
seine E-Mail muss exakt `STEUERAGENT_ALLOWED_EMAIL` entsprechen, sonst
verweigert der Guard den Zugriff (Redirect auf /login?error=not-allowed).

## KI-Klassifizierung (PROJ-5)

`AI_GATEWAY_API_KEY` aus Vercel AI Gateway. Ohne gültigen Key fällt die
Klassifizierungs-Pipeline auf reine Regel-Engine zurück (kein Datenverlust,
unsichere Fälle landen in der Prüfliste mit pruef_grund 'ki_nicht_verfuegbar').

### Key später nachtragen
1. https://vercel.com/dashboard → AI Gateway → API Keys → Create Key (Format `vck_...`)
2. In `.env.local` die Zeile `AI_GATEWAY_API_KEY=` mit dem echten Key ersetzen
3. Dev-Server neu starten (`npm run dev`)

## Produktionsstatus (2026-08-08)

- Anwendung: `https://steueragent.vercel.app`
- Supabase-Projekt live, Schema, RLS und Data-API-Grants verifiziert
  (EU/Frankfurt)
- ESt-Tarife einschließlich 2026 in `est_tarif` vorhanden
- Paperless-Verbindung und vollständiger Bestands-Sync live geprüft
- Vercel-Cron für PROJ-32 erreichbar und durch `CRON_SECRET` geschützt
- Qualitätsstand: 987 Vitest-Tests, 8 Playwright-Smoke-Tests, Lint, Build und
  Dependency-Audit grün
- Fristen-Mail bleibt ohne `RESEND_API_KEY` und ohne ausdrücklichen Profil-
  Opt-in bewusst inaktiv

## Externe Voraussetzung: Paperless-ngx

Erreichbare Paperless-ngx-Instanz mit API-Token. Wird in der App unter
Einstellungen › Paperless hinterlegt (Token verschlüsselt at rest).
