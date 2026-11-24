-- Taxonomy handoff 2026-11-23. No publication/visibility enablement or content rewrites.
-- Private backup scope: changed catalog metadata, merged selections, specialty arrays only.
-- Merge collision: hidden wins (bool_and), primary OR, earliest existing order/time.
begin;
select pg_advisory_xact_lock(231123,1);
lock table public.profiles,public.profile_specialties,public.profile_professions,
 public.specialties,public.professions,public.profile_versions in access exclusive mode;
alter table public.professions add column if not exists is_medical_technician boolean not null default false;
alter table public.specialties add column if not exists medical_technician_only boolean not null default false;
create schema if not exists specialty_taxonomy_private;
revoke all on schema specialty_taxonomy_private from public,anon,authenticated,service_role;
alter default privileges in schema specialty_taxonomy_private revoke execute on functions from public;
alter default privileges in schema specialty_taxonomy_private revoke all on tables from public,anon,authenticated,service_role;

create table if not exists specialty_taxonomy_private.runs(
 id uuid primary key default gen_random_uuid(),applied boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),rolled_back_at timestamptz,
 target_id uuid not null,hospital_id uuid not null,hospital_preexisting boolean not null,
 medical_profession_id uuid not null,old_medical boolean not null
);
create unique index if not exists specialty_taxonomy_one_run on specialty_taxonomy_private.runs((true)) where applied;
create table if not exists specialty_taxonomy_private.catalog_backup(
 run_id uuid not null,id uuid not null,slug text not null,before_value jsonb not null,after_value jsonb,
 primary key(run_id,id)
);
create table if not exists specialty_taxonomy_private.selection_before(
 run_id uuid not null,profile_id uuid not null,specialty_id uuid not null,is_primary boolean not null,
 display_order integer not null,owner_visible boolean not null,created_at timestamptz not null,
 primary key(run_id,profile_id,specialty_id)
);
create table if not exists specialty_taxonomy_private.selection_after(
 like specialty_taxonomy_private.selection_before including all
);
create table if not exists specialty_taxonomy_private.snapshot_backup(
 run_id uuid not null,version_id uuid not null,before_value jsonb not null,after_value jsonb,
 primary key(run_id,version_id)
);
create table if not exists specialty_taxonomy_private.function_backup(
 run_id uuid not null,signature text not null,before_definition text not null,after_definition text,
 primary key(run_id,signature)
);
alter table specialty_taxonomy_private.runs enable row level security;
alter table specialty_taxonomy_private.catalog_backup enable row level security;
alter table specialty_taxonomy_private.selection_before enable row level security;
alter table specialty_taxonomy_private.selection_after enable row level security;
alter table specialty_taxonomy_private.snapshot_backup enable row level security;
alter table specialty_taxonomy_private.function_backup enable row level security;
revoke all on all tables in schema specialty_taxonomy_private from public,anon,authenticated,service_role;

create or replace function specialty_taxonomy_private.is_medical(p_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profile_professions pp join public.professions p on p.id=pp.profession_id
  where pp.profile_id=p_profile and p.is_active and p.is_medical_technician);
$$;
create or replace function specialty_taxonomy_private.specialty_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if tg_op='DELETE' then
  perform 1 from public.profiles where id=old.profile_id for update;return old;
 end if;
 if tg_op='UPDATE' then
  perform 1 from public.profiles where id in(old.profile_id,new.profile_id) order by id for update;
 else perform 1 from public.profiles where id=new.profile_id for update;end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and old.specialty_id<>new.specialty_id) then
  if not exists(select 1 from public.specialties where id=new.specialty_id and is_active) then
   raise exception 'specialty_inactive_or_missing' using errcode='23514';
  end if;
 end if;
 if exists(select 1 from public.specialties where id=new.specialty_id and medical_technician_only)
  and not specialty_taxonomy_private.is_medical(new.profile_id) then
  raise exception 'medical_technician_required' using errcode='23514';
 end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and old.profile_id<>new.profile_id) then
  if (select count(*) from public.profile_specialties where profile_id=new.profile_id)>=3 then
   raise exception 'Profile cannot have more than 3 specialties' using errcode='23514';
  end if;
 end if;
 return new;
end;
$$;

-- Changing classification metadata must not invalidate existing hospital choices either.
create or replace function specialty_taxonomy_private.medical_catalog_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare profile uuid;
begin
 if old.is_active is not distinct from new.is_active and old.is_medical_technician is not distinct from new.is_medical_technician then return null;end if;
 for profile in select p.id from public.profiles p where exists(
  select 1 from public.profile_professions pp where pp.profile_id=p.id and pp.profession_id in(old.id,new.id)) order by p.id for update loop
  if exists(select 1 from public.profile_specialties ps join public.specialties s on s.id=ps.specialty_id
    where ps.profile_id=profile and s.medical_technician_only) and not specialty_taxonomy_private.is_medical(profile) then
   raise exception 'medical_technician_required' using errcode='23514';
  end if;
 end loop;
 return null;
