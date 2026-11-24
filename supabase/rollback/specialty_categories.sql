-- Restore only this migration's unchanged data. Any subsequent conflicting edit
-- aborts the entire rollback; never delete a member's new hospital selection.
-- Private backups and new columns remain. A newly created hospital row stays inactive.
begin;
select pg_advisory_xact_lock(231123,1);
lock table public.profiles,public.profile_specialties,public.profile_professions,
 public.specialties,public.professions,public.profile_versions in access exclusive mode;
do $rollback$
declare migration_run specialty_taxonomy_private.runs; item record; catalog_ids uuid[]; group_ids uuid[]; stage_base bigint;
begin
 select * into migration_run from specialty_taxonomy_private.runs where applied order by created_at desc limit 1;
 if not found then return;end if;
 select array_agg(id) into catalog_ids from specialty_taxonomy_private.catalog_backup where run_id=migration_run.id;
 select array_agg(id) into group_ids from specialty_taxonomy_private.catalog_backup where run_id=migration_run.id and slug in('sports-performance','conditioning','sport-specific-training');
 if exists(select 1 from specialty_taxonomy_private.catalog_backup b left join public.specialties s on s.id=b.id
  where b.run_id=migration_run.id and (s.id is null or s.slug is distinct from b.slug or b.after_value is distinct from jsonb_build_object(
   'name',s.name,'sort_order',s.sort_order,'is_active',s.is_active,'medical_technician_only',s.medical_technician_only)))
  or not exists(select 1 from public.professions where id=migration_run.medical_profession_id and is_medical_technician)
  then raise exception 'specialty_taxonomy_rollback_conflict: catalog';end if;
 if exists(select 1 from public.specialties s where not(s.id=any(catalog_ids)) and s.id<>migration_run.hospital_id
  and (s.name in(select before_value->>'name' from specialty_taxonomy_private.catalog_backup where run_id=migration_run.id)
   or s.sort_order in(select (before_value->>'sort_order')::integer from specialty_taxonomy_private.catalog_backup where run_id=migration_run.id))) then
  raise exception 'specialty_taxonomy_rollback_conflict: new catalog collision';end if;
 if exists(select 1 from public.profile_specialties where specialty_id=migration_run.hospital_id) then
  raise exception 'specialty_taxonomy_rollback_conflict: hospital selection';end if;
 if not migration_run.hospital_preexisting and not exists(select 1 from public.specialties where id=migration_run.hospital_id
  and slug='hospital-work' and name='병원 근무' and sort_order=11 and is_active and medical_technician_only) then
  raise exception 'specialty_taxonomy_rollback_conflict: hospital catalog';end if;
 if exists(
  (select profile_id,specialty_id,is_primary,display_order,owner_visible,created_at from public.profile_specialties
    where specialty_id=any(group_ids) and profile_id in(select profile_id from specialty_taxonomy_private.selection_before where run_id=migration_run.id)
   except select profile_id,specialty_id,is_primary,display_order,owner_visible,created_at from specialty_taxonomy_private.selection_after where run_id=migration_run.id)
  union all
  (select profile_id,specialty_id,is_primary,display_order,owner_visible,created_at from specialty_taxonomy_private.selection_after where run_id=migration_run.id
   except select profile_id,specialty_id,is_primary,display_order,owner_visible,created_at from public.profile_specialties
    where specialty_id=any(group_ids) and profile_id in(select profile_id from specialty_taxonomy_private.selection_before where run_id=migration_run.id))
 ) then raise exception 'specialty_taxonomy_rollback_conflict: selections';end if;
 if exists(select 1 from specialty_taxonomy_private.snapshot_backup b left join public.profile_versions v on v.id=b.version_id
   where b.run_id=migration_run.id and (v.id is null or v.published_expert->'specialties' is distinct from b.after_value))
  or exists(select 1 from public.profile_versions v where jsonb_typeof(v.published_expert->'specialties')='array'
   and not exists(select 1 from specialty_taxonomy_private.snapshot_backup b where b.run_id=migration_run.id and b.version_id=v.id)
   and exists(select 1 from jsonb_array_elements(v.published_expert->'specialties') j where j->>'slug' in(
    select slug from specialty_taxonomy_private.catalog_backup where run_id=migration_run.id union all select 'hospital-work')))
  then raise exception 'specialty_taxonomy_rollback_conflict: snapshots';end if;
 for item in select * from specialty_taxonomy_private.function_backup where run_id=migration_run.id loop
  if pg_get_functiondef(item.signature::regprocedure) is distinct from item.after_definition then
   raise exception 'specialty_taxonomy_rollback_conflict: writer definition';end if;
 end loop;
 -- All conflict checks precede writes, within one transaction and the same locks.
 drop trigger a_specialty_taxonomy_guard on public.profile_specialties;
 drop trigger a_profession_taxonomy_lock on public.profile_professions;
 drop trigger profession_medical_taxonomy_guard on public.profile_professions;
 drop trigger medical_catalog_taxonomy_guard on public.professions;
 for item in select * from specialty_taxonomy_private.function_backup where run_id=migration_run.id loop execute item.before_definition;end loop;
 delete from public.profile_specialties where specialty_id=any(group_ids)
  and profile_id in(select profile_id from specialty_taxonomy_private.selection_before where run_id=migration_run.id);
 insert into public.profile_specialties(profile_id,specialty_id,is_primary,display_order,owner_visible,created_at)
  select profile_id,specialty_id,is_primary,display_order,owner_visible,created_at
  from specialty_taxonomy_private.selection_before where run_id=migration_run.id;
 update public.profile_versions v set published_expert=jsonb_set(v.published_expert,'{specialties}',b.before_value,false)
  from specialty_taxonomy_private.snapshot_backup b where b.run_id=migration_run.id and b.version_id=v.id;
 select coalesce(max(sort_order),0)::bigint+100 into stage_base from public.specialties;
 if stage_base+20>2147483647 then raise exception 'specialty_taxonomy_sort_overflow';end if;
 for item in select id,slug,row_number() over(order by slug) n from public.specialties where id=any(catalog_ids) or id=migration_run.hospital_id loop
  update public.specialties set name='__rollback_'||migration_run.id::text||'_'||item.slug,sort_order=(stage_base+item.n)::integer where id=item.id;
 end loop;
 for item in select * from specialty_taxonomy_private.catalog_backup where run_id=migration_run.id loop
  update public.specialties set name=item.before_value->>'name',sort_order=(item.before_value->>'sort_order')::integer,
   is_active=(item.before_value->>'is_active')::boolean,medical_technician_only=(item.before_value->>'medical_technician_only')::boolean where id=item.id;
 end loop;
 if not migration_run.hospital_preexisting then
  update public.specialties set name='병원 근무',sort_order=(select max(sort_order)+1 from public.specialties where id<>migration_run.hospital_id),is_active=false where id=migration_run.hospital_id;
 end if;
 update public.professions set is_medical_technician=migration_run.old_medical where id=migration_run.medical_profession_id;
 update specialty_taxonomy_private.runs set applied=false,rolled_back_at=clock_timestamp() where id=migration_run.id;
end;
$rollback$;
commit;
