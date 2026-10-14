-- Public artwork reads; authenticated, MFA-verified admins are the only writers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('series-posters', 'series-posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Verified admins upload series posters"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'series-posters'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
  and (select auth.jwt()->>'aal') = 'aal2'
);
