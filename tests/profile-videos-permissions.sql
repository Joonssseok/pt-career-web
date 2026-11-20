-- Run fixture, migration, this file, rollback, then rollback test in an empty PGlite/PG database.
begin;
select public.fixture_assert((select relrowsecurity from pg_class where oid='video_private.profile_videos'::regclass), 'RLS enabled');
select public.fixture_assert(not exists(select 1 from pg_policies where schemaname='video_private'), 'no direct policies');
select public.fixture_assert((select count(*)=1 from pg_constraint where conrelid='video_private.profile_videos'::regclass and contype='f'), 'exactly one video FK');
select public.fixture_assert(exists(select 1 from pg_constraint c
  where c.conrelid='video_private.profile_videos'::regclass and c.contype='f'
    and c.confrelid='auth.users'::regclass and c.confdeltype='c' and c.confupdtype='a'
    and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='owner_id')]
    and c.confkey=array[(select attnum from pg_attribute where attrelid=c.confrelid and attname='id')]), 'only video owner cascades from auth user purge');
select public.fixture_assert(not exists(select 1 from pg_constraint where contype='f'
  and confrelid='auth.users'::regclass and confdeltype='c'
  and conrelid<>'video_private.profile_videos'::regclass), 'no other fixture table cascade added');
select public.fixture_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('get_own_video_profile','list_profile_videos','save_profile_video','delete_profile_video') and p.prosecdef), 'public invoker wrappers');
select public.fixture_assert(not has_function_privilege('authenticated','video_private.own_profile(boolean)','execute'), 'helper not granted');
select public.fixture_assert(not has_function_privilege('anon','video_private.can_write(uuid)','execute'), 'public helper not granted');
select public.fixture_assert(not has_table_privilege('authenticated','video_private.profile_videos','select,insert,update,delete'), 'no direct table grants');
select public.fixture_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='video_private' and not ('search_path=""'=any(p.proconfig))), 'fixed private search paths');

set local role anon;
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001')='[]', 'empty anonymous list');
select public.fixture_throws('select public.get_own_video_profile()', '42501');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','title','public')$s$, '42501');
select public.fixture_throws('select * from video_private.profile_videos', '42501');
select public.fixture_throws($s$select public.list_profile_videos('10000000-0000-0000-0000-000000000001',true)$s$, '42501');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select public.fixture_throws('select public.get_own_video_profile()', '42501');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','title','public')$s$, '42501');
select public.fixture_throws('select public.delete_profile_video(null)', '42501');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.fixture_assert(public.get_own_video_profile()='{"profileId":"10000000-0000-0000-0000-000000000001","canWrite":true}', 'own context exact');
select set_config('test.video_public',public.save_profile_video(null,'abcdefghijk',' Public title ','public')::text,true);
select set_config('test.video_private',public.save_profile_video(null,'ABCDEFGHIJK','Private title','private')::text,true);
select set_config('test.video_hidden',public.save_profile_video(null,'012345678_-','Hidden title','public')::text,true);
select public.fixture_throws($s$select public.save_profile_video(null,'https://youtu.be/abcdefghijk','title','public')$s$, '22023');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk',repeat('x',81),'public')$s$, '22023');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk',E'\t\n','public')$s$, '22023');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','<iframe>','public')$s$, '22023');
select public.fixture_throws($s$select public.save_profile_video(null,null,'title','public')$s$, '22023');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk',null,'public')$s$, '22023');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','title',null)$s$, '22023');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','title','unlisted')$s$, '22023');
select public.fixture_throws($s$select public.list_profile_videos(null,false,-1,12)$s$, '22023');
select public.fixture_throws($s$select public.list_profile_videos(null,false,0,101)$s$, '22023');
select public.fixture_throws($s$select public.list_profile_videos(null,null,0,12)$s$, '22023');
select public.fixture_throws($s$select public.list_profile_videos(null,false,null,12)$s$, '22023');
select public.fixture_throws('select * from video_private.profile_videos', '42501');
reset role;
update video_private.profile_videos set admin_hidden=true where id=current_setting('test.video_hidden')::uuid;
set local role authenticated;
select public.save_profile_video(current_setting('test.video_hidden')::uuid,'abcdefghijk','Still hidden','public',
  (select (v->>'updatedAt')::timestamptz from jsonb_array_elements(
    public.list_profile_videos('10000000-0000-0000-0000-000000000001',true)) v
    where v->>'id'=current_setting('test.video_hidden')));
select public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000001',true))=3, 'owner sees private and hidden');
select public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000001',true,1,1))=1, 'pagination');
reset role;
select public.fixture_assert((select admin_hidden from video_private.profile_videos where id=current_setting('test.video_hidden')::uuid), 'update preserves moderation');
set local role anon;
select public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000001'))=1, 'private and hidden excluded');
select public.fixture_assert(((public.list_profile_videos('10000000-0000-0000-0000-000000000001')->0) - array['id','videoId','title','caption','visibility','adminHidden','createdAt','updatedAt'])='{}', 'safe keys only');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001')->0->>'title'='Public title', 'trimmed title');
select public.fixture_assert(public.list_profile_videos(gen_random_uuid())='[]', 'unknown indistinguishable');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select public.fixture_throws($s$select public.list_profile_videos('10000000-0000-0000-0000-000000000001',true)$s$, '42501');
select public.fixture_throws($s$select public.save_profile_video(current_setting('test.video_public')::uuid,'abcdefghijk','Stolen','public')$s$, '42501');
select public.fixture_throws($s$select public.delete_profile_video(current_setting('test.video_public')::uuid)$s$, '42501');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);

