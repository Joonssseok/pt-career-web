-- Enable explicit owner-controlled publication. No existing profile is published by this migration.
-- Application rollback: disable LIVE_PROFILE_PUBLISH_ENABLED; keep snapshots and drafts.
-- Add optional per-profile layout order. No existing rows or access policies change.
-- Rollback: revert application reads/writes; retain stored order to avoid losing work.
create or replace function public.profile_version_content_valid(v jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
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
  if jsonb_typeof(item) is distinct from 'object' or (item-array['id','category','title','period','description','learning']::text[])<>'{}'::jsonb then return false; end if;
  foreach k in array array['id','category','title','period','description','learning'] loop
   if jsonb_typeof(item->k) is distinct from 'string' or length(item->>k)>5000 then return false; end if;
  end loop;
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
end $$;
revoke all on function public.profile_version_content_valid(jsonb) from public;
grant execute on function public.profile_version_content_valid(jsonb) to authenticated;

-- Private exclusion identities are evaluated before any anonymous projection.
create or replace function public.profile_version_item_visible(excluded jsonb, section text, item jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare entry jsonb; identity jsonb; value text;
begin
 for entry in select * from jsonb_array_elements(coalesce(excluded,'[]'::jsonb)) loop
  value := entry#>>'{}';
  if left(value,length(section)+1)=section||':' then
   begin
    identity := substring(value from length(section)+2)::jsonb;
    if section='licenses' then
     if identity - array['id','document_public'] = item - array['id','document_public'] then return false; end if;
    elsif identity=item then return false; end if;
   exception when invalid_text_representation then null;
   end;
  end if;
 end loop;
 return true;
end $$;
revoke all on function public.profile_version_item_visible(jsonb,text,jsonb) from public;

create or replace function public.profile_version_visible_expert(expert jsonb, content jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=expert; section text; rows jsonb; field text;
begin
 foreach section in array array['experiences','academic_records','educations','licenses'] loop
  rows:='[]'::jsonb;
  if content->'sections' ? section then
   select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into rows
   from jsonb_array_elements(coalesce(expert->section,'[]'::jsonb)) with ordinality
   where public.profile_version_item_visible(content->'excluded',section,value);
  end if;
  result:=jsonb_set(result,array[section],rows);
 end loop;
 if result->'experiences' is distinct from expert->'experiences' then result:=jsonb_set(result,'{total_experience_years}','null'::jsonb); end if;
 if coalesce(content->'excluded','[]'::jsonb) ? 'introduction:0' then result:=jsonb_set(result,'{introduction}','null'::jsonb); end if;
 if coalesce(content->'excluded','[]'::jsonb) ? 'workplace:0' then
  foreach field in array array['workplace_region','workplace_center_name','workplace_address','workplace_address_detail','workplace_phone','workplace_website_url','workplace_external_contact_url','workplace_latitude','workplace_longitude'] loop result:=jsonb_set(result,array[field],'null'::jsonb); end loop;
 end if;
 return result;
end $$;
revoke all on function public.profile_version_visible_expert(jsonb,jsonb) from public;

-- Order keys used by the editor can contain row text. Never return keys for hidden rows.
create or replace function public.profile_version_public_order(ordering jsonb, expert jsonb, activities jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='{}'::jsonb; group_name text; keys jsonb; entry jsonb; key_text text; identity jsonb; allowed jsonb; kept jsonb; permitted boolean;
begin
 for group_name,keys in select key,value from jsonb_each(coalesce(ordering,'{}'::jsonb)) loop
  kept:='[]'::jsonb;
  if group_name='sections' then
   select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into kept
   from jsonb_array_elements(keys) with ordinality
   where value#>>'{}' in ('specialties','introduction','experiences','academic_records','educations','licenses','gallery','workplace')
    or exists(select 1 from jsonb_array_elements(activities) a where 'activity:'||(a->>'category')=value#>>'{}');
  else
   if group_name in ('experiences','academic_records','educations','licenses','specialties') then allowed:=coalesce(expert->group_name,'[]'::jsonb);
   elsif left(group_name,9)='activity:' then select coalesce(jsonb_agg(value),'[]'::jsonb) into allowed from jsonb_array_elements(activities) where value->>'category'=substring(group_name from 10);
   else continue; end if;
   for entry in select value from jsonb_array_elements(keys) loop
    key_text:=entry#>>'{}'; permitted:=false;
    select exists(select 1 from jsonb_array_elements(allowed) a where a->>'id'=key_text or a->>'slug'=key_text) into permitted;
    if not permitted then
     begin identity:=key_text::jsonb; permitted:=allowed @> jsonb_build_array(identity); exception when invalid_text_representation then permitted:=false; end;
    end if;
    if permitted then kept:=kept||jsonb_build_array(key_text); end if;
   end loop;
  end if;
  if jsonb_array_length(kept)>0 then result:=jsonb_set(result,array[group_name],kept); end if;
 end loop;
 return result;
end $$;
revoke all on function public.profile_version_public_order(jsonb,jsonb,jsonb) from public;

-- Keep search text aligned on explicit publish, and respect live privacy controls.
create or replace function public.publish_profile_version(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.profiles%rowtype; v public.profile_versions%rowtype; snapshot jsonb; gallery jsonb;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 select * into p from public.profiles where user_id=uid for update;
 if p.id is null then raise exception '프로필이 없습니다.'; end if;
 if p.suspended_at is not null or p.deletion_requested_at is not null then raise exception '현재 공개할 수 없는 계정입니다.'; end if;
 if p.verification_status<>'approved' or not p.is_public then raise exception '기본 프로필 공개 승인이 먼저 필요합니다.'; end if;
 select * into v from public.profile_versions where id=p_id and owner_id=uid and profile_id=p.id for update;
 if v.id is null then raise exception '공개할 프로필을 찾을 수 없습니다.'; end if;
 update public.profiles set owner_visible=true, headline=v.draft_content->>'headline', introduction=case when coalesce(v.draft_content->'excluded','[]'::jsonb) ? 'introduction:0' then null else v.draft_content->>'introduction' end where id=p.id;
 select to_jsonb(d) into snapshot from public.public_expert_detail d where d.id=p.id;
 if snapshot is null then raise exception '공개 조건을 확인하지 못했습니다.'; end if;
 snapshot:=public.profile_version_visible_expert(snapshot,v.draft_content);
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'imagePath',g.image_path,'caption',coalesce(g.caption,'')) order by g.display_order),'[]'::jsonb) into gallery from public.profile_gallery_images g where g.profile_id=p.id and g.owner_visible;
 update public.profile_versions set is_representative=false where owner_id=uid and is_representative;
 update public.profile_versions set is_representative=true,published_content=draft_content,published_expert=snapshot,published_gallery=gallery,published_at=now() where id=v.id;
end $$;
revoke all on function public.publish_profile_version(uuid) from public;
grant execute on function public.publish_profile_version(uuid) to authenticated;


-- Public reads honor current privacy/revocation settings even for old snapshots.
create or replace function public.get_representative_profiles(p_profile_ids uuid[])
returns table(profile_id uuid,content jsonb,expert jsonb,gallery jsonb)
language sql stable security definer set search_path='' as $$
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
 coalesce((select jsonb_agg(a.value order by a.ordinality) from jsonb_array_elements(r.content->'activities') with ordinality a where not(coalesce(r.content->'excluded','[]'::jsonb) ? ('damoa:'||(a.value->>'id')))),'[]'::jsonb) as safe_activities
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

$$;
revoke all on function public.get_representative_profiles(uuid[]) from public;
grant execute on function public.get_representative_profiles(uuid[]) to anon,authenticated;
