# STEUERAGENT — Setup

## Supabase-Projekt

- **Name:** Steueragent
- **Projekt-Ref:** `xhrjtkcnbmknaribuhyo`
- **Region:** eu-central-1 (Frankfurt) — DSGVO-konform
- **Dashboard:** https://supabase.com/dashboard/project/xhrjtkcnbmknaribuhyo

## Schema

Migration `supabase/migrations/0001_init_steueragent.sql` — 12 Tabellen, RLS auf jeder
Tabelle (owner_id = auth.uid(), Single-Tenant). Eingespielt via Supabase-Integration.

## Lokale Entwicklung

1. `.env.local` mit echten Werten (siehe `.env.local.example` als Vorlage):
   - `NEXT_PUBLIC_SUPABASE_URL` — Projekt-URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/publishable Key
   - `STEUERAGENT_ALLOWED_EMAIL` — einzige erlaubte Login-E-Mail (Single-Tenant)
   - `STEUERAGENT_ENCRYPTION_KEY` — 32+ Zeichen Zufallswert (Paperless-Token-Verschlüsselung)
   - `AI_GATEWAY_API_KEY` + `STEUERAGENT_LLM_MODEL` — für KI-Klassifizierung (PROJ-5)
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

## Status (2026-05-19)

- Supabase-Projekt live, Schema + RLS verifiziert (EU/Frankfurt)
- Auth-User `soulschoki@googlemail.com` angelegt (E-Mail bestätigt)
- ESt-Tarife 2024/2025 in `est_tarif` geseedet
- Standard-Kontenrahmen (20 Kategorien) via App-API angelegt
- End-to-End-Smoketest grün (Login → App-Middleware → API → DB mit RLS)
- Branch `feat/steueragent-mvp` auf GitHub gepusht
- Offen: AI-Gateway-Key (App läuft ohne KI über Regel-Engine + Prüfliste)

## Externe Voraussetzung: Paperless-ngx

Erreichbare Paperless-ngx-Instanz mit API-Token. Wird in der App unter
Einstellungen › Paperless hinterlegt (Token verschlüsselt at rest).
