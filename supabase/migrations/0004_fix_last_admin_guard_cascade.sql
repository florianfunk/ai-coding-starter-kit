-- PROJ-1 — BUG-1 fix: guard_last_admin fired during cascade deletes, making an
-- organization (and its memberships) undeletable. Skip the guard on DELETE when
-- the parent organization no longer exists (i.e. it is being cascade-removed).
-- Direct removal/demotion of the last admin while the org still exists stays blocked.
--
-- NOTE: deleting a *sole-admin user* (auth.users cascade) is still guarded by
-- design — the org would be orphaned. GDPR account-erasure (PROJ-28) must first
-- reassign the admin or dissolve the organization.
create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := old.org_id;
  v_admins int;
begin
  -- Cascade delete of the organization → the org row is already gone → skip.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.organizations where id = v_org) then
    return old;
  end if;

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
revoke all on function public.guard_last_admin() from public, anon, authenticated;
