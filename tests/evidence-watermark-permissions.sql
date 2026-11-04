begin;
do $$
declare
  u uuid; admin_id uuid; pid uuid; version uuid; item uuid:=gen_random_uuid();
  file_id uuid:=gen_random_uuid(); rid uuid; row_data jsonb; content jsonb;
  stamp timestamptz; n int; object_path text;
begin
  select user_id,id into u,pid from public.profiles
    where verification_status='approved' and is_public and owner_visible
      and suspended_at is null and deletion_requested_at is null limit 1;
  select user_id into admin_id from public.admin_users limit 1;
  if u is null or admin_id is null then raise exception 'fixture unavailable'; end if;
  content:=jsonb_build_object('headline','검증 전용','introduction','','sections','[]'::jsonb,
    'activities',jsonb_build_array(jsonb_build_object('id',item,'title','검증 자료','category','기타','period','','description','','learning','')));
  perform set_config('request.jwt.claim.sub',u::text,true);
  version:=public.save_profile_version(null,'워터마크 검증 · 전부 롤백',content);
  insert into public.damoa_files(owner,id,activity_id,name,mime,path,bytes,ready)
    values(u,file_id,item,'test.png','image/png',u::text||'/'||item::text||'/'||file_id::text,74,true);
  object_path:=u::text||'/'||item::text||'/'||file_id::text;
  -- Temporary metadata only, for SELECT-policy checks; no storage file is created.
  insert into storage.objects(bucket_id,name,metadata)
    values('damoa-files',object_path,jsonb_build_object('size',74,'mimetype','image/png'));
  row_data:=public.save_profile_item_review(version,'damoa:'||item,array[file_id],array[file_id],true,null);
  rid:=(row_data->>'id')::uuid; stamp:=(row_data->>'updated_at')::timestamptz;
  perform public.publish_profile_version(version);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  select count(*) into n from public.public_profile_evidence_file(rid,file_id);
  if n<>0 then raise exception 'pending proof publicly readable'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.decide_profile_item_review(rid,'verified','공개 전 점검 · 검증 전용',stamp);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  select count(*) into n from public.public_profile_evidence_file(rid,file_id);
  if n<>1 then raise exception 'approved public copy unavailable'; end if;
  select count(*) into n from public.profile_review_file(rid,file_id);
  if n<>0 then raise exception 'anonymous original access'; end if;
  if damoa_internal.review_file_readable(u::text||'/'||item::text||'/'||file_id::text)
    then raise exception 'anonymous raw storage readable'; end if;
  select count(*) into n from storage.objects where bucket_id='damoa-files' and name=object_path;
  if n<>0 then raise exception 'anonymous direct original download permitted'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  execute 'set local role authenticated';
  select count(*) into n from public.profile_review_file(rid,file_id);
  if n<>0 then raise exception 'other user original access'; end if;
  select count(*) into n from public.public_profile_evidence_file(rid,file_id);
  if n<>1 then raise exception 'public copy source blocked for another member'; end if;
  select count(*) into n from storage.objects where bucket_id='damoa-files' and name=object_path;
  if n<>0 then raise exception 'other user direct original download permitted'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',u::text,true);
  execute 'set local role authenticated';
  select count(*) into n from public.profile_review_file(rid,file_id);
  if n<>1 then raise exception 'owner original inaccessible'; end if;
  select count(*) into n from storage.objects where bucket_id='damoa-files' and name=object_path;
  if n<>1 then raise exception 'owner original storage blocked'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  execute 'set local role authenticated';
  select count(*) into n from public.profile_review_file(rid,file_id);
  if n<>1 then raise exception 'admin original inaccessible'; end if;
  select count(*) into n from storage.objects where bucket_id='damoa-files' and name=object_path;
  if n<>1 then raise exception 'admin original storage blocked'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',u::text,true);
  content:=content||jsonb_build_object('excluded',jsonb_build_array('damoa:'||item));
  perform public.save_profile_version(version,'워터마크 검증 · 전부 롤백',content);
  perform public.publish_profile_version(version);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  select count(*) into n from public.public_profile_evidence_file(rid,file_id);
  if n<>0 then raise exception 'excluded proof source leaked'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname='evidence_original_read_fence' and permissive='RESTRICTIVE')
    then raise exception 'original storage fence missing'; end if;
  if has_function_privilege('anon','public.is_admin(uuid)','execute')
    then raise exception 'administrator membership helper became public'; end if;
  perform count(*) from storage.objects where bucket_id='profile-images';
end $$;
rollback;
