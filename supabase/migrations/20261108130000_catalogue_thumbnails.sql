insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogue-thumbnails', 'catalogue-thumbnails', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Verified admins can upload catalogue thumbnails"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'catalogue-thumbnails'
    and (select public.is_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and name ~ '^[0-9a-f-]{36}/(landscape|portrait)/[0-9a-f-]{36}\.(jpg|png|webp)$'
  );
