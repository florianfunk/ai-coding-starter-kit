-- ============================================================================
-- Storage Buckets + Policies
-- ============================================================================
-- "produktbilder" : Produkt-, Bereich-, Kategorie-Bilder
-- "assets"        : Logos, Cover-Bilder
-- "kataloge"      : generierte PDF-Kataloge (PROJ-10)
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('produktbilder', 'produktbilder', false),
  ('assets',        'assets',        false),
  ('kataloge',      'kataloge',      false)
on conflict (id) do nothing;

do $$
declare b text;
begin
  foreach b in array array['produktbilder','assets','kataloge'] loop
    execute format($f$drop policy if exists "auth_read_%1$s" on storage.objects$f$, b);
    execute format($f$drop policy if exists "auth_write_%1$s" on storage.objects$f$, b);
    execute format($f$drop policy if exists "auth_update_%1$s" on storage.objects$f$, b);
    execute format($f$drop policy if exists "auth_delete_%1$s" on storage.objects$f$, b);

    execute format(
      $f$create policy "auth_read_%1$s"   on storage.objects for select to authenticated using (bucket_id = %1$L)$f$, b);
    execute format(
      $f$create policy "auth_write_%1$s"  on storage.objects for insert to authenticated with check (bucket_id = %1$L)$f$, b);
    execute format(
      $f$create policy "auth_update_%1$s" on storage.objects for update to authenticated using (bucket_id = %1$L) with check (bucket_id = %1$L)$f$, b);
    execute format(
      $f$create policy "auth_delete_%1$s" on storage.objects for delete to authenticated using (bucket_id = %1$L)$f$, b);
  end loop;
end $$;
