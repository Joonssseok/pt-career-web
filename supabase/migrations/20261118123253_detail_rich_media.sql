-- Detail rich media: existing owner checks, private bucket, 20 MiB/file and 200 MiB/account retained.
alter table public.profile_detail_uploads drop constraint profile_detail_uploads_mime_check;
alter table public.profile_detail_uploads add constraint profile_detail_uploads_mime_check check(mime in ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'));
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'] where id='profile-detail-images' and not public and file_size_limit=20971520;

create or replace function public.profile_detail_document_valid(v jsonb)
returns boolean language plpgsql immutable set search_path='' as $detail$
declare item jsonb; attrs jsonb; text_doc jsonb:='[]'::jsonb; media_count integer:=0; seen text[]:='{}'; part text; nodes integer;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>100000 or v->>'type' is distinct from 'doc' or (v-array['type','content'])<>'{}'::jsonb or jsonb_typeof(v->'content') is distinct from 'array' or jsonb_array_length(v->'content') not between 1 and 2500 then return false; end if;
 for item in select value from jsonb_array_elements(v->'content') loop
  if item->>'type' in ('profileMedia','youtubeVideo') then
   media_count:=media_count+1; attrs:=item->'attrs';
   if media_count>20 or (item-array['type','attrs'])<>'{}'::jsonb or jsonb_typeof(attrs) is distinct from 'object' then return false; end if;
   if item->>'type'='profileMedia' then
    if (attrs-array['fileId','mime'])<>'{}'::jsonb or jsonb_typeof(attrs->'fileId') is distinct from 'string' or (attrs->>'fileId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(attrs->'mime') is distinct from 'string' or (attrs->>'mime')<>all(array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']) or (attrs->>'fileId')=any(seen) then return false; end if;
    seen:=array_append(seen,attrs->>'fileId');
   else
    if (attrs-array['videoId'])<>'{}'::jsonb or jsonb_typeof(attrs->'videoId') is distinct from 'string' or (attrs->>'videoId')!~'^[A-Za-z0-9_-]{11}$' then return false; end if;
   end if;
   text_doc:=text_doc||jsonb_build_array(jsonb_build_object('type','paragraph'));
  else text_doc:=text_doc||jsonb_build_array(item);
  end if;
 end loop;
 text_doc:=jsonb_build_object('type','doc','content',text_doc);
 part:=public.profile_introduction_format_text(text_doc);
 if length(part)>5000 then return false; end if;
 with recursive tree(node) as (
 select text_doc union all select item.value from tree cross join lateral jsonb_array_elements(coalesce(tree.node->'content','[]'::jsonb)) item
 ) select count(*) into nodes from tree;
 return nodes<=2500;
