-- Separate from public profile data and user-editable Auth metadata.
create schema pin_private;
revoke all on schema pin_private from public, anon, authenticated;

create table pin_private.account_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
create table pin_private.personal_verifications (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index on pin_private.personal_verifications(user_id);
alter table pin_private.account_pins enable row level security;
alter table pin_private.personal_verifications enable row level security;
revoke all on all tables in schema pin_private from public, anon, authenticated;

create function pin_private.current_session() returns uuid
language plpgsql security definer set search_path = '' as $$
declare sid uuid := nullif(auth.jwt()->>'session_id','')::uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or not exists (
      select 1 from auth.sessions s join auth.users u on u.id=s.user_id
      where s.id=sid and s.user_id=auth.uid() and u.email_confirmed_at is not null
      and (s.not_after is null or s.not_after>now())
    ) then raise exception 'authentication_required' using errcode='42501'; end if;
  return sid;
end;
$$;

create function pin_private.recovery_allowed(changed_at timestamptz) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m
    where m->>'method'='recovery'
    and (m->>'timestamp')::numeric >= extract(epoch from now()-interval '10 minutes')
    and (m->>'timestamp')::numeric <= extract(epoch from now())
    and (m->>'timestamp')::numeric > extract(epoch from changed_at)
  );
$$;

-- Public wrappers expose only own status/result; never hashes or other users' data.
create function pin_private.account_pin_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sid uuid; changed timestamptz; configured boolean;
begin
  sid := pin_private.current_session();
  select updated_at into changed from pin_private.account_pins where user_id=auth.uid();
  configured := found;
  return jsonb_build_object(
    'configured',configured,
    'verified',configured and exists(select 1 from pin_private.personal_verifications
      where session_id=sid and user_id=auth.uid() and expires_at>now()),
    'recovery_allowed',configured and pin_private.recovery_allowed(changed)
  );
end;
$$;

create function pin_private.set_account_pin(p_pin text, p_reset boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare sid uuid; changed timestamptz;
begin
  sid := pin_private.current_session();
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then return 'invalid_pin'; end if;
  -- Serialize first setup and resets for this account, including concurrent tabs.
  perform 1 from auth.users where id=auth.uid() for no key update;
  select updated_at into changed from pin_private.account_pins where user_id=auth.uid();
  if found then
    if not coalesce(p_reset,false) then return 'already_configured'; end if;
    if not pin_private.recovery_allowed(changed) then return 'recovery_required'; end if;
    update pin_private.account_pins set
      pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',12)),
      failed_attempts=0,locked_until=null,updated_at=clock_timestamp()
    where user_id=auth.uid();
    delete from pin_private.personal_verifications where user_id=auth.uid();
  else
    insert into pin_private.account_pins(user_id,pin_hash)
    values(auth.uid(),extensions.crypt(p_pin,extensions.gen_salt('bf',12)));
  end if;
  return 'ok';
end;
$$;

create function pin_private.verify_account_pin(p_pin text) returns text
language plpgsql security definer set search_path = '' as $$
declare sid uuid; saved pin_private.account_pins; attempts integer;
begin
  sid := pin_private.current_session();
  select * into saved from pin_private.account_pins where user_id=auth.uid() for update;
  if not found then return 'setup_required'; end if;
  if saved.locked_until>now() then return 'locked'; end if;
  attempts := case when saved.locked_until is not null then 0 else saved.failed_attempts end;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' or extensions.crypt(p_pin,saved.pin_hash)<>saved.pin_hash then
    attempts := attempts+1;
    update pin_private.account_pins set failed_attempts=attempts,
      locked_until=case when attempts>=5 then now()+interval '15 minutes' else null end
    where user_id=auth.uid();
    return case when attempts>=5 then 'locked' else 'incorrect' end;
  end if;
  update pin_private.account_pins set failed_attempts=0,locked_until=null where user_id=auth.uid();
  insert into pin_private.personal_verifications(session_id,user_id,expires_at)
  values(sid,auth.uid(),now()+interval '10 minutes')
  on conflict(session_id) do update set expires_at=excluded.expires_at;
  return 'ok';
end;
$$;

revoke all on all functions in schema pin_private from public, anon, authenticated;
-- Keep privileged implementations out of the exposed API schema.
create function public.account_pin_status() returns jsonb
language sql security invoker set search_path = '' as $$ select pin_private.account_pin_status(); $$;
create function public.set_account_pin(p_pin text, p_reset boolean default false) returns text
language sql security invoker set search_path = '' as $$ select pin_private.set_account_pin(p_pin,p_reset); $$;
create function public.verify_account_pin(p_pin text) returns text
language sql security invoker set search_path = '' as $$ select pin_private.verify_account_pin(p_pin); $$;
grant usage on schema pin_private to authenticated;
grant execute on function pin_private.account_pin_status() to authenticated;
grant execute on function pin_private.set_account_pin(text,boolean) to authenticated;
grant execute on function pin_private.verify_account_pin(text) to authenticated;
revoke all on function public.account_pin_status() from public, anon;
revoke all on function public.set_account_pin(text,boolean) from public, anon;
revoke all on function public.verify_account_pin(text) from public, anon;
grant execute on function public.account_pin_status() to authenticated;
grant execute on function public.set_account_pin(text,boolean) to authenticated;
grant execute on function public.verify_account_pin(text) to authenticated;
