-- Run after supabase/rollback/profile_videos.sql in the same isolated fixture DB.
select public.fixture_assert((select count(*)=107 from video_private.profile_videos), 'rollback retains every video');
select public.fixture_assert((select count(*)=2 from public.profiles), 'existing profiles retained');
select public.fixture_assert((select count(*)=3 from public.profile_versions), 'existing versions retained');
select public.fixture_assert(not has_schema_privilege('authenticated','video_private','usage'), 'private schema revoked');
select public.fixture_assert(not has_function_privilege('anon','public.list_profile_videos(uuid,boolean,integer,integer,text)','execute'), 'public list revoked');
select public.fixture_assert(not has_function_privilege('authenticated','video_private.list_profile_videos(uuid,boolean,integer,integer,text)','execute'), 'private list revoked');
set role authenticated;
select public.fixture_throws('select public.get_own_video_profile()', '42501');
select public.fixture_throws('select public.list_profile_videos(null)', '42501');
select public.fixture_throws($s$select public.save_profile_video(null,'abcdefghijk','Blocked','public')$s$, '42501');
select public.fixture_throws('select public.delete_profile_video(null)', '42501');
select public.fixture_throws('select video_private.get_own_video_profile()', '42501');
select public.fixture_throws('select * from video_private.profile_videos', '42501');
reset role;
