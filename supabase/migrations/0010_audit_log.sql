-- Audit-Log: Append-only table for change tracking
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_email text,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('create', 'update', 'delete')),
  changes jsonb,
  record_label text
);

create index on public.audit_log (created_at desc);
create index on public.audit_log (table_name, record_id);

alter table public.audit_log enable row level security;
create policy "auth_select" on public.audit_log for select to authenticated using (true);
create policy "auth_insert" on public.audit_log for insert to authenticated with check (true);
