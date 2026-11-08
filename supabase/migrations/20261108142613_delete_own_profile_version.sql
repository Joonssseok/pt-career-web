-- Delete only an explicitly selected, owned, non-representative version.
-- Common profile information, source activities and stored original files remain.
-- Rollback: revoke EXECUTE/drop this function; deleted drafts require a backup.
create function public.delete_own_profile_version(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  version public.profile_versions%rowtype;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Serialize against representative publication using the same parent lock order.
  select id into pid from public.profiles where user_id = uid for update;
  if pid is null then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  select * into version from public.profile_versions
    where id = p_id and owner_id = uid and profile_id = pid for update;
  if version.id is null then raise exception 'Version not found' using errcode = 'P0002'; end if;
  if version.is_representative then
    raise exception 'Representative version cannot be deleted' using errcode = '23514';
  end if;
  delete from public.profile_versions where id = version.id and owner_id = uid and not is_representative;
end $$;
revoke all on function public.delete_own_profile_version(uuid) from public, anon, authenticated;
grant execute on function public.delete_own_profile_version(uuid) to authenticated;
