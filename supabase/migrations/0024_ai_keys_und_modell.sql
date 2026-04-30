-- ============================================================================
-- AI-Einstellungen erweitern: API-Keys + Provider + Modell für Teaser-Texte
-- ============================================================================
-- Erweitert die bestehende Singleton-Tabelle ai_einstellungen (id=1) um
-- Felder für die KI-gestützte Marketing-Teaser-Generierung (PROJ-39).
-- Wie der Replicate-Token werden auch diese Keys bewusst in der DB gehalten,
-- damit Admins sie ohne Deploy in den Einstellungen ändern können.

alter table public.ai_einstellungen
  add column if not exists openai_api_key text,
  add column if not exists anthropic_api_key text,
  add column if not exists ai_provider text not null default 'openai',
  add column if not exists ai_model text not null default 'gpt-4o-mini';

-- Provider auf bekannte Werte beschränken
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_einstellungen_provider_check'
  ) then
    alter table public.ai_einstellungen
      add constraint ai_einstellungen_provider_check
      check (ai_provider in ('openai', 'anthropic'));
  end if;
end $$;
