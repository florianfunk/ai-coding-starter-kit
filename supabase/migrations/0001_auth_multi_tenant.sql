-- PROJ-1 — Auth & Multi-Tenant Foundation
-- Schema + RLS + helper functions + triggers for RiskGuard.
-- Tenancy model: organizations + memberships(role, status); invite-only joins.

-- ============================================================
-- Tables
-- ============================================================

-- Mirror of auth.users with app profile data (auto-created on signup).
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  locale      text not null default 'de',
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.organizations enable row level security;

create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'viewer' check (role in ('admin','analyst','viewer')),
  status      text not null default 'active'  check (status in ('active','deactivated')),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);
alter table public.memberships enable row level security;
create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_org  on public.memberships(org_id);

create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null check (position('@' in email) > 1),
  role        text not null default 'viewer' check (role in ('admin','analyst','viewer')),
  token       text not null unique,
  status      text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);
alter table public.invitations enable row level security;
create index if not exists idx_invitations_org on public.invitations(org_id);
-- At most one pending invite per email per org.
create unique index if not exists uq_invitations_pending_email
  on public.invitations(org_id, lower(email)) where status = 'pending';

-- Append-only audit trail (foundation; expanded by PROJ-12).
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete cascade,
  actor       uuid references auth.users(id) on delete set null,
  action      text not null,
  target      text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index if not exists idx_audit_org on public.audit_log(org_id, created_at desc);

-- ============================================================
-- Helper functions (SECURITY DEFINER → avoid RLS recursion)
-- ============================================================
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid()
      and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.shares_org_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships m1
    join public.memberships m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m1.status = 'active'
      and m2.user_id = p_user
  );
$$;

-- ============================================================
-- RLS policies
-- ============================================================
-- profiles: self or co-worker may read; only self may write.
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.shares_org_with(id));
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members read; admins update. No direct INSERT (use create_organization()).
create policy "orgs_select_member" on public.organizations
  for select using (public.is_org_member(id));
create policy "orgs_update_admin" on public.organizations
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- memberships: members read; admins update. No direct INSERT (use functions). Admin or self may delete.
create policy "memberships_select_member" on public.memberships
  for select using (public.is_org_member(org_id));
create policy "memberships_update_admin" on public.memberships
  for update using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "memberships_delete_admin_or_self" on public.memberships
  for delete using (public.is_org_admin(org_id) or user_id = auth.uid());

-- invitations: admin-managed.
create policy "invitations_select_admin" on public.invitations
  for select using (public.is_org_admin(org_id));
create policy "invitations_insert_admin" on public.invitations
  for insert with check (public.is_org_admin(org_id));
create policy "invitations_update_admin" on public.invitations
  for update using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- audit_log: admins read; members insert; never update/delete (insert-only).
create policy "audit_select_admin" on public.audit_log
  for select using (public.is_org_admin(org_id));
create policy "audit_insert_member" on public.audit_log
  for insert with check (public.is_org_member(org_id));

-- ============================================================
-- Triggers & RPC functions
-- ============================================================
-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent an organization from losing its last active admin.
create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := old.org_id;
  v_admins int;
begin
  select count(*) into v_admins from public.memberships
  where org_id = v_org and role = 'admin' and status = 'active' and id <> old.id;
  if tg_op = 'UPDATE' and new.role = 'admin' and new.status = 'active' then
    v_admins := v_admins + 1;
  end if;
  if v_admins = 0 then
    raise exception 'org_must_keep_one_admin' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists trg_guard_last_admin on public.memberships;
create trigger trg_guard_last_admin
  before update or delete on public.memberships
  for each row execute function public.guard_last_admin();

-- Bootstrap: a signed-in user creates an organization and becomes its admin.
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.organizations (name, created_by)
    values (p_name, auth.uid()) returning id into v_org;
  insert into public.memberships (org_id, user_id, role, status)
    values (v_org, auth.uid(), 'admin', 'active');
  insert into public.audit_log (org_id, actor, action, target, metadata)
    values (v_org, auth.uid(), 'organization.create', v_org::text,
            jsonb_build_object('name', p_name));
  return v_org;
end;
$$;

-- Accept an invitation: validates token + email, creates membership, marks accepted.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv public.invitations; v_email text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select * into v_inv from public.invitations where token = p_token;
  if v_inv.id is null then raise exception 'invitation_not_found'; end if;
  if v_inv.status <> 'pending' then raise exception 'invitation_not_pending'; end if;
  if v_inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation_expired';
  end if;
  if lower(v_inv.email) <> lower(v_email) then raise exception 'invitation_email_mismatch'; end if;

  insert into public.memberships (org_id, user_id, role, status)
    values (v_inv.org_id, auth.uid(), v_inv.role, 'active')
    on conflict (org_id, user_id) do update set status = 'active';
  update public.invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
  insert into public.audit_log (org_id, actor, action, target, metadata)
    values (v_inv.org_id, auth.uid(), 'invitation.accept', v_inv.id::text,
            jsonb_build_object('email', v_inv.email, 'role', v_inv.role));
  return v_inv.org_id;
end;
$$;

-- Lock down RPC execution to authenticated users.
revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.accept_invitation(text)   from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.accept_invitation(text)   to authenticated;