exception when others then return false;
end $detail$;
revoke all on function public.profile_detail_document_valid(jsonb) from public,anon;
grant execute on function public.profile_detail_document_valid(jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.profile_version_content_valid_introduction(v jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE text_value text; nodes integer;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR octet_length(v::text)>200000 THEN RETURN false; END IF;
 IF NOT public.profile_version_content_valid_plain(v-'introductionDocument') THEN RETURN false; END IF;
 IF NOT (v ? 'introductionDocument') THEN RETURN true; END IF;
 IF jsonb_typeof(v->'introductionDocument') IS DISTINCT FROM 'object' OR octet_length((v->'introductionDocument')::text)>100000 THEN RETURN false; END IF;
 text_value:=public.profile_introduction_format_text(v->'introductionDocument');
 IF length(text_value)>5000 OR text_value IS DISTINCT FROM v->>'introduction' THEN RETURN false; END IF;
 WITH RECURSIVE tree(node) AS (
  SELECT v->'introductionDocument'
  UNION ALL SELECT item.value FROM tree CROSS JOIN LATERAL jsonb_array_elements(coalesce(tree.node->'content','[]'::jsonb)) item
 ) SELECT count(*) INTO nodes FROM tree;
 RETURN nodes<=2500;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $function$
;
revoke all on function public.profile_version_content_valid_introduction(jsonb) from public,anon;
grant execute on function public.profile_version_content_valid_introduction(jsonb) to authenticated;
create or replace function public.profile_version_content_valid(v jsonb) returns boolean language plpgsql immutable set search_path='' as $valid$
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>300000 then return false; end if;
 if not public.profile_version_content_valid_introduction(v-'detailDocument') then return false; end if;
 return not (v ? 'detailDocument') or public.profile_detail_document_valid(v->'detailDocument');
exception when others then return false;
end $valid$;
CREATE OR REPLACE FUNCTION public.save_profile_version(p_id uuid, p_title text, p_content jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); pid uuid; result uuid; asset jsonb;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 80 then raise exception '관리용 제목은 1~80자로 입력해주세요.'; end if;
 if not public.profile_version_content_valid(p_content) then raise exception '프로필 입력 형식을 확인해주세요.'; end if;
 if p_content ? 'detailDocument' then
  for asset in select value from jsonb_array_elements(p_content->'detailDocument'->'content') where value->>'type'='profileMedia' loop
   if not exists(select 1 from public.profile_detail_uploads f where f.owner_id=uid and f.id=(asset->'attrs'->>'fileId')::uuid and f.mime=asset->'attrs'->>'mime' and f.ready and not f.deleting) then raise exception '본인의 업로드 완료 파일만 넣을 수 있습니다.'; end if;
  end loop;
 end if;
 select id into pid from public.profiles where user_id=uid;
 if pid is null then raise exception '먼저 기본 정보와 기존 프로필을 작성해주세요.'; end if;
 if p_id is null then
  insert into public.profile_versions(profile_id,owner_id,title,draft_content) values(pid,uid,btrim(p_title),p_content) returning id into result;
 else
  update public.profile_versions set title=btrim(p_title),draft_content=p_content,updated_at=now() where id=p_id and owner_id=uid returning id into result;
  if result is null then raise exception '수정할 프로필을 찾을 수 없습니다.'; end if;
 end if;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION public.save_profile_with_detail_images(p_id uuid, p_title text, p_content jsonb, p_files uuid[], p_expected timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); result uuid; old public.profile_detail_attachments; f uuid;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 if p_files is null or cardinality(p_files)>20 or cardinality(p_files)<>(select count(distinct x) from unnest(p_files) x) then raise exception '첨부 이미지를 확인해주세요.'; end if;
 foreach f in array p_files loop
  if not exists(select 1 from public.profile_detail_uploads f1 where f1.owner_id=u and f1.id=f and f1.ready and not f1.deleting) then raise exception '본인의 업로드 완료 이미지만 저장할 수 있습니다.'; end if;
 end loop;
 if p_id is not null then
  perform 1 from public.profile_versions where id=p_id and owner_id=u for update;
  if not found then raise exception '본인의 프로필만 수정할 수 있습니다.'; end if;
  select * into old from public.profile_detail_attachments where version_id=p_id for update;
  if old.updated_at is distinct from p_expected then raise exception '다른 창에서 첨부파일이 변경되었습니다. 새로고침해주세요.'; end if;
 end if;
 if p_content ? 'detailDocument' and exists(select 1 from jsonb_array_elements(p_content->'detailDocument'->'content') asset where asset->>'type'='profileMedia' and not ((asset->'attrs'->>'fileId')::uuid=any(p_files))) then raise exception '상세소개 첨부파일을 함께 저장해주세요.'; end if;
 result:=public.save_profile_version(p_id,p_title,p_content);
 insert into public.profile_detail_attachments(version_id,owner_id,draft_file_ids) values(result,u,p_files)
 on conflict(version_id) do update set draft_file_ids=excluded.draft_file_ids,updated_at=clock_timestamp();
 return jsonb_build_object('id',result,'revision',(select updated_at from public.profile_detail_attachments where version_id=result));
end $function$
;
CREATE OR REPLACE FUNCTION public.profile_version_visible_expert(expert jsonb, content jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
 -- Only the explicitly selected, saved profile snapshot is published; never read Damoa here.
 if content ? 'currentWorkplace' then
  result:=result || jsonb_build_object(
   'workplace_center_name',nullif(content->'currentWorkplace'->>'centerName',''),
   'workplace_address',nullif(content->'currentWorkplace'->>'address',''),
   'workplace_phone',nullif(content->'currentWorkplace'->>'phone',''),
   'workplace_website_url',nullif(content->'currentWorkplace'->>'websiteUrl',''),
   'workplace_address_detail',null,'workplace_external_contact_url',null,
   'workplace_latitude',null,'workplace_longitude',null);
 end if;
 if coalesce(content->'excluded','[]'::jsonb) ? 'workplace:0' then
  foreach field in array array['workplace_region','workplace_center_name','workplace_address','workplace_address_detail','workplace_phone','workplace_website_url','workplace_external_contact_url','workplace_latitude','workplace_longitude'] loop result:=jsonb_set(result,array[field],'null'::jsonb); end loop;
 end if;
 if content ? 'activityRegion' then result:=jsonb_set(result,'{workplace_region}',coalesce(to_jsonb(nullif(content->>'activityRegion','')),'null'::jsonb)); end if;
 result:=result || jsonb_build_object('introduction_document',null);
 if not (coalesce(content->'excluded','[]'::jsonb) ? 'introduction:0') and content ? 'introductionDocument' and public.profile_version_content_valid(content) then
  result:=result || jsonb_build_object('introduction_document',content->'introductionDocument');
 end if;
 result:=result || jsonb_build_object('detail_document',null);
 if content ? 'detailDocument' and public.profile_detail_document_valid(content->'detailDocument') then result:=result || jsonb_build_object('detail_document',content->'detailDocument'); end if;
 return result;
end $function$
;
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
 ) || case when safe_expert->'introduction_document' is not null and safe_expert->'introduction_document'<>'null'::jsonb then jsonb_build_object('introductionDocument',safe_expert->'introduction_document') else '{}'::jsonb end || case when safe_expert->'detail_document' is not null and safe_expert->'detail_document'<>'null'::jsonb then jsonb_build_object('detailDocument',safe_expert->'detail_document') else '{}'::jsonb end || case when content ? 'activityRegion' then jsonb_build_object('activityRegion',content->'activityRegion') else '{}'::jsonb end,safe_expert,case when content->'sections' ? 'gallery' then gallery else '[]'::jsonb end
 from visible;

$function$
;
CREATE OR REPLACE FUNCTION profile_images_internal.publish_detail_images()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.published_content ? 'detailDocument' then
  if not public.profile_detail_document_valid(new.published_content->'detailDocument') then raise exception '상세소개 형식을 확인해주세요.'; end if;
  if exists(select 1 from jsonb_array_elements(new.published_content->'detailDocument'->'content') asset where asset->>'type'='profileMedia' and not exists (
   select 1 from public.profile_detail_attachments a join public.profile_detail_uploads f on f.owner_id=a.owner_id and f.id=any(a.draft_file_ids) where a.version_id=new.id and a.owner_id=new.owner_id and f.id=(asset->'attrs'->>'fileId')::uuid and f.mime=asset->'attrs'->>'mime' and f.ready and not f.deleting
  )) then raise exception '상세소개 파일을 저장한 뒤 게시해주세요.'; end if;
 end if;
 update public.profile_detail_attachments set published_file_ids=draft_file_ids where version_id=new.id;
 return new;
end $function$
;
