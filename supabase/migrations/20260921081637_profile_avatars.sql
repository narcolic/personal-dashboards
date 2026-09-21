insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users can upload their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'avatar');

create policy "Users can read their own avatar for replacement" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'avatar');

create policy "Users can replace their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'avatar')
  with check (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'avatar');

create policy "Users can remove their own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'avatar');
