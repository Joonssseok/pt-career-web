-- All profile flag changes are isolated and rolled back, including updated_at.
begin;
do $test$
declare p public.profiles%rowtype;
begin
  if pg_get_function_result('public.profile_access_status(uuid)'::regprocedure) <> 'text' then
    raise exception 'status RPC result must be text only';
  end if;
  if not has_function_privilege('anon','public.profile_access_status(uuid)','execute')
    or not has_function_privilege('authenticated','public.profile_access_status(uuid)','execute') then
    raise exception 'status RPC is unavailable to visitors';
  end if;
  if public.profile_access_status(gen_random_uuid()) <> 'unavailable' then
    raise exception 'unknown id did not fail closed';
  end if;
  select * into p from public.profiles x
  where x.verification_status='approved' and x.is_public and x.owner_visible
    and x.suspended_at is null and x.deletion_requested_at is null
    and exists(select 1 from public.profile_versions v where v.profile_id=x.id and v.published_at is not null)
  limit 1;
  if p.id is null then raise exception 'published fixture unavailable'; end if;
  if public.profile_access_status(p.id) <> 'public' then raise exception 'public state failed'; end if;
  update public.profiles set owner_visible=false where id=p.id;
  if public.profile_access_status(p.id) <> 'private' then raise exception 'private state failed'; end if;
  if exists(select 1 from public.public_expert_detail where id=p.id) then raise exception 'private details exposed'; end if;
  update public.profiles set deletion_requested_at=now() where id=p.id;
  if public.profile_access_status(p.id) <> 'unavailable' then raise exception 'withdrawn state failed'; end if;
  update public.profiles set deletion_requested_at=null,suspended_at=now() where id=p.id;
  if public.profile_access_status(p.id) <> 'unavailable' then raise exception 'suspended state failed'; end if;
end $test$;
rollback;
select 'status-only public/private/unavailable and detail privacy verified; all fixture writes rolled back' as result;
