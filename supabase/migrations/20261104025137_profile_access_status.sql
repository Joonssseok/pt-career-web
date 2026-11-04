-- Returns only a coarse access state; never profile fields or deletion reasons.
-- No writes, publication changes, table grants, or QR issuance.
create function public.profile_access_status(p_profile_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when p.deletion_requested_at is not null or p.suspended_at is not null
        or p.verification_status is distinct from 'approved' or p.is_public is not true then 'unavailable'
      when p.owner_visible is not true then 'private'
      else 'public'
    end
    from public.profiles p
    where p.id = p_profile_id
      and exists (
        select 1 from public.profile_versions v
        where v.profile_id = p.id and v.published_at is not null
      )
  ), 'unavailable');
$$;
revoke all on function public.profile_access_status(uuid) from public;
grant execute on function public.profile_access_status(uuid) to anon, authenticated;
comment on function public.profile_access_status(uuid) is 'Coarse access state only for previously published profiles. No personal fields. Unknown or removed identifiers return unavailable.';
