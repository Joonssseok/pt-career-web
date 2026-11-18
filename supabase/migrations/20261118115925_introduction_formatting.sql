-- Approved 2026-11-18: introduction text and formatting storage; app deployment excluded.
-- Existing text, rows and permissions remain unchanged.
CREATE OR REPLACE FUNCTION public.profile_introduction_format_text(v jsonb, parent_type text DEFAULT 'root', nesting integer DEFAULT 0)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $fn$
DECLARE t text; a jsonb; m jsonb; ma jsonb; mt text; child jsonb; result text := ''; part text; n integer := 0; seen text[] := '{}'; sep text;
BEGIN
 IF nesting>12 OR jsonb_typeof(v) IS DISTINCT FROM 'object' OR (v-array['type','attrs','marks','text','content'])<>'{}'::jsonb OR jsonb_typeof(v->'type') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid introduction format' USING ERRCODE='22023'; END IF;
 t:=v->>'type';
 IF NOT (CASE WHEN parent_type='root' THEN t='doc' WHEN parent_type IN ('doc','blockquote') THEN t=ANY(array['paragraph','heading','bulletList','orderedList','blockquote','horizontalRule']) WHEN parent_type IN ('bulletList','orderedList') THEN t='listItem' WHEN parent_type='listItem' THEN t=ANY(array['paragraph','bulletList','orderedList','blockquote']) ELSE t=ANY(array['text','hardBreak']) END) THEN RAISE EXCEPTION 'Invalid introduction node' USING ERRCODE='22023'; END IF;
 a:=coalesce(v->'attrs','{}'::jsonb);
 IF jsonb_typeof(a) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid introduction attributes' USING ERRCODE='22023'; END IF;
 IF t IN ('paragraph','heading') THEN
  IF (a-(CASE WHEN t='heading' THEN array['level','textAlign'] ELSE array['textAlign'] END))<>'{}'::jsonb OR (t='heading' AND coalesce(a->'level','null'::jsonb) NOT IN ('2'::jsonb,'3'::jsonb)) THEN RAISE EXCEPTION 'Invalid paragraph' USING ERRCODE='22023'; END IF;
  IF a ? 'textAlign' AND a->'textAlign'<>'null'::jsonb AND (jsonb_typeof(a->'textAlign') IS DISTINCT FROM 'string' OR (a->>'textAlign')<>ALL(array['left','center','right'])) THEN RAISE EXCEPTION 'Invalid alignment' USING ERRCODE='22023'; END IF;
 ELSIF t='orderedList' THEN
  IF (a-array['start'])<>'{}'::jsonb OR (a ? 'start' AND a->'start'<>'null'::jsonb AND (jsonb_typeof(a->'start') IS DISTINCT FROM 'number' OR (a->>'start')!~'^[0-9]{1,3}$' OR (a->>'start')::integer<1)) THEN RAISE EXCEPTION 'Invalid list' USING ERRCODE='22023'; END IF;
 ELSIF a<>'{}'::jsonb THEN RAISE EXCEPTION 'Unexpected attributes' USING ERRCODE='22023'; END IF;
 IF t='text' THEN
  IF jsonb_typeof(v->'text') IS DISTINCT FROM 'string' OR length(v->>'text')=0 OR v ? 'content' THEN RAISE EXCEPTION 'Invalid text' USING ERRCODE='22023'; END IF;
  IF v ? 'marks' THEN
   IF jsonb_typeof(v->'marks') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'marks')>6 THEN RAISE EXCEPTION 'Invalid marks' USING ERRCODE='22023'; END IF;
   FOR m IN SELECT value FROM jsonb_array_elements(v->'marks') LOOP
    IF jsonb_typeof(m) IS DISTINCT FROM 'object' OR (m-array['type','attrs'])<>'{}'::jsonb OR jsonb_typeof(m->'type') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid mark' USING ERRCODE='22023'; END IF;
    mt:=m->>'type'; ma:=coalesce(m->'attrs','{}'::jsonb);
    IF mt=ANY(seen) OR jsonb_typeof(ma) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid mark attributes' USING ERRCODE='22023'; END IF; seen:=array_append(seen,mt);
    IF mt IN ('bold','italic','underline','strike') THEN
     IF ma<>'{}'::jsonb THEN RAISE EXCEPTION 'Unexpected mark attributes' USING ERRCODE='22023'; END IF;
    ELSIF mt='highlight' THEN
     IF (ma-array['color'])<>'{}'::jsonb OR jsonb_typeof(ma->'color') IS DISTINCT FROM 'string' OR lower(ma->>'color')<>ALL(array['#fef08a','#bbf7d0','#bfdbfe','#fbcfe8','#fed7aa']) THEN RAISE EXCEPTION 'Invalid highlight' USING ERRCODE='22023'; END IF;
    ELSIF mt='textStyle' THEN
     IF (ma-array['color','fontSize'])<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid text style' USING ERRCODE='22023'; END IF;
     IF ma ? 'color' AND ma->'color'<>'null'::jsonb AND (jsonb_typeof(ma->'color') IS DISTINCT FROM 'string' OR lower(ma->>'color')<>ALL(array['#111827','#2563eb','#166534','#9a3412','#7e22ce'])) THEN RAISE EXCEPTION 'Invalid text color' USING ERRCODE='22023'; END IF;
     IF ma ? 'fontSize' AND ma->'fontSize'<>'null'::jsonb AND (jsonb_typeof(ma->'fontSize') IS DISTINCT FROM 'string' OR (ma->>'fontSize')<>ALL(array['14px','16px','17px','18px','22px','28px','32px'])) THEN RAISE EXCEPTION 'Invalid font size' USING ERRCODE='22023'; END IF;
    ELSE RAISE EXCEPTION 'Unsupported mark' USING ERRCODE='22023'; END IF;
   END LOOP;
  END IF;
  RETURN v->>'text';
 END IF;
 IF v ? 'text' OR v ? 'marks' THEN RAISE EXCEPTION 'Unexpected text attributes' USING ERRCODE='22023'; END IF;
 IF t IN ('hardBreak','horizontalRule') THEN
  IF v ? 'content' THEN RAISE EXCEPTION 'Invalid leaf node' USING ERRCODE='22023'; END IF;
  RETURN CASE WHEN t='hardBreak' THEN chr(10) ELSE '' END;
 END IF;
 IF v ? 'content' AND jsonb_typeof(v->'content') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid content' USING ERRCODE='22023'; END IF;
 IF t IN ('doc','bulletList','orderedList','listItem','blockquote') AND coalesce(jsonb_array_length(v->'content'),0)=0 THEN RAISE EXCEPTION 'Empty block' USING ERRCODE='22023'; END IF;
 IF t='listItem' AND (v->'content'->0->>'type') IS DISTINCT FROM 'paragraph' THEN RAISE EXCEPTION 'Invalid list item' USING ERRCODE='22023'; END IF;
 sep:=CASE WHEN t IN ('doc','bulletList','orderedList','listItem','blockquote') THEN chr(10) ELSE '' END;
 FOR child IN SELECT value FROM jsonb_array_elements(coalesce(v->'content','[]'::jsonb)) LOOP
  part:=public.profile_introduction_format_text(child,t,nesting+1); result:=result || CASE WHEN n>0 THEN sep ELSE '' END || part; n:=n+1;
 END LOOP;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.profile_introduction_format_text(jsonb,text,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.profile_introduction_format_text(jsonb,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.profile_version_content_valid_plain(v jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare item jsonb; k text; group_key text; group_items jsonb; order_item jsonb;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>200000 then return false; end if;
 if (v - array['headline','introduction','sections','activities','order','excluded','activityRegion','currentWorkplace']::text[]) <> '{}'::jsonb then return false; end if;
 if v ? 'currentWorkplace' and v->'currentWorkplace' <> 'null'::jsonb then
  item:=v->'currentWorkplace';
  if jsonb_typeof(item) is distinct from 'object' then return false; end if;
  if (item - array['sourceActivityId','centerName','address','phone','websiteUrl']::text[]) <> '{}'::jsonb then return false; end if;
  foreach k in array array['sourceActivityId','centerName','address','phone','websiteUrl'] loop
   if jsonb_typeof(item->k) is distinct from 'string' then return false; end if;
  end loop;
  if (item->>'sourceActivityId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  if length(btrim(item->>'centerName'))=0 or length(item->>'centerName')>200 or length(item->>'address')>1000 then return false; end if;
  if (item->>'phone')<>'' and (item->>'phone') !~ '^[0-9+() .-]{1,30}$' then return false; end if;
  if length(item->>'websiteUrl')>1000 or ((item->>'websiteUrl')<>'' and ((item->>'websiteUrl') !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' or (item->>'websiteUrl') ~ '@')) then return false; end if;
 end if;
 if v ? 'activityRegion' and (jsonb_typeof(v->'activityRegion') is distinct from 'string' or not ((v->>'activityRegion')='' or (v->>'activityRegion')=any(array['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']))) then return false; end if;
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
   if jsonb_typeof(item->'presentation') is distinct from 'object' or ((item->'presentation') - array['title','organizer','period','description']::text[])<>'{}'::jsonb then return false; end if;
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


REVOKE ALL ON FUNCTION public.profile_version_content_valid_plain(jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.profile_version_content_valid_plain(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.profile_version_content_valid(v jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $fn$
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
END $fn$;
REVOKE ALL ON FUNCTION public.profile_version_content_valid(jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.profile_version_content_valid(jsonb) TO authenticated;

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
 return result;
end $function$;

-- Project only the validated, visible formatting snapshot; never raw draft JSON.
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
 ) || case when safe_expert->'introduction_document' is not null and safe_expert->'introduction_document'<>'null'::jsonb then jsonb_build_object('introductionDocument',safe_expert->'introduction_document') else '{}'::jsonb end || case when content ? 'activityRegion' then jsonb_build_object('activityRegion',content->'activityRegion') else '{}'::jsonb end,safe_expert,case when content->'sections' ? 'gallery' then gallery else '[]'::jsonb end
 from visible;

$function$;
