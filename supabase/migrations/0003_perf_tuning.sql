-- PROJ-1 — Performance tuning (Supabase advisor 0001/0003)
-- 1) Wrap auth.uid() in (select auth.uid()) so it is evaluated once per query.
-- 2) Add covering indexes for foreign keys.

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = (select auth.uid()) or private.shares_org_with(id));

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = (select auth.uid()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "memberships_delete_admin_or_self" on public.memberships;
create policy "memberships_delete_admin_or_self" on public.memberships
  for delete using (private.is_org_admin(org_id) or user_id = (select auth.uid()));

create index if not exists idx_audit_actor on public.audit_log(actor);
create index if not exists idx_invitations_invited_by on public.invitations(invited_by);
create index if not exists idx_organizations_created_by on public.organizations(created_by);
