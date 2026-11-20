-- ISOLATED EMPTY DATABASE ONLY. Minimal fake dependencies, never production data.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
create table auth.users (
  id uuid primary key, email_confirmed_at timestamptz, phone_confirmed_at timestamptz,
  is_anonymous boolean default false, banned_until timestamptz, deleted_at timestamptz
);
create table public.profiles (
  id uuid primary key, user_id uuid unique, is_public boolean default true,
  owner_visible boolean default true, verification_status text default 'approved',
  suspended_at timestamptz, deletion_requested_at timestamptz
);
create table public.profile_versions (
  id uuid primary key default gen_random_uuid(), profile_id uuid, owner_id uuid,
  is_representative boolean default true, published_at timestamptz default now(),
  published_content jsonb default '{}', published_expert jsonb default '{}'
);
-- Simulate the existing live projection, including an independent view-only gate.
create table public.fixture_detail_gate (profile_id uuid primary key);
create view public.public_expert_detail as select p.id from public.profiles p
join public.fixture_detail_gate g on g.profile_id = p.id
where p.is_public and p.owner_visible and p.verification_status = 'approved'
and p.suspended_at is null and p.deletion_requested_at is null;
insert into auth.users(id,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000001', now()),
 ('00000000-0000-0000-0000-000000000002', now()),
 ('00000000-0000-0000-0000-000000000003', now());
insert into public.profiles(id,user_id) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002');
insert into public.profile_versions(profile_id,owner_id) select id,user_id from public.profiles;
insert into public.fixture_detail_gate select id from public.profiles;

create function public.fixture_assert(ok boolean, label text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function public.fixture_throws(statement text, expected_code text) returns void
language plpgsql security invoker as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise exception 'FAIL: expected %, got % for %', expected_code, sqlstate, statement;
  end;
  raise exception 'FAIL: expected % for %', expected_code, statement;
end $$;
