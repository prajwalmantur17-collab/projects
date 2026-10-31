-- Public machine photos. Objects are stored as <auth.uid()>/<uuid>.<ext>.
-- Reads are public (bucket is public) while writes are limited to the folder
-- owned by the signed-in user.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'machine-images',
  'machine-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "machine_images_public_read" on storage.objects;
create policy "machine_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'machine-images');

drop policy if exists "machine_images_insert_own" on storage.objects;
create policy "machine_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'machine-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "machine_images_update_own" on storage.objects;
create policy "machine_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'machine-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'machine-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "machine_images_delete_own" on storage.objects;
create policy "machine_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'machine-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
