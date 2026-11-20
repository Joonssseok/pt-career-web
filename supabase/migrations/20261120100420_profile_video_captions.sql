begin;
alter table video_private.profile_videos add column caption text not null default ''
  check(char_length(caption)<=100000);

-- Preserve the original revision/ownership gate and legacy callers' captions.
create function video_private.save_profile_video_caption(p_id uuid,p_video_id text,p_title text,p_visibility text,
 p_expected_updated_at timestamptz,p_caption text) returns uuid
language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
 if p_caption is null or char_length(p_caption)>100000 then raise exception 'invalid_caption' using errcode='22023'; end if;
 saved := video_private.save_profile_video(p_id,p_video_id,p_title,p_visibility,p_expected_updated_at);
 update video_private.profile_videos set caption=p_caption where id=saved and owner_id=auth.uid();
 return saved;
end;
$$;
create function public.save_profile_video_caption(p_id uuid,p_video_id text,p_title text,p_visibility text,
 p_expected_updated_at timestamptz,p_caption text) returns uuid
language sql security invoker set search_path='' as $$
 select video_private.save_profile_video_caption(p_id,p_video_id,p_title,p_visibility,p_expected_updated_at,p_caption);
$$;
revoke all on function video_private.save_profile_video_caption(uuid,text,text,text,timestamptz,text),
 public.save_profile_video_caption(uuid,text,text,text,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function video_private.save_profile_video_caption(uuid,text,text,text,timestamptz,text),
 public.save_profile_video_caption(uuid,text,text,text,timestamptz,text) to authenticated;

create or replace function video_private.list_profile_videos(p_profile uuid,p_own boolean default false,
 p_offset integer default 0,p_limit integer default 12,p_query text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_uid uuid; own_id uuid; result jsonb; query_text text:=nullif(btrim(p_query),'');
begin
 if char_length(query_text)>100 or p_own is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
  raise exception 'invalid_query' using errcode='22023'; end if;
 if p_own then
  own_id:=video_private.own_profile(false);
  if own_id is null or p_profile is distinct from own_id then raise exception 'not_allowed' using errcode='42501'; end if;
  owner_uid:=auth.uid();
 else select user_id into owner_uid from public.profiles where id=p_profile; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'videoId',v.video_id,'title',v.title,'caption',v.caption,
 'visibility',v.visibility,'adminHidden',v.admin_hidden,'createdAt',v.created_at,'updatedAt',v.updated_at)
 order by v.created_at desc,v.id desc),'[]'::jsonb) into result
 from (select * from video_private.profile_videos where owner_id=owner_uid
 and (p_own or(video_private.can_write(p_profile) and visibility='public' and not admin_hidden))
 and(query_text is null or position(lower(query_text) in lower(title||' '||caption))>0)
 order by created_at desc,id desc offset p_offset limit p_limit)v;
 return result;
end;
$$;
commit;
