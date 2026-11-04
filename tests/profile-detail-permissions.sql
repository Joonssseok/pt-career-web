-- Run after the additive migration. Fixtures and publication are always rolled back.
begin;
do $test$
declare p public.profiles%rowtype; v uuid; original_version uuid; image_a uuid:=gen_random_uuid(); image_b uuid:=gen_random_uuid(); foreign_image uuid:=gen_random_uuid(); group_id uuid:=gen_random_uuid(); body jsonb:='{"headline":"test","introduction":"","sections":[],"activities":[]}'; r jsonb; stamp timestamptz; denied boolean; n int;
begin
 select * into p from public.profiles where verification_status='approved' and is_public and suspended_at is null and deletion_requested_at is null limit 1;
 if p.id is null then raise exception 'approved fixture unavailable'; end if;
 select id into original_version from public.profile_versions where owner_id=p.user_id and is_representative;
 perform set_config('request.jwt.claim.sub',p.user_id::text,true);
 -- Metadata only: no real user file is read, uploaded or deleted.
 insert into public.profile_detail_uploads(owner_id,id,group_id,name,mime,path,bytes,ready) values
 (p.user_id,image_a,group_id,'test-a.png','image/png',p.user_id::text||'/'||group_id||'/'||image_a,100,true),
 (p.user_id,image_b,group_id,'test-b.png','image/png',p.user_id::text||'/'||group_id||'/'||image_b,100,true);
 execute 'set local role authenticated';
 r:=public.save_profile_with_detail_images(null,'transactional image check',body,array[image_a,image_b],null);
 v:=(r->>'id')::uuid; stamp:=(r->>'revision')::timestamptz;
 if public.claim_unused_profile_detail_image(image_a) is not null then raise exception 'draft image claimed for cleanup'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 if public.profile_detail_image_path(image_a) is not null then raise exception 'draft image path leaked'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 denied:=false; begin perform public.save_profile_with_detail_images(v,'forbidden',body,array[image_a],stamp); exception when others then denied:=true; end;
 if not denied then raise exception 'other owner changed images'; end if;
 if public.profile_detail_image_path(image_a) is not null then raise exception 'other owner read private image'; end if;
 perform set_config('request.jwt.claim.sub',p.user_id::text,true);
 perform public.publish_profile_version(v);
 perform set_config('request.jwt.claim.sub','',true);
 execute 'set local role anon';
 select count(*) into n from public.public_profile_detail_images(p.id) where id in(image_a,image_b);
 if n<>2 then raise exception 'published images missing'; end if;
 if public.profile_detail_image_path(image_a) is null then raise exception 'published image unavailable'; end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',p.user_id::text,true);
 r:=public.save_profile_with_detail_images(v,'transactional image check',body,array[image_b],stamp);
 denied:=false; begin perform public.save_profile_with_detail_images(v,'stale',body,'{}',stamp); exception when others then denied:=true; end;
 if not denied then raise exception 'stale image selection overwritten'; end if;
 if public.claim_unused_profile_detail_image(image_a) is not null then raise exception 'live image claimed after draft edit'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 select count(*) into n from public.public_profile_detail_images(p.id) where id=image_a;
 if n<>1 then raise exception 'draft edit altered live images'; end if;
 perform set_config('request.jwt.claim.sub',p.user_id::text,true);
 perform public.publish_profile_version(v);
 perform set_config('request.jwt.claim.sub','',true);
 if public.profile_detail_image_path(image_a) is not null then raise exception 'removed image still public'; end if;
 perform set_config('request.jwt.claim.sub',p.user_id::text,true);
 if public.claim_unused_profile_detail_image(image_b) is not null then raise exception 'published image claimed for cleanup'; end if;
 if public.claim_unused_profile_detail_image(image_a) is null then raise exception 'unused image cannot be cleaned'; end if;
 if original_version is not null then
  perform public.publish_profile_version(original_version);
  perform set_config('request.jwt.claim.sub','',true);
  if public.profile_detail_image_path(image_b) is not null then raise exception 'non-representative image exposed'; end if;
 end if;
 execute 'reset role';
 if not exists(select 1 from storage.buckets where id='profile-detail-images' and not public and file_size_limit=20971520) then raise exception 'bucket configuration invalid'; end if;
end $test$;
rollback;
select 'profile image ownership, explicit publication, frozen live snapshot, cleanup protection and revocation checks passed; rolled back' as result;
