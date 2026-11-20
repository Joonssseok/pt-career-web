-- ISOLATED fixture only, after permissions tests and before rollback SQL.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select set_config('test.stale_id',public.save_profile_video(null,'abcdefghijk','Stale edit fixture','public')::text,true);
-- Capture the exact DTO timestamp, as a stale tab would.
select set_config('test.stale_revision',public.list_profile_videos(
  '10000000-0000-0000-0000-000000000001',true,0,12,'Stale edit fixture')->0->>'updatedAt',true);
select public.save_profile_video(current_setting('test.stale_id')::uuid,'abcdefghijk','Stale edit fixture','private',
  current_setting('test.stale_revision')::timestamptz);
select set_config('test.fresh_revision',public.list_profile_videos(
  '10000000-0000-0000-0000-000000000001',true,0,12,'Stale edit fixture')->0->>'updatedAt',true);
select public.fixture_assert(current_setting('test.fresh_revision')::timestamptz > current_setting('test.stale_revision')::timestamptz,
  'privacy update advances revision');
select public.fixture_throws($s$select public.save_profile_video(current_setting('test.stale_id')::uuid,
  'abcdefghijk','Stale republish','public',current_setting('test.stale_revision')::timestamptz)$s$, '40001');
select public.fixture_throws($s$select public.save_profile_video(current_setting('test.stale_id')::uuid,
  'abcdefghijk','Missing revision republish','public')$s$, '40001');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',true,0,12,'Stale edit fixture')->0->>'visibility'='private',
  'stale update leaves video private');
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',true,0,12,'Stale edit fixture')->0->>'updatedAt'=current_setting('test.fresh_revision'),
  'conflict preserves current revision');
select public.save_profile_video(current_setting('test.stale_id')::uuid,'abcdefghijk','Stale edit fixture','private',
  current_setting('test.fresh_revision')::timestamptz);
reset role;
set local role anon;
select public.fixture_assert(public.list_profile_videos('10000000-0000-0000-0000-000000000001',false,0,12,'Stale edit fixture')='[]',
  'stale update never republishes video');
reset role;
rollback;
