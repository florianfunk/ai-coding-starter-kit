-- PROJ-13: App-Einstellungen (Adminbereich)
-- Genau ein Datensatz pro owner. AI-Key verschlüsselt im app-Layer.

create table app_einstellung (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  ai_key_cipher text,                       -- app-seitig verschlüsselt, NULL/'' = nicht gesetzt
  ai_model      text not null default 'anthropic/claude-haiku-4-5',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id)
);
create trigger trg_app_einstellung_updated before update on app_einstellung
  for each row execute function set_updated_at();

alter table app_einstellung enable row level security;
create policy app_einstellung_owner on app_einstellung
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
