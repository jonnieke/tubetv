-- Allow admin access via email and password without requiring TOTP MFA (aal2)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

drop policy if exists "Verified admins delete series posters" on storage.objects;
create policy "Verified admins delete series posters"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'series-posters'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Verified admins upload series posters" on storage.objects;
create policy "Verified admins upload series posters"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'series-posters'
    and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
  );
