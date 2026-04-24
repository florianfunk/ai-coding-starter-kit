-- ============================================================================
-- AI-Einstellungen (Singleton) — Replicate-Token für Bild-Upscale & BG-Remove
-- ============================================================================
-- Einziger Singleton-Row (id = 1). Token bewusst in der DB (nicht als env var),
-- damit er ohne Deploy in den Einstellungen geändert werden kann. Zugriff nur
-- für authentifizierte Nutzer (wie alle anderen Einstellungen auch).

create table public.ai_einstellungen (
  id               integer primary key default 1 check (id = 1),
  replicate_token  text,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id)
);

create trigger ai_einstellungen_set_updated
  before update on public.ai_einstellungen
  for each row execute function public.set_updated_at();

insert into public.ai_einstellungen (id) values (1) on conflict do nothing;

alter table public.ai_einstellungen enable row level security;

drop policy if exists "auth_select" on public.ai_einstellungen;
drop policy if exists "auth_insert" on public.ai_einstellungen;
drop policy if exists "auth_update" on public.ai_einstellungen;
drop policy if exists "auth_delete" on public.ai_einstellungen;

create policy "auth_select" on public.ai_einstellungen
  for select to authenticated using (true);
create policy "auth_insert" on public.ai_einstellungen
  for insert to authenticated with check (true);
create policy "auth_update" on public.ai_einstellungen
  for update to authenticated using (true) with check (true);
create policy "auth_delete" on public.ai_einstellungen
  for delete to authenticated using (true);
