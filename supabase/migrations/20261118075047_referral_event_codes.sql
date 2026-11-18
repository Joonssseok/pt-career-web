-- Operator-issued campaign code storage. Apply to production only after approval.
-- referral_private must remain outside PostgREST exposed schemas (like pin_private).
-- Codes are operator-issued; no rewards, payment/coupon rights or metadata grants.
begin;

create schema referral_private;
revoke all on schema referral_private from public, anon, authenticated;

create table referral_private.campaigns (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9_-]{3,31}$'),
  label text not null check (char_length(label) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp()
);
create table referral_private.registrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null references referral_private.campaigns(code),
  registered_at timestamptz not null default clock_timestamp()
);
create index registrations_code_idx on referral_private.registrations(code);
alter table referral_private.campaigns enable row level security;
alter table referral_private.registrations enable row level security;
-- No policies: all access goes through narrowly granted functions below.
revoke all on all tables in schema referral_private from public, anon, authenticated;
alter default privileges in schema referral_private revoke execute on functions from public;
alter default privileges in schema referral_private revoke all on tables from public, anon, authenticated;

-- Lock the actual member row, not a JWT claim or editable metadata. A profile is
-- optional; an existing suspended/deletion-pending profile always blocks access.
create function referral_private.member_error() returns text
language plpgsql security definer set search_path = '' as $$
declare member auth.users;
begin
  if auth.uid() is null then return 'not_authenticated'; end if;
  select * into member from auth.users where id = auth.uid() for update;
  if not found or (member.email_confirmed_at is null and member.phone_confirmed_at is null)
    or coalesce(member.is_anonymous, false) then return 'not_authenticated'; end if;
  if member.banned_until > now() or exists (
    select 1 from public.profiles p where p.user_id = auth.uid()
      and (p.suspended_at is not null or p.deletion_requested_at is not null)
  ) then return 'unavailable'; end if;
  return null;
end;
$$;

create function referral_private.own_referral_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare failure text; result jsonb;
begin
  failure := referral_private.member_error();
  if failure is not null then raise exception '%', failure using errcode = '42501'; end if;
  select jsonb_build_object('registeredCode', r.code, 'registeredAt', r.registered_at)
    into result from referral_private.registrations r where r.user_id = auth.uid();
  return coalesce(result, jsonb_build_object('registeredCode', null, 'registeredAt', null));
end;
$$;

-- Controlled mutation errors: invalid_code, already_registered, unavailable,
-- not_authenticated, not_allowed, duplicate_code, invalid_label.
-- Inputs are trimmed and uppercased. Existing same-code retries preserve the
-- original timestamp and succeed even if the operator subsequently disables it.
create function referral_private.register_referral_code(input_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare failure text; normalized text := upper(btrim(input_code)); saved text;
begin
  failure := referral_private.member_error();
  if failure is not null then return jsonb_build_object('ok', false, 'error', failure); end if;
  if normalized is null or normalized !~ '^[A-Z0-9][A-Z0-9_-]{3,31}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  select r.code into saved from referral_private.registrations r where r.user_id = auth.uid();
  if found then
    if saved = normalized then return jsonb_build_object('ok', true); end if;
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;
  -- Serialize activation changes with acceptance; never expose campaign identity
  -- or activity via a lookup endpoint to ordinary members.
  perform 1 from referral_private.campaigns c where c.code = normalized and c.active for share;
  if not found then return jsonb_build_object('ok', false, 'error', 'unavailable'); end if;
  insert into referral_private.registrations(user_id, code) values (auth.uid(), normalized);
  return jsonb_build_object('ok', true);
end;
$$;

create function referral_private.list_referral_campaigns() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare failure text; result jsonb;
begin
  failure := referral_private.member_error();
  if failure is not null then raise exception '%', failure using errcode = '42501'; end if;
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'label', c.label,
    'active', c.active, 'createdAt', c.created_at, 'registrations',
    (select count(*) from referral_private.registrations r where r.code = c.code))
    order by c.created_at, c.code), '[]'::jsonb) into result
  from referral_private.campaigns c;
  return result;
end;
$$;

create function referral_private.create_referral_campaign(input_code text, input_label text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare failure text; normalized text := upper(btrim(input_code)); cleaned_label text := btrim(input_label);
begin
  failure := referral_private.member_error();
  if failure is not null then return jsonb_build_object('ok', false, 'error', failure); end if;
  if not coalesce(public.is_admin(), false) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if normalized is null or normalized !~ '^[A-Z0-9][A-Z0-9_-]{3,31}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if cleaned_label is null or char_length(cleaned_label) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'error', 'invalid_label');
  end if;
  insert into referral_private.campaigns(code, label) values (normalized, cleaned_label)
    on conflict (code) do nothing;
  if not found then return jsonb_build_object('ok', false, 'error', 'duplicate_code'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create function referral_private.set_referral_campaign_active(input_code text, input_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare failure text; normalized text := upper(btrim(input_code));
begin
  failure := referral_private.member_error();
  if failure is not null then return jsonb_build_object('ok', false, 'error', failure); end if;
  if not coalesce(public.is_admin(), false) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if normalized is null or normalized !~ '^[A-Z0-9][A-Z0-9_-]{3,31}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if input_active is null then return jsonb_build_object('ok', false, 'error', 'unavailable'); end if;
  update referral_private.campaigns set active = input_active where code = normalized;
  if not found then return jsonb_build_object('ok', false, 'error', 'unavailable'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.own_referral_status() returns jsonb
language sql security invoker set search_path = '' as $$ select referral_private.own_referral_status(); $$;
create function public.register_referral_code(input_code text) returns jsonb
language sql security invoker set search_path = '' as $$ select referral_private.register_referral_code(input_code); $$;
create function public.list_referral_campaigns() returns jsonb
language sql security invoker set search_path = '' as $$ select referral_private.list_referral_campaigns(); $$;
create function public.create_referral_campaign(input_code text, input_label text) returns jsonb
language sql security invoker set search_path = '' as $$ select referral_private.create_referral_campaign(input_code, input_label); $$;
create function public.set_referral_campaign_active(input_code text, input_active boolean) returns jsonb
language sql security invoker set search_path = '' as $$ select referral_private.set_referral_campaign_active(input_code, input_active); $$;

revoke all on all functions in schema referral_private from public, anon, authenticated;
revoke all on function public.own_referral_status(), public.register_referral_code(text),
  public.list_referral_campaigns(), public.create_referral_campaign(text,text),
  public.set_referral_campaign_active(text,boolean) from public, anon, authenticated;
grant usage on schema referral_private to authenticated;
grant execute on function referral_private.own_referral_status(), referral_private.register_referral_code(text),
  referral_private.list_referral_campaigns(), referral_private.create_referral_campaign(text,text),
  referral_private.set_referral_campaign_active(text,boolean) to authenticated;
grant execute on function public.own_referral_status(), public.register_referral_code(text),
  public.list_referral_campaigns(), public.create_referral_campaign(text,text),
  public.set_referral_campaign_active(text,boolean) to authenticated;
commit;
