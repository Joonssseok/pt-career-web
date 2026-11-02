-- Transactional publish/owner test: every draft and profile change rolls back.
BEGIN;
DO $test$
DECLARE p public.profiles%rowtype; v uuid; original_count bigint; denied boolean:=false; result jsonb;
BEGIN
 select * into p from public.profiles where verification_status='approved' and is_public and suspended_at is null and deletion_requested_at is null limit 1;
 if p.id is null then raise exception 'approved test profile unavailable'; end if;
 select count(*) into original_count from public.profile_versions;
 perform set_config('request.jwt.claim.sub',p.user_id::text,true);
 v:=public.save_profile_version(null,'transactional publication check','{"headline":"publication check","introduction":"test","sections":[],"activities":[],"order":{},"excluded":["introduction:0","workplace:0"]}'::jsonb);
 perform public.publish_profile_version(v);
 if (select count(*) from public.profile_versions where owner_id=p.user_id and is_representative)<>1 then raise exception 'representative count invalid'; end if;
 select to_jsonb(r) into result from public.get_representative_profiles(array[p.id]) r;
 if result is null or result->>'profile_id'<>p.id::text then raise exception 'shared profile id changed'; end if;
 if result->'content' ? 'excluded' or result::text like '%transactional publication check%' then raise exception 'private management data leaked'; end if;
 if result->'expert'->>'introduction' is not null or result->'expert'->>'workplace_address' is not null then raise exception 'excluded singleton exposed'; end if;
 if result->'expert'->'experiences'<>'[]'::jsonb or result->'expert'->'licenses'<>'[]'::jsonb then raise exception 'excluded section exposed'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.publish_profile_version(v); exception when others then denied:=true; end;
 if not denied then raise exception 'other owner published'; end if;
END $test$;
ROLLBACK;
SELECT 'owner-only publish, one representative, fixed ID and private payload checks passed; rolled back' as result;
