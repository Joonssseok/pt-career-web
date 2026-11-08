-- Synthetic profile-version writes and publication changes are fully rolled back.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
do $$
declare
 u uuid; pid uuid; v uuid; body jsonb; before_public jsonb; current_public jsonb; projected jsonb; n int;
begin
 body:='{"headline":"지역 검증","introduction":"","sections":[],"activities":[],"activityRegion":"서울"}'::jsonb;
 if not public.profile_version_content_valid(body) then raise exception 'known region rejected'; end if;
 if not public.profile_version_content_valid(body-'activityRegion') then raise exception 'legacy content rejected'; end if;
 if public.profile_version_content_valid(body||'{"activityRegion":"상세 주소"}'::jsonb)
  or public.profile_version_content_valid(body||'{"activityRegion":null}'::jsonb) then raise exception 'invalid region accepted'; end if;
 projected:=public.profile_version_visible_expert('{"experiences":[],"academic_records":[],"educations":[],"licenses":[],"workplace_region":null,"workplace_address":null,"workplace_phone":null}'::jsonb,body);
 if projected->>'workplace_region' is distinct from '서울' or projected->>'workplace_address' is not null or projected->>'workplace_phone' is not null then raise exception 'region changed private workplace fields'; end if;
 select user_id,id into u,pid from public.profiles where verification_status='approved' and is_public and suspended_at is null and deletion_requested_at is null limit 1;
 if u is null then raise exception 'fixture unavailable'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 select to_jsonb(r) into before_public from public.get_representative_profiles(array[pid]) r;
 v:=public.save_profile_version(null,'활동 지역 검증 · 롤백',body);
 select to_jsonb(r) into current_public from public.get_representative_profiles(array[pid]) r;
 if before_public is distinct from current_public then raise exception 'draft region changed publication'; end if;
 perform public.publish_profile_with_reviews(v,body,'[]'::jsonb);
 select to_jsonb(r) into current_public from public.get_representative_profiles(array[pid]) r;
 if current_public->'expert'->>'workplace_region' is distinct from '서울' or current_public->'content'->>'activityRegion' is distinct from '서울' then raise exception 'published region missing'; end if;
 select count(*) into n from public.search_public_experts(null,array['서울'],null,null,50,0) where id=pid;
 if n<>1 then raise exception 'region filter missed published profile'; end if;
 select count(*) into n from public.search_public_experts(null,array['부산'],null,null,50,0) where id=pid;
 if n<>0 then raise exception 'wrong region matched'; end if;
 body:=body||'{"activityRegion":"부산"}'::jsonb;
 perform public.save_profile_version(v,'활동 지역 검증 · 롤백',body);
 select to_jsonb(r) into current_public from public.get_representative_profiles(array[pid]) r;
 if current_public->'expert'->>'workplace_region' is distinct from '서울' then raise exception 'unpublished edit changed public region'; end if;
 perform public.publish_profile_with_reviews(v,body,'[]'::jsonb);
 select to_jsonb(r) into current_public from public.get_representative_profiles(array[pid]) r;
 if current_public->'expert'->>'workplace_region' is distinct from '부산' then raise exception 'new region missing'; end if;
 body:=body||'{"activityRegion":""}'::jsonb;
 perform public.save_profile_version(v,'활동 지역 검증 · 롤백',body);
 perform public.publish_profile_with_reviews(v,body,'[]'::jsonb);
 select to_jsonb(r) into current_public from public.get_representative_profiles(array[pid]) r;
 if current_public->'expert'->>'workplace_region' is not null then raise exception 'region not cleared'; end if;
 execute 'set local role anon';
 perform set_config('request.jwt.claim.sub','',true);
 select to_jsonb(r) into current_public from public.get_representative_profiles(array[pid]) r;
 if current_public->'expert'->>'workplace_region' is not null then raise exception 'cleared region exposed'; end if;
end $$;
rollback;
select 'activity_region_permissions_passed_and_rolled_back' as result;
