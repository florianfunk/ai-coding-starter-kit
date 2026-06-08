-- PROJ-1 — Security hardening (Supabase advisor 0028/0029)
-- Move RLS helper functions into a non-exposed `private` schema (not reachable
-- via PostgREST /rpc) and revoke RPC execution on trigger functions.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid() and status = 'active');
$$;
create or replace function private.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid() and role = 'admin' and status = 'active');
$$;
create or replace function private.shares_org_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships m1
    join public.memberships m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m1.status = 'active' and m2.user_id = p_user);
$$;
grant execute on function private.is_org_member(uuid)  to authenticated;
grant execute on function private.is_org_admin(uuid)   to authenticated;
grant execute on function private.shares_org_with(uuid) to authenticated;

-- Drop policies that reference the public helpers, then drop the helpers.
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "orgs_select_member" on public.organizations;
drop policy if exists "orgs_update_admin" on public.organizations;
drop policy if exists "memberships_select_member" on public.memberships;
drop policy if exists "memberships_update_admin" on public.memberships;
drop policy if exists "memberships_delete_admin_or_self" on public.memberships;
drop policy if exists "invitations_select_admin" on public.invitations;
drop policy if exists "invitations_insert_admin" on public.invitations;
drop policy if exists "invitations_update_admin" on public.invitations;
drop policy if exists "audit_select_admin" on public.audit_log;
drop policy if exists "audit_insert_member" on public.audit_log;

drop function if exists public.is_org_member(uuid);
drop function if exists public.is_org_admin(uuid);
drop function if exists public.shares_org_with(uuid);

-- Recreate policies against private.* helpers.
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or private.shares_org_with(id));
create policy "orgs_select_member" on public.organizations
  for select using (private.is_org_member(id));
create policy "orgs_update_admin" on public.organizations
  for update using (private.is_org_admin(id)) with check (private.is_org_admin(id));
create policy "memberships_select_member" on public.memberships
  for select using (private.is_org_member(org_id));
create policy "memberships_update_admin" on public.memberships
  for update using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));
create policy "memberships_delete_admin_or_self" on public.memberships
  for delete using (private.is_org_admin(org_id) or user_id = auth.uid());
create policy "invitations_select_admin" on public.invitations
  for select using (private.is_org_admin(org_id));
create policy "invitations_insert_admin" on public.invitations
  for insert with check (private.is_org_admin(org_id));
create policy "invitations_update_admin" on public.invitations
  for update using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));
create policy "audit_select_admin" on public.audit_log
  for select using (private.is_org_admin(org_id));
create policy "audit_insert_member" on public.audit_log
  for insert with check (private.is_org_member(org_id));

-- Trigger functions must not be RPC-callable (they run via the trigger system).
revoke all on function public.handle_new_user()   from public, anon, authenticated;
revoke all on function public.guard_last_admin()   from public, anon, authenticated;
