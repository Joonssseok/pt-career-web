-- Privacy-preserving rollback: disable the new public contact card only.
-- Keep the optional contact validator and both pure helpers with their narrow ACLs.
-- Contact-bearing drafts remain editable; saved private/published JSON is untouched.
-- Strip stored contact values; explicit configuration keeps {} to suppress legacy CTAs.
-- Profiles without contactInquiry retain the legacy absence/fallback behavior.
-- Existing getter stays an allowlist and never returns full contactInquiry.
begin;
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
 return (result-'contactInquiry'-'contact_inquiry')||case when content ? 'contactInquiry'
   then jsonb_build_object('contact_inquiry','{}'::jsonb) else '{}'::jsonb end;
end $function$
;
commit;