-- Every public/profile gate is checked independently; old metadata is preserved.
do $$ declare change text; begin
  foreach change in array array['is_public=false','owner_visible=false','verification_status=''pending''',
    'suspended_at=now()','deletion_requested_at=now()'] loop
    execute 'update public.profiles set '||change||' where user_id=auth.uid()';
    perform public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001')='[]', change);
    perform public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'Public title')='[]', 'search obeys '||change);
    perform public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','Blocked','public')$s$, '42501');
    perform public.fixture_throws($s$select public.delete_profile_video(current_setting('test.video_public')::uuid)$s$, '42501');
    if change in ('is_public=false','owner_visible=false','verification_status=''pending''') then
      perform public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000001',true))=3, 'readonly owner');
      perform public.fixture_assert((public.get_own_video_profile()->>'canWrite')::boolean=false, 'readonly context');
    else
      perform public.fixture_throws('select public.get_own_video_profile()', '42501');
      perform public.fixture_throws($s$select public.list_profile_videos('10000000-0000-0000-0000-000000000001',true)$s$, '42501');
    end if;
    update public.profiles set is_public=true,owner_visible=true,verification_status='approved',suspended_at=null,deletion_requested_at=null where user_id=auth.uid();
  end loop;
end $$;
delete from public.fixture_detail_gate where profile_id='10000000-0000-0000-0000-000000000001';
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001')='[]', 'current view independently required');
select public.fixture_assert(public.get_own_video_profile()->>'canWrite'='false', 'view gate blocks write');
insert into public.fixture_detail_gate values ('10000000-0000-0000-0000-000000000001');
update public.profile_versions set is_representative=false where owner_id=auth.uid();
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001')='[]', 'representative required');
select public.fixture_assert(public.get_own_video_profile()->>'canWrite'='false', 'no representative blocks writing');
insert into public.profile_versions(profile_id,owner_id) values ('10000000-0000-0000-0000-000000000001',auth.uid());
select public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000001'))=1, 'representative swap retains videos');
update public.profile_versions set published_at=null where owner_id=auth.uid() and is_representative;
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001')='[]', 'draft representative blocked');
select public.fixture_assert(public.get_own_video_profile()->>'canWrite'='false', 'draft representative blocks writing');
update public.profile_versions set published_at=now() where owner_id=auth.uid() and is_representative;

-- Auth state comes from stored users, never user-editable JWT metadata.
do $$ declare change text; begin
  foreach change in array array['email_confirmed_at=null','is_anonymous=true','banned_until=now()+interval ''1 day''','deleted_at=now()'] loop
    execute 'update auth.users set '||change||' where id=auth.uid()';
    perform public.fixture_throws('select public.get_own_video_profile()', '42501');
    perform public.fixture_throws($s$select public.list_profile_videos('10000000-0000-0000-0000-000000000001',true)$s$, '42501');
    perform public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','Blocked','public')$s$, '42501');
    perform public.fixture_throws($s$select public.delete_profile_video(current_setting('test.video_public')::uuid)$s$, '42501');
    update auth.users set email_confirmed_at=now(),is_anonymous=false,banned_until=null,deleted_at=null where id=auth.uid();
  end loop;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select public.fixture_assert(public.get_own_video_profile()='{"profileId":null,"canWrite":false}', 'no profile context');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','Blocked','public')$s$, '42501');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
update auth.users set email_confirmed_at=null,phone_confirmed_at=now() where id=auth.uid();
set local role authenticated;
select public.fixture_assert(public.get_own_video_profile()->>'canWrite'='true', 'phone confirmation permitted');
-- A page-size bound is not a total video quota.
do $$ begin for i in 1..105 loop perform public.save_profile_video(null,'abcdefghijk','Video '||i,'public'); end loop; end $$;
select public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000001',true,100,100))=8, 'more than 100 records allowed');
select public.fixture_throws($s$select public.list_profile_videos(null,false,0,12,repeat('x',101))$s$, '22023');
select public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000001',true,0,12,'  pRiVaTe TiTle  '))=1, 'own literal normalized search');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'Private title')='[]', 'search cannot expose private');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'Still hidden')='[]', 'search cannot expose hidden');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'%')='[]', 'percent is literal');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'_')='[]', 'underscore is literal');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'')=public.list_profile_videos('10000000-0000-0000-0000-000000000001'), 'empty search matches default');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'  ')=public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,null), 'blank and null search match default');
reset role;
set local role anon;
select public.fixture_assert(not exists(select 1 from jsonb_array_elements(public.list_profile_videos('10000000-0000-0000-0000-000000000001')) v where v->>'title'='Public title'), 'old video beyond first page');
select public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,' PUBLIC TITLE '))=1, 'anonymous search finds old video beyond page 12');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'Private title')='[]', 'anonymous search excludes private');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'Still hidden')='[]', 'anonymous search excludes hidden');
reset role;
set local role authenticated;
select public.delete_profile_video(current_setting('test.video_private')::uuid);
reset role;
select public.fixture_assert(not exists(select 1 from video_private.profile_videos where id=current_setting('test.video_private')::uuid), 'owned delete');
select public.fixture_assert((select count(*)=107 from video_private.profile_videos), 'retained fixture rows');
-- Commit fake rows so the separate rollback preservation checks can inspect them.
commit;
