-- Optional per-profile display settings. No existing rows or publication states change.
-- Rollback application writes before reverting validation; retain private draft contents.
create or replace function public.profile_activity_public(a jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select case when a ? 'presentation' then a || jsonb_build_object(
 'title',case when (a->'presentation'->>'title')::boolean then a->>'title' else '' end,
 'organizer',case when (a->'presentation'->>'organizer')::boolean then coalesce(a->>'organizer','') else '' end,
 'period',case when (a->'presentation'->>'period')::boolean then a->>'period' else '' end,
 'description',case when a->'presentation'->>'description'='hidden' then '' else a->>'description' end,
 'learning','') else a end;
$$;
revoke all on function public.profile_activity_public(jsonb) from public,anon,authenticated;
create or replace function public.profile_activity_has_content(a jsonb)
returns boolean language sql immutable set search_path='' as $$
 select not(a ? 'presentation') or exists(
 select 1 from jsonb_each(public.profile_activity_public(a)-array['id','category','presentation','learning']::text[]) e
 where jsonb_typeof(e.value)='string' and btrim(e.value#>>'{}')<>'');
$$;
revoke all on function public.profile_activity_has_content(jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.profile_version_content_valid(v jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare item jsonb; k text; group_key text; group_items jsonb; order_item jsonb;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>200000 then return false; end if;
 if (v - array['headline','introduction','sections','activities','order','excluded']::text[]) <> '{}'::jsonb then return false; end if;
 if jsonb_typeof(v->'headline') is distinct from 'string' or length(v->>'headline')>100 then return false; end if;
 if jsonb_typeof(v->'introduction') is distinct from 'string' or length(v->>'introduction')>5000 then return false; end if;
 if jsonb_typeof(v->'sections') is distinct from 'array' or jsonb_typeof(v->'activities') is distinct from 'array' then return false; end if;
 if jsonb_array_length(v->'activities')>100 or jsonb_array_length(v->'sections')>5 then return false; end if;
 for item in select value from jsonb_array_elements(v->'sections') loop
  if jsonb_typeof(item) is distinct from 'string' or (item#>>'{}') not in ('experiences','academic_records','educations','licenses','gallery') then return false; end if;
 end loop;
 for item in select value from jsonb_array_elements(v->'activities') loop
  if jsonb_typeof(item) is distinct from 'object' or (item-array['id','category','title','period','description','learning','organizer','presentation']::text[])<>'{}'::jsonb then return false; end if;
  foreach k in array array['id','category','title','period','description','learning'] loop
   if jsonb_typeof(item->k) is distinct from 'string' or length(item->>k)>5000 then return false; end if;
  end loop;
  if item ? 'organizer' and (jsonb_typeof(item->'organizer') is distinct from 'string' or length(item->>'organizer')>1000) then return false; end if;
  if item ? 'presentation' then
   if jsonb_typeof(item->'presentation') is distinct from 'object' or (item->'presentation' - array['title','organizer','period','description']::text[])<>'{}'::jsonb then return false; end if;
   foreach k in array array['title','organizer','period'] loop
    if jsonb_typeof(item->'presentation'->k) is distinct from 'boolean' then return false; end if;
   end loop;
   if jsonb_typeof(item->'presentation'->'description') is distinct from 'string' or item->'presentation'->>'description' not in ('hidden','inline','expand') then return false; end if;
  end if;
  if length(btrim(item->>'title'))=0 then return false; end if;
 end loop;
 if v ? 'order' then
  if jsonb_typeof(v->'order') is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(v->'order')) > 120 then return false; end if;
  for group_key, group_items in select key,value from jsonb_each(v->'order') loop
   if length(group_key)>200 or jsonb_typeof(group_items) is distinct from 'array' then return false; end if;
   if jsonb_array_length(group_items)>200 then return false; end if;
   for order_item in select value from jsonb_array_elements(group_items) loop
    if jsonb_typeof(order_item) is distinct from 'string' or length(order_item#>>'{}')>10000 then return false; end if;
   end loop;
   if (select count(*) from jsonb_array_elements(group_items)) <> (select count(distinct value) from jsonb_array_elements(group_items)) then return false; end if;
  end loop;
 end if;
 if v ? 'excluded' then
  if jsonb_typeof(v->'excluded') is distinct from 'array' then return false; end if;
  if jsonb_array_length(v->'excluded')>500 then return false; end if;
  for item in select value from jsonb_array_elements(v->'excluded') loop
   if jsonb_typeof(item) is distinct from 'string' or length(item#>>'{}')>20000 then return false; end if;
  end loop;
 end if;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.get_representative_profiles(p_profile_ids uuid[])
 RETURNS TABLE(profile_id uuid, content jsonb, expert jsonb, gallery jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with raw(profile_id,content,expert,gallery) as (
 select v.profile_id,v.published_content,
 v.published_expert || jsonb_build_object(
 'licenses',d.licenses,
 'experiences',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'experiences') x where d.experiences @> jsonb_build_array(x.value)),'[]'::jsonb),
 'academic_records',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'academic_records') x where d.academic_records @> jsonb_build_array(x.value)),'[]'::jsonb),
 'educations',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'educations') x where d.educations @> jsonb_build_array(x.value)),'[]'::jsonb),
 'professions',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'professions') x where d.professions @> jsonb_build_array(x.value)),'[]'::jsonb),
 'specialties',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v.published_expert->'specialties') x where d.specialties @> jsonb_build_array(x.value)),'[]'::jsonb),
 'total_experience_years',case when v.published_expert->'experiences'=d.experiences then v.published_expert->'total_experience_years' else null end,
 'workplace_region',case when d.workplace_region is not null then v.published_expert->'workplace_region' else null end,
 'workplace_center_name',case when d.workplace_center_name is not null then v.published_expert->'workplace_center_name' else null end,
 'workplace_phone',case when d.workplace_phone is not null then v.published_expert->'workplace_phone' else null end,
 'workplace_address',case when d.workplace_address is not null then v.published_expert->'workplace_address' else null end,
 'workplace_address_detail',case when d.workplace_address_detail is not null then v.published_expert->'workplace_address_detail' else null end,
 'workplace_website_url',case when d.workplace_website_url is not null then v.published_expert->'workplace_website_url' else null end,
 'workplace_external_contact_url',case when d.workplace_external_contact_url is not null then v.published_expert->'workplace_external_contact_url' else null end
 ),
 coalesce((select jsonb_agg(img.value) from jsonb_array_elements(coalesce(v.published_gallery,'[]'::jsonb)) img join public.profile_gallery_images g on g.id::text=img.value->>'id' and g.profile_id=v.profile_id and g.owner_visible),'[]'::jsonb)
 from public.profile_versions v join public.profiles p on p.id=v.profile_id
 join public.public_expert_detail d on d.id=p.id
 where v.is_representative and v.profile_id=any(p_profile_ids)
 and p.is_public and p.owner_visible and p.verification_status='approved' and p.suspended_at is null and p.deletion_requested_at is null
 ), visible as (
 select r.*,public.profile_version_visible_expert(r.expert,r.content) as safe_expert,
 coalesce((select jsonb_agg(public.profile_activity_public(a.value) order by a.ordinality) from jsonb_array_elements(r.content->'activities') with ordinality a where not(coalesce(r.content->'excluded','[]'::jsonb) ? ('damoa:'||(a.value->>'id'))) and public.profile_activity_has_content(a.value)),'[]'::jsonb) as safe_activities
 from raw r
 )
 select profile_id,jsonb_build_object(
 'headline',content->'headline',
 'introduction',case when coalesce(content->'excluded','[]'::jsonb) ? 'introduction:0' then '""'::jsonb else content->'introduction' end,
 'sections',content->'sections',
 'activities',safe_activities,
 'order',public.profile_version_public_order(content->'order',safe_expert,safe_activities)
 ),safe_expert,case when content->'sections' ? 'gallery' then gallery else '[]'::jsonb end
 from visible;

$function$;

CREATE OR REPLACE FUNCTION public.public_profile_item_reviews(p_profile uuid)
 RETURNS TABLE(id uuid, title text, files jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select r.id,case when left(r.item_key,6)='damoa:' then coalesce(nullif(public.profile_review_target(r.item_key,p.content,p.expert)->>'title',''),'첨부 자료') else r.title end,coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name)) from public.damoa_files f where f.owner=r.owner_id and f.id=any(r.public_file_ids) and f.ready and not f.deleting),'[]'::jsonb)
 from public.get_representative_profiles(array[p_profile]) p
 join public.profile_versions v on v.profile_id=p_profile and v.is_representative
 join public.profile_item_reviews r on r.version_id=v.id and r.status='verified'
 where case when left(r.item_key,6)='damoa:' then
  public.profile_review_target(r.item_key,v.published_content,p.expert)=r.item_snapshot
  and public.profile_review_target(r.item_key,p.content,p.expert) is not null
 else public.profile_review_target(r.item_key,p.content,p.expert)=r.item_snapshot end;
$function$;
