begin;
-- Private originals, no public object URLs or Vercel download endpoints. Direct upload avoids Vercel request-body limits.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('academy-materials','academy-materials',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do update set public=false,file_size_limit=least(coalesce(storage.buckets.file_size_limit,52428800),52428800),allowed_mime_types=excluded.allowed_mime_types;
create policy material_original_insert on storage.objects for insert to authenticated with check(bucket_id='academy-materials' and (storage.foldername(name))[1]=(select auth.uid())::text and public.is_material_admin() and exists(select 1 from public.material_versions v where v.storage_path=name and v.status='uploaded'));
create policy material_original_read on storage.objects for select to authenticated using(bucket_id='academy-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy material_original_delete on storage.objects for delete to authenticated using(bucket_id='academy-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
