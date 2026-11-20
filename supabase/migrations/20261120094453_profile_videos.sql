-- Additive member-owned metadata only. Keep video_private outside exposed schemas.
begin;
create schema video_private;
revoke all on schema video_private from public, anon, authenticated, service_role;
alter default privileges in schema video_private revoke execute on functions from public;
alter default privileges in schema video_private revoke all on tables from public, anon, authenticated, service_role;

-- Follow existing account purge after its grace period; privacy changes retain videos.
create table video_private.profile_videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (char_length(title) between 1 and 80 and title ~ '[^[:space:]]'),
  visibility text not null check (visibility in ('public', 'private')),
  admin_hidden boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index profile_videos_owner_created_idx on video_private.profile_videos(owner_id, created_at desc, id desc);
alter table video_private.profile_videos enable row level security;
revoke all on video_private.profile_videos from public, anon, authenticated, service_role;

create function video_private.can_write(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.public_expert_detail d on d.id = p.id
    where p.id = p_profile and p.is_public and p.owner_visible
      and p.verification_status = 'approved'
      and p.suspended_at is null and p.deletion_requested_at is null
      and exists (select 1 from public.profile_versions v where v.profile_id = p.id
        and v.owner_id = p.user_id and v.is_representative
        and v.published_at is not null and v.published_content is not null
        and v.published_expert is not null)
  );
$$;

-- Mutations lock the same actual profile row used by publishing/privacy changes.
create function video_private.own_profile(p_write boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member auth.users; p public.profiles;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into member from auth.users where id = auth.uid() for share;
  if not found or (member.email_confirmed_at is null and member.phone_confirmed_at is null)
    or coalesce(member.is_anonymous, false) or member.banned_until > now()
    or member.deleted_at is not null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_write then
    select * into p from public.profiles where user_id = auth.uid() for update;
  else
    select * into p from public.profiles where user_id = auth.uid();
  end if;
  if p.suspended_at is not null or p.deletion_requested_at is not null then
    raise exception 'unavailable' using errcode = '42501';
  end if;
  if p_write and (p.id is null or not video_private.can_write(p.id)) then
    raise exception 'public_profile_required' using errcode = '42501';
  end if;
  return p.id;
end;
$$;

create function video_private.get_own_video_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare profile uuid;
begin
  profile := video_private.own_profile(false);
  return jsonb_build_object('profileId', profile, 'canWrite', video_private.can_write(profile));
end;
$$;

create function video_private.list_profile_videos(p_profile uuid, p_own boolean default false,
  p_offset integer default 0, p_limit integer default 12, p_query text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_uid uuid; own_id uuid; result jsonb; query_text text := nullif(btrim(p_query), '');
begin
  if char_length(query_text) > 100 then
    raise exception 'invalid_query' using errcode = '22023';
  end if;
  if p_own is null or p_offset is null or p_offset < 0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid_pagination' using errcode = '22023';
  end if;
  if p_own then
    own_id := video_private.own_profile(false);
    if own_id is null or p_profile is distinct from own_id then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    owner_uid := auth.uid();
  else
    select user_id into owner_uid from public.profiles where id = p_profile;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'videoId', v.video_id, 'title', v.title,
    'visibility', v.visibility, 'adminHidden', v.admin_hidden, 'createdAt', v.created_at,
    'updatedAt', v.updated_at
  ) order by v.created_at desc, v.id desc), '[]'::jsonb) into result
  from (select * from video_private.profile_videos
    -- Gate and row filtering share one read snapshot, including during privacy changes.
    where owner_id = owner_uid and (p_own or (video_private.can_write(p_profile)
      and visibility = 'public' and not admin_hidden))
      and (query_text is null or position(lower(query_text) in lower(title)) > 0)
    order by created_at desc, id desc offset p_offset limit p_limit) v;
  return result;
end;
$$;

-- NULL p_id creates; non-NULL p_id only updates an existing owned row.
create function video_private.save_profile_video(p_id uuid, p_video_id text, p_title text, p_visibility text,
  p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; clean_title text := btrim(p_title); saved_updated_at timestamptz;
begin
  perform video_private.own_profile(true);
  if p_video_id is null or p_video_id !~ '^[A-Za-z0-9_-]{11}$'
    or clean_title is null or char_length(clean_title) not between 1 and 80
    or clean_title !~ '[^[:space:]]' or clean_title ~ '[[:cntrl:]<>]'
    or p_visibility is null or p_visibility not in ('public', 'private') then
    raise exception 'invalid_video' using errcode = '22023';
  end if;
  if p_id is null then
    insert into video_private.profile_videos(owner_id, video_id, title, visibility)
      values (auth.uid(), p_video_id, clean_title, p_visibility) returning id into result;
  else
    select updated_at into saved_updated_at from video_private.profile_videos
      where id = p_id and owner_id = auth.uid() for update;
    if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
    if p_expected_updated_at is null or p_expected_updated_at is distinct from saved_updated_at then
      raise exception 'video_conflict' using errcode = '40001';
    end if;
    update video_private.profile_videos set video_id = p_video_id, title = clean_title,
      visibility = p_visibility, updated_at = greatest(clock_timestamp(), saved_updated_at + interval '1 microsecond')
      where id = p_id and owner_id = auth.uid() returning id into result;
    if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  end if;
  return result;
end;
$$;

create function video_private.delete_profile_video(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform video_private.own_profile(true);
  delete from video_private.profile_videos where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
end;
$$;

create function public.get_own_video_profile() returns jsonb
language sql security invoker set search_path = '' as $$ select video_private.get_own_video_profile(); $$;
create function public.list_profile_videos(p_profile uuid, p_own boolean default false,
  p_offset integer default 0, p_limit integer default 12, p_query text default null) returns jsonb
language sql security invoker set search_path = '' as $$ select video_private.list_profile_videos(p_profile,p_own,p_offset,p_limit,p_query); $$;
create function public.save_profile_video(p_id uuid, p_video_id text, p_title text, p_visibility text,
  p_expected_updated_at timestamptz default null) returns uuid
language sql security invoker set search_path = '' as $$ select video_private.save_profile_video(p_id,p_video_id,p_title,p_visibility,p_expected_updated_at); $$;
create function public.delete_profile_video(p_id uuid) returns void
language sql security invoker set search_path = '' as $$ select video_private.delete_profile_video(p_id); $$;

revoke all on all functions in schema video_private from public, anon, authenticated, service_role;
revoke all on function public.get_own_video_profile(), public.list_profile_videos(uuid,boolean,integer,integer,text),
  public.save_profile_video(uuid,text,text,text,timestamptz), public.delete_profile_video(uuid) from public, anon, authenticated, service_role;
grant usage on schema video_private to anon, authenticated;
grant execute on function video_private.list_profile_videos(uuid,boolean,integer,integer,text),
  public.list_profile_videos(uuid,boolean,integer,integer,text) to anon, authenticated;
grant execute on function video_private.get_own_video_profile(), video_private.save_profile_video(uuid,text,text,text,timestamptz),
  video_private.delete_profile_video(uuid), public.get_own_video_profile(),
  public.save_profile_video(uuid,text,text,text,timestamptz), public.delete_profile_video(uuid) to authenticated;
commit;
