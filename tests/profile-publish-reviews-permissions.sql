-- Run through the authenticated database administration connection.
-- All synthetic rows, audit events and representative changes are rolled back.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
do $$
declare
 u uuid; pid uuid; v uuid; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 f uuid:=gen_random_uuid(); g uuid:=gen_random_uuid();
 body jsonb; changed jsonb; batch jsonb; stamps jsonb;
 first_stamp timestamptz; second_stamp timestamptz; review_id uuid;
 denied boolean; n int;
begin
 if has_function_privilege('anon','public.publish_profile_with_reviews(uuid,jsonb,jsonb)','execute') then
  raise exception 'anonymous function access';
 end if;
 if not has_function_privilege('authenticated','public.publish_profile_with_reviews(uuid,jsonb,jsonb)','execute') then
  raise exception 'authenticated function unavailable';
 end if;
 select user_id,id into u,pid from public.profiles
 where verification_status='approved' and is_public and suspended_at is null and deletion_requested_at is null limit 1;
 if u is null then raise exception 'approved fixture unavailable'; end if;
 body:=jsonb_build_object('headline','검증 전용','introduction','','sections','[]'::jsonb,'activities',
  jsonb_build_array(
   jsonb_build_object('id',a,'title','검증 활동 A','category','교육·연수','period','2026년','description','','learning',''),
   jsonb_build_object('id',b,'title','검증 활동 B','category','봉사활동','period','2026년','description','','learning','')));
 perform set_config('request.jwt.claim.sub',u::text,true);
 v:=public.save_profile_version(null,'일괄 심사 검증 · 롤백',body);
 insert into public.damoa_files(owner,id,activity_id,name,mime,path,bytes,ready)
 values(u,f,a,'sample-a.pdf','application/pdf',u::text||'/'||a::text||'/'||f::text,100,true),
       (u,g,b,'sample-b.png','image/png',u::text||'/'||b::text||'/'||g::text,100,true);
 batch:=jsonb_build_array(
  jsonb_build_object('key','damoa:'||a,'fileIds',jsonb_build_array(f),'publicIds','[]'::jsonb,'expected',null),
  jsonb_build_object('key','damoa:'||b,'fileIds',jsonb_build_array(g),'publicIds','[]'::jsonb,'expected',null));
 execute 'set local role authenticated';

 -- Anonymous/other owners and stale drafts cannot publish.
 perform set_config('request.jwt.claim.sub','',true);
 denied:=false; begin perform public.publish_profile_with_reviews(v,body,batch); exception when others then denied:=true; end;
 if not denied then raise exception 'missing identity accepted'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 denied:=false; begin perform public.publish_profile_with_reviews(v,body,batch); exception when others then denied:=true; end;
 if not denied then raise exception 'other owner accepted'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 denied:=false; begin perform public.publish_profile_with_reviews(v,body||'{"headline":"stale"}'::jsonb,batch); exception when others then denied:=true; end;
 if not denied then raise exception 'stale draft accepted'; end if;
 denied:=false; begin perform public.publish_profile_with_reviews(v,body,batch||jsonb_build_array(batch->0)); exception when others then denied:=true; end;
 if not denied then raise exception 'duplicate item accepted'; end if;
 if exists(select 1 from public.profile_item_reviews where version_id=v) then raise exception 'failed batch left reviews'; end if;

 -- A single call publishes and queues both items with private defaults.
 perform public.publish_profile_with_reviews(v,body,batch);
 select count(*) into n from public.profile_item_reviews where version_id=v and status='pending' and cardinality(public_file_ids)=0;
 if n<>2 then raise exception 'batch review requests missing'; end if;
 if not exists(select 1 from public.profile_versions where id=v and is_representative and published_content=body) then raise exception 'publication missing'; end if;
 select count(*) into n from public.profile_versions where owner_id=u and is_representative;
 if n<>1 then raise exception 'multiple representatives'; end if;
 select updated_at,id into first_stamp,review_id from public.profile_item_reviews where version_id=v and item_key='damoa:'||a;
 select updated_at into second_stamp from public.profile_item_reviews where version_id=v and item_key='damoa:'||b;
 perform set_config('request.jwt.claim.sub','',true);
 select count(*) into n from public.public_profile_item_reviews(pid);
 if n<>0 then raise exception 'pending badge exposed'; end if;
 select count(*) into n from public.public_profile_evidence_file(review_id,f);
 if n<>0 then raise exception 'private pending file exposed'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 batch:=jsonb_build_array(
  (batch->0)||jsonb_build_object('expected',first_stamp),
  (batch->1)||jsonb_build_object('expected',second_stamp));
 perform public.publish_profile_with_reviews(v,body,batch);
 if (select updated_at from public.profile_item_reviews where id=review_id) is distinct from first_stamp then raise exception 'unchanged pending resubmitted'; end if;

 -- Use a transaction-only status fixture; no real administrator approval is made.
 execute 'reset role';
 update public.profile_item_reviews set status='verified' where id=review_id;
 execute 'set local role authenticated';
 perform public.publish_profile_with_reviews(v,body,batch);
 if not exists(select 1 from public.profile_item_reviews where id=review_id and status='verified' and updated_at=first_stamp) then raise exception 'unchanged approval lost'; end if;

 -- A later item failure must roll back earlier changes and leave publication alone.
 changed:=jsonb_set(body,'{activities,0,title}','"수정한 활동 A"'::jsonb);
 perform public.save_profile_version(v,'일괄 심사 검증 · 롤백',changed);
 denied:=false; begin
  perform public.publish_profile_with_reviews(v,changed,jsonb_build_array(batch->0,
   (batch->1)||jsonb_build_object('fileIds',jsonb_build_array(gen_random_uuid()))));
 exception when others then denied:=true; end;
 if not denied then raise exception 'missing file accepted'; end if;
 if not exists(select 1 from public.profile_item_reviews where id=review_id and status='verified' and updated_at=first_stamp) then raise exception 'partial failed request committed'; end if;
 if not exists(select 1 from public.profile_versions where id=v and published_content=body) then raise exception 'failed request changed publication'; end if;

 -- Final publication failure also cancels earlier request changes.
 denied:=false; begin
  execute 'reset role';
  update public.profiles set is_public=false where id=pid;
  execute 'set local role authenticated';
  perform public.publish_profile_with_reviews(v,changed,batch);
 exception when others then denied:=true; end;
 if not denied then raise exception 'blocked publication succeeded'; end if;
 if not exists(select 1 from public.profile_item_reviews where id=review_id and status='verified' and updated_at=first_stamp) then raise exception 'publish failure left request changes'; end if;

 -- Corrected content can request again; stale and excluded entries cannot.
 perform public.publish_profile_with_reviews(v,changed,batch);
 if not exists(select 1 from public.profile_item_reviews where id=review_id and status='pending' and item_snapshot=changed->'activities'->0) then raise exception 'changed content not resubmitted'; end if;
 denied:=false; begin perform public.publish_profile_with_reviews(v,changed,batch); exception when others then denied:=true; end;
 if not denied then raise exception 'stale review accepted'; end if;
 changed:=changed||jsonb_build_object('excluded',jsonb_build_array('damoa:'||a));
 perform public.save_profile_version(v,'일괄 심사 검증 · 롤백',changed);
 denied:=false; begin perform public.publish_profile_with_reviews(v,changed,batch); exception when others then denied:=true; end;
 if not denied then raise exception 'excluded item accepted'; end if;

 -- Profiles without new evidence still publish normally.
 perform public.publish_profile_with_reviews(v,changed,'[]'::jsonb);
 if not exists(select 1 from public.profile_versions where id=v and published_content=changed) then raise exception 'no evidence publication failed'; end if;
end $$;
rollback;
select 'profile_publish_reviews_permissions_passed_and_rolled_back' as result;