end;
$$;
create or replace function specialty_taxonomy_private.profession_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then perform 1 from public.profiles where id=old.profile_id for update;return old;end if;
 if tg_op='UPDATE' then perform 1 from public.profiles where id in(old.profile_id,new.profile_id) order by id for update;
 else perform 1 from public.profiles where id=new.profile_id for update;end if;
 return new;
end;
$$;
create or replace function specialty_taxonomy_private.profession_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare profile uuid;
begin
 for profile in select distinct x from unnest(array[
  case when tg_op<>'INSERT' then old.profile_id end,
  case when tg_op<>'DELETE' then new.profile_id end]) x where x is not null order by x loop
  perform 1 from public.profiles where id=profile for update;
  if exists(select 1 from public.profile_specialties ps join public.specialties s on s.id=ps.specialty_id
    where ps.profile_id=profile and s.medical_technician_only)
    and not specialty_taxonomy_private.is_medical(profile) then
   raise exception 'medical_technician_required' using errcode='23514';
  end if;
 end loop;
 return null;
end;
$$;

-- Rebuild only already-published specialty entries. An old nonmatching snapshot
-- must never become public just because a rename/merge makes its object match.
create or replace function specialty_taxonomy_private.rewrite_snapshot(p_run uuid,p_profile uuid,p_array jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; candidate jsonb; old_cat specialty_taxonomy_private.catalog_backup;
 mapped public.specialties; selection public.profile_specialties; old_match boolean; new_match boolean;
 candidates jsonb:='[]'; n integer:=0; result jsonb; target uuid;
begin
 select target_id into target from specialty_taxonomy_private.runs where id=p_run;
 for item in select value from jsonb_array_elements(p_array) loop
  n:=n+1; candidate:=item; old_match:=false;
  select * into old_cat from specialty_taxonomy_private.catalog_backup where run_id=p_run and slug=item->>'slug';
  if found then
   select exists(
    select 1 from (
     select b.profile_id,b.specialty_id,b.is_primary,b.owner_visible from specialty_taxonomy_private.selection_before b where b.run_id=p_run
     union all
     select ps.profile_id,ps.specialty_id,ps.is_primary,ps.owner_visible from public.profile_specialties ps
      join public.specialties s on s.id=ps.specialty_id where s.slug not in('sports-performance','conditioning','sport-specific-training')
    ) previous where previous.profile_id=p_profile and previous.specialty_id=old_cat.id and previous.owner_visible
     and jsonb_build_array(jsonb_build_object('slug',old_cat.slug,'name',old_cat.before_value->>'name','is_primary',previous.is_primary)) @> jsonb_build_array(item)
   ) into old_match;
   select * into mapped from public.specialties where id=case when old_cat.slug in('conditioning','sport-specific-training') then target else old_cat.id end;
   candidate:=item||jsonb_build_object('slug',mapped.slug,'name',mapped.name);
   select * into selection from public.profile_specialties where profile_id=p_profile and specialty_id=mapped.id;
   if old_match and found then candidate:=candidate||jsonb_build_object('is_primary',selection.is_primary);end if;
   new_match:=selection.profile_id is not null and selection.owner_visible and
    jsonb_build_array(jsonb_build_object('slug',mapped.slug,'name',mapped.name,'is_primary',selection.is_primary)) @> jsonb_build_array(candidate);
   if new_match and not old_match then continue;end if;
  end if;
  candidates:=candidates||jsonb_build_array(jsonb_build_object('position',n,'entry',candidate,'matched',old_match,
   'group',case when candidate->>'slug'='sports-performance' then 'sports-performance' else n::text end));
 end loop;
 select coalesce(jsonb_agg(entry order by first_position),'[]'::jsonb) into result from (
  select distinct on (c->>'group') c->'entry' entry,
   min((c->>'position')::integer) over(partition by c->>'group') first_position
  from jsonb_array_elements(candidates) c
  order by c->>'group',(c->>'matched')::boolean desc,(c->>'position')::integer
 ) chosen;
 return result;
end;
$$;
revoke all on all functions in schema specialty_taxonomy_private from public,anon,authenticated,service_role;

do $migrate$
declare run uuid; target uuid; hospital uuid; medical uuid; old_flag boolean; hospital_existed boolean;
 source_ids uuid[]; catalog_ids uuid[]; desired jsonb; stage_base bigint; item record;
 definition text; patched text; needle text; pattern text; matches integer; guard text;
begin
 if exists(select 1 from specialty_taxonomy_private.runs where applied) then return;end if;
 desired:='[{"slug":"weight-management","name":"체중·체형관리","sort_order":1},
 {"slug":"strength-body-profile","name":"근력·체력 향상","sort_order":2},
 {"slug":"posture-pain-management","name":"자세·움직임 개선","sort_order":3},
 {"slug":"rehab-post-surgery","name":"부상 후 리커버리","sort_order":4},
 {"slug":"sports-performance","name":"스포츠·컨디셔닝","sort_order":5},
 {"slug":"pilates-yoga-flexibility","name":"필라테스·요가","sort_order":6},
 {"slug":"prenatal-postnatal","name":"산전·산후","sort_order":7},
 {"slug":"youth-exercise","name":"소아·청소년","sort_order":8},
 {"slug":"senior-fall-prevention","name":"시니어","sort_order":9},
 {"slug":"chronic-special-populations","name":"만성질환 운동","sort_order":10},
 {"slug":"hospital-work","name":"병원 근무","sort_order":11},
 {"slug":"conditioning","sort_order":12},{"slug":"sport-specific-training","sort_order":13}]';
 if (select count(*) from public.specialties where slug in(select j->>'slug' from jsonb_array_elements(desired) j) and slug<>'hospital-work')<>12 then
  raise exception 'specialty_taxonomy_missing_source';end if;
 select id,is_medical_technician into medical,old_flag from public.professions where slug='physical-therapist';
 if not found then raise exception 'specialty_taxonomy_missing_medical_profession';end if;
 select id into target from public.specialties where slug='sports-performance';
 select id into hospital from public.specialties where slug='hospital-work';hospital_existed:=found;
 if hospital is null then hospital:=gen_random_uuid();end if;
 select array_agg(id) into source_ids from public.specialties where slug in('sports-performance','conditioning','sport-specific-training');
 select array_agg(id) into catalog_ids from public.specialties where slug in(select j->>'slug' from jsonb_array_elements(desired) j);
 if exists(select 1 from public.specialties s where not(s.id=any(catalog_ids)) and
  (s.sort_order between 1 and 13 or s.name in(select j->>'name' from jsonb_array_elements(desired) j))) then
  raise exception 'specialty_taxonomy_catalog_conflict';end if;
 insert into specialty_taxonomy_private.runs(target_id,hospital_id,hospital_preexisting,medical_profession_id,old_medical)
  values(target,hospital,hospital_existed,medical,old_flag) returning id into run;
 insert into specialty_taxonomy_private.catalog_backup
  select run,s.id,s.slug,jsonb_build_object('name',s.name,'sort_order',s.sort_order,'is_active',s.is_active,'medical_technician_only',s.medical_technician_only),null
  from public.specialties s where s.id=any(catalog_ids);
 insert into specialty_taxonomy_private.selection_before
  select run,ps.profile_id,ps.specialty_id,ps.is_primary,ps.display_order,ps.owner_visible,ps.created_at
  from public.profile_specialties ps where ps.specialty_id=any(source_ids);
 insert into specialty_taxonomy_private.snapshot_backup
  select run,v.id,v.published_expert->'specialties',null from public.profile_versions v
  where jsonb_typeof(v.published_expert->'specialties')='array' and exists(
   select 1 from jsonb_array_elements(v.published_expert->'specialties') j
   where j->>'slug' in(select slug from specialty_taxonomy_private.catalog_backup where run_id=run));
 insert into specialty_taxonomy_private.function_backup
  select run,s,pg_get_functiondef(s::regprocedure),null from unnest(array[
   'public.replace_profile_specialties(jsonb)','public.replace_profile_professions(jsonb)']) s;
 select coalesce(max(sort_order),0)::bigint+100 into stage_base from public.specialties;
 if stage_base+14>2147483647 then raise exception 'specialty_taxonomy_sort_overflow';end if;
 for item in select s.id,s.slug,row_number() over(order by s.slug) n from public.specialties s where s.id=any(catalog_ids) loop
  update public.specialties set name='__taxonomy_'||run::text||'_'||item.slug,sort_order=(stage_base+item.n)::integer where id=item.id;
 end loop;
 for item in select j from jsonb_array_elements(desired) j where j->>'slug'<>'hospital-work' loop
  update public.specialties s set name=coalesce(item.j->>'name',b.before_value->>'name'),
   sort_order=(item.j->>'sort_order')::integer,is_active=(s.slug not in('conditioning','sport-specific-training')),
   medical_technician_only=false from specialty_taxonomy_private.catalog_backup b
   where b.run_id=run and b.id=s.id and s.slug=item.j->>'slug';
 end loop;
 if hospital_existed then
  update public.specialties set name='병원 근무',sort_order=11,is_active=true,medical_technician_only=true where id=hospital;
 else insert into public.specialties(id,slug,name,sort_order,is_active,medical_technician_only) values(hospital,'hospital-work','병원 근무',11,true,true);end if;
 update public.professions set is_medical_technician=true where id=medical;
 delete from public.profile_specialties where specialty_id=any(source_ids);
 insert into public.profile_specialties(profile_id,specialty_id,is_primary,display_order,owner_visible,created_at)
  select profile_id,target,bool_or(is_primary),min(display_order),bool_and(owner_visible),min(created_at)
  from specialty_taxonomy_private.selection_before where run_id=run group by profile_id;
 insert into specialty_taxonomy_private.selection_after
  select run,ps.profile_id,ps.specialty_id,ps.is_primary,ps.display_order,ps.owner_visible,ps.created_at
  from public.profile_specialties ps where ps.profile_id in(select profile_id from specialty_taxonomy_private.selection_before where run_id=run)
   and ps.specialty_id=any(source_ids);
 update specialty_taxonomy_private.snapshot_backup b set after_value=specialty_taxonomy_private.rewrite_snapshot(run,v.profile_id,b.before_value)
  from public.profile_versions v where b.run_id=run and b.version_id=v.id;
 update public.profile_versions v set published_expert=jsonb_set(v.published_expert,'{specialties}',b.after_value,false)
  from specialty_taxonomy_private.snapshot_backup b where b.run_id=run and b.version_id=v.id and b.before_value is distinct from b.after_value;
 update specialty_taxonomy_private.catalog_backup b set after_value=jsonb_build_object('name',s.name,'sort_order',s.sort_order,'is_active',s.is_active,'medical_technician_only',s.medical_technician_only)
  from public.specialties s where b.run_id=run and b.id=s.id;
 for item in select * from specialty_taxonomy_private.function_backup where run_id=run loop
  definition:=item.before_definition;
  pattern:='(?i)FROM\s+public\.profiles\s+WHERE\s+user_id\s*=\s*v_user_id\s*;';
  select count(*) into matches from regexp_matches(definition,pattern,'g');
  if matches<>1 then raise exception 'specialty_taxonomy_writer_definition_drift';end if;
  patched:=regexp_replace(definition,pattern,'FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;');
  if item.signature='public.replace_profile_specialties(jsonb)' then
   guard:=$guard$IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_specialties) j JOIN public.specialties s ON s.id=(j->>'specialty_id')::uuid WHERE s.medical_technician_only)
    AND NOT specialty_taxonomy_private.is_medical(v_profile_id) THEN RETURN QUERY SELECT FALSE,'Hospital work requires a medical technician profession'::text;RETURN;END IF;$guard$;
   needle:=substring(patched from '(?i)BEGIN\s+DELETE\s+FROM\s+public\.profile_specialties');
  else
   guard:=$guard$IF EXISTS(SELECT 1 FROM public.profile_specialties ps JOIN public.specialties s ON s.id=ps.specialty_id WHERE ps.profile_id=v_profile_id AND s.medical_technician_only)
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_professions) j JOIN public.professions p ON p.id=(j->>'profession_id')::uuid WHERE p.is_active AND p.is_medical_technician)
    THEN RETURN QUERY SELECT FALSE,'Remove hospital work before removing the medical technician profession'::text;RETURN;END IF;$guard$;
   needle:=substring(patched from '(?i)BEGIN\s+DELETE\s+FROM\s+public\.profile_professions');
  end if;
  if needle is null then raise exception 'specialty_taxonomy_writer_definition_drift';end if;
  patched:=replace(patched,needle,guard||E'\n'||needle);execute patched;
  update specialty_taxonomy_private.function_backup set after_definition=pg_get_functiondef(item.signature::regprocedure) where run_id=run and signature=item.signature;
 end loop;
 execute 'create trigger a_specialty_taxonomy_guard before insert or update or delete on public.profile_specialties for each row execute function specialty_taxonomy_private.specialty_guard()';
 execute 'create trigger a_profession_taxonomy_lock before insert or update or delete on public.profile_professions for each row execute function specialty_taxonomy_private.profession_lock()';
 execute 'create constraint trigger profession_medical_taxonomy_guard after insert or update or delete on public.profile_professions deferrable initially deferred for each row execute function specialty_taxonomy_private.profession_guard()';
 execute 'create constraint trigger medical_catalog_taxonomy_guard after update on public.professions deferrable initially deferred for each row execute function specialty_taxonomy_private.medical_catalog_guard()';
 update specialty_taxonomy_private.runs set applied=true where id=run;
end;
$migrate$;
commit;
