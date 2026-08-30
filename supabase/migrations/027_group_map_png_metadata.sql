alter table public.groups
  add column if not exists map_image_path text,
  add column if not exists map_image_version text,
  add column if not exists map_north double precision,
  add column if not exists map_south double precision,
  add column if not exists map_east double precision,
  add column if not exists map_west double precision,
  add column if not exists map_original_filename text,
  add column if not exists map_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-maps', 'group-maps', false, 5242880, array['image/png', 'image/tiff', 'image/geotiff', 'application/octet-stream'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/tiff', 'image/geotiff', 'application/octet-stream'];

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'approved members can read group map png'
  ) then
    create policy "approved members can read group map png"
      on storage.objects for select
      using (
        bucket_id = 'group-maps'
        and exists (
          select 1
          from public.group_members gm
          where gm.group_id::text = (storage.foldername(name))[1]
            and gm.user_id = auth.uid()
            and gm.status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'admins can upload group map png'
  ) then
    create policy "admins can upload group map png"
      on storage.objects for insert
      with check (
        bucket_id = 'group-maps'
        and exists (
          select 1
          from public.group_members gm
          where gm.group_id::text = (storage.foldername(name))[1]
            and gm.user_id = auth.uid()
            and gm.status = 'approved'
            and gm.role in ('owner', 'admin')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'admins can update group map png'
  ) then
    create policy "admins can update group map png"
      on storage.objects for update
      using (
        bucket_id = 'group-maps'
        and exists (
          select 1
          from public.group_members gm
          where gm.group_id::text = (storage.foldername(name))[1]
            and gm.user_id = auth.uid()
            and gm.status = 'approved'
            and gm.role in ('owner', 'admin')
        )
      )
      with check (
        bucket_id = 'group-maps'
        and exists (
          select 1
          from public.group_members gm
          where gm.group_id::text = (storage.foldername(name))[1]
            and gm.user_id = auth.uid()
            and gm.status = 'approved'
            and gm.role in ('owner', 'admin')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'admins can delete group map png'
  ) then
    create policy "admins can delete group map png"
      on storage.objects for delete
      using (
        bucket_id = 'group-maps'
        and exists (
          select 1
          from public.group_members gm
          where gm.group_id::text = (storage.foldername(name))[1]
            and gm.user_id = auth.uid()
            and gm.status = 'approved'
            and gm.role in ('owner', 'admin')
        )
      );
  end if;
end
$$;
