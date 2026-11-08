-- Only an isolated new version is deleted; no existing version is modified.
-- The fixture and all test changes are rolled back, with no file operations.
begin;
do $$
declare
  fixture uuid := gen_random_uuid();
  pid uuid;
  uid uuid;
  before_count bigint;
begin
  select id, user_id into pid, uid from public.profiles
    where id = '5caf08f5-0a7a-4ba4-a81d-38d668654ea5';
  if pid is null then raise exception 'Test profile not available'; end if;
  select count(*) into before_count from public.profile_versions where profile_id = pid;
  if has_function_privilege('anon', 'public.delete_own_profile_version(uuid)', 'EXECUTE') then
    raise exception 'Anonymous deletion privilege';
  end if;
  if not has_function_privilege('authenticated', 'public.delete_own_profile_version(uuid)', 'EXECUTE') then
    raise exception 'Authenticated function unavailable';
  end if;
  if has_table_privilege('authenticated', 'public.profile_versions', 'DELETE') then
    raise exception 'Direct deletion privilege expanded';
  end if;
  insert into public.profile_versions(id, profile_id, owner_id, title, draft_content)
    values(fixture, pid, uid, '[rollback fixture]', '{"headline":"Test","introduction":"","sections":[],"activities":[]}'::jsonb);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
  begin
    perform public.delete_own_profile_version(fixture);
    raise exception 'Another owner deleted the fixture';
  exception when sqlstate 'P0002' then null;
  end;
  if not exists(select 1 from public.profile_versions where id = fixture) then
    raise exception 'Fixture was removed by another owner';
  end if;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform public.delete_own_profile_version(fixture);
  if exists(select 1 from public.profile_versions where id = fixture) then
    raise exception 'Owned draft was not deleted';
  end if;
  if before_count <> (select count(*) from public.profile_versions where profile_id = pid) then
    raise exception 'Existing version count changed';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.delete_own_profile_version(fixture);
    raise exception 'Unauthenticated deletion was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select true as owner_delete_and_cross_owner_guard_verified, true as existing_version_count_preserved;
rollback;
