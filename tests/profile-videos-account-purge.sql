-- ISOLATED fixture only, after permissions tests and before rollback SQL.
-- Roll back the fresh fake member and all test-only state at the end.
begin;
create temporary table retained_other_videos as select * from video_private.profile_videos;
insert into auth.users(id,email_confirmed_at)
  values ('00000000-0000-0000-0000-000000000004',now());
insert into public.profiles(id,user_id)
  values ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004');
insert into public.profile_versions(profile_id,owner_id)
  values ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004');
insert into public.fixture_detail_gate values ('10000000-0000-0000-0000-000000000004');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select public.save_profile_video(null,'abcdefghijk','Purge public video','public');
select public.save_profile_video(null,'ABCDEFGHIJK','Purge private video','private');
reset role;
-- Requesting withdrawal blocks access, but deletion waits for the existing purge.
update public.profiles set deletion_requested_at=now() where user_id=auth.uid();
select public.fixture_assert((select count(*)=2 from video_private.profile_videos where owner_id=auth.uid()), 'withdrawal request retains videos until purge');
select public.fixture_throws('select public.get_own_video_profile()', '42501');
update public.profiles set deletion_requested_at=null,is_public=false where user_id=auth.uid();
set local role authenticated;
select public.fixture_assert(jsonb_array_length(public.list_profile_videos('10000000-0000-0000-0000-000000000004',true))=2, 'private transition retains both own videos');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000004')='[]', 'private transition hides public list');
select public.fixture_assert(public.get_own_video_profile()->>'canWrite'='false', 'private transition prevents mutation');
reset role;
-- Model the existing lifecycle's final auth.users hard delete, not its scheduler.
delete from auth.users where id='00000000-0000-0000-0000-000000000004';
select public.fixture_assert(not exists(select 1 from video_private.profile_videos
  where owner_id='00000000-0000-0000-0000-000000000004'), 'account purge deletes only purged member videos');
select public.fixture_assert(not exists(
  (select * from retained_other_videos except select * from video_private.profile_videos)
  union all
  (select * from video_private.profile_videos except select * from retained_other_videos)
), 'every other owner video field preserved');
select public.fixture_assert((select count(*)=3 from auth.users), 'other auth users preserved');
rollback;
