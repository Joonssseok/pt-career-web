-- Optional per-version contacts. No row rewrites, new tables, or existing ACL changes.
begin;
create function public.profile_contact_inquiry_valid(c jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare field text; item jsonb; value text; location jsonb; authority text; host text; port_text text; address inet;
begin
 if jsonb_typeof(c) is distinct from 'object'
   or (c-array['inquiryLabel','inquiry','phone','email','address','location','detailAddress','mapVisible'])<>'{}'::jsonb
   or jsonb_typeof(c->'inquiryLabel') is distinct from 'string' or char_length(c->>'inquiryLabel')>24
   or c->>'inquiryLabel' ~ '[[:cntrl:]]'
   or jsonb_typeof(c->'detailAddress') is distinct from 'string' or char_length(c->>'detailAddress')>120
   or c->>'detailAddress' ~ '[[:cntrl:]]'
   or jsonb_typeof(c->'mapVisible') is distinct from 'boolean' or not (c ? 'location') then return false; end if;
 foreach field in array array['inquiry','phone','email','address'] loop
   item:=c->field;
   if jsonb_typeof(item) is distinct from 'object' or (item-array['value','visible'])<>'{}'::jsonb
     or jsonb_typeof(item->'value') is distinct from 'string' or jsonb_typeof(item->'visible') is distinct from 'boolean'
     or item->>'value' ~ '[[:cntrl:]]' then return false; end if;
   value:=item->>'value';
   if char_length(value)>(case when field='inquiry' then 500 when field='address' then 300 else 160 end) then return false; end if;
   if btrim(value)<>'' then
     if field='phone' and (btrim(value) !~ '^\+?[0-9 ()-]{7,25}$'
       or regexp_replace(btrim(value),'[ ()-]','','g') !~ '^\+?[0-9]{7,15}$') then return false; end if;
     if field='email' and value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false; end if;
     if field='inquiry' then
       if value ~ '[[:space:]<>"'']' or strpos(value,chr(92))>0 then return false; end if;
       authority:=substring(value from '(?i)^https?://([^/?#]+)');
       if authority is null or strpos(authority,'@')>0 then return false; end if;
       port_text:=null;
       if left(authority,1)='[' then
         host:=substring(authority from '^\[([^]]+)\]');
         if host is null then return false; end if;
         address:=host::inet;
         if family(address)<>6 then return false; end if;
         port_text:=substring(authority from '^\[[^]]+\]:(.*)$');
         if authority<>'['||host||']' and port_text is null then return false; end if;
       else
         host:=split_part(authority,':',1);
         if host='' or host !~ '^[[:alnum:]_.-]+$' then return false; end if;
         if strpos(authority,':')>0 then port_text:=substring(authority from ':(.*)$'); end if;
       end if;
       if port_text is not null and port_text<>'' and (port_text !~ '^[0-9]{1,5}$' or port_text::integer>65535) then return false; end if;
     end if;
   end if;
 end loop;
 location:=c->'location';
 if location='null'::jsonb then
   return c->'address'->>'value'='' and c->>'detailAddress'='' and not (c->>'mapVisible')::boolean;
 end if;
 if jsonb_typeof(location) is distinct from 'object' or (location-array['name','address','latitude','longitude'])<>'{}'::jsonb
   or jsonb_typeof(location->'name') is distinct from 'string' or char_length(location->>'name')>160
   or location->>'name' ~ '[[:cntrl:]]'
   or jsonb_typeof(location->'address') is distinct from 'string' or char_length(location->>'address')>300
   or btrim(location->>'address')='' or location->>'address' ~ '[[:cntrl:]]'
   or jsonb_typeof(location->'latitude') is distinct from 'number' or jsonb_typeof(location->'longitude') is distinct from 'number'
   or (location->>'latitude')::numeric not between -90 and 90 or (location->>'longitude')::numeric not between -180 and 180
   or ((location->>'latitude')::numeric=0 and (location->>'longitude')::numeric=0)
   or c->'address'->>'value' is distinct from location->>'address' then return false; end if;
 return true;
exception when others then return false;
end;
$$;

create function public.profile_contact_inquiry_public(c jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:='{}'::jsonb;
begin
 if c is null then return null; end if;
 if not public.profile_contact_inquiry_valid(c) then return '{}'::jsonb; end if;
 if (c->'inquiry'->>'visible')::boolean and btrim(c->'inquiry'->>'value')<>'' then
   result:=result||jsonb_build_object('inquiry',jsonb_build_object('label',coalesce(nullif(btrim(c->>'inquiryLabel'),''),'수업 문의하기'),'url',c->'inquiry'->>'value'));
 end if;
 if (c->'phone'->>'visible')::boolean and btrim(c->'phone'->>'value')<>'' then result:=result||jsonb_build_object('phone',btrim(c->'phone'->>'value')); end if;
 if (c->'email'->>'visible')::boolean and btrim(c->'email'->>'value')<>'' then result:=result||jsonb_build_object('email',btrim(c->'email'->>'value')); end if;
 if (c->'address'->>'visible')::boolean and btrim(c->'address'->>'value')<>'' then
   result:=result||jsonb_build_object('address',jsonb_build_object('base',btrim(c->'address'->>'value'),'detail',btrim(c->>'detailAddress')));
 end if;
 if (c->>'mapVisible')::boolean and c->'location'<>'null'::jsonb then
   result:=result||jsonb_build_object('map',jsonb_build_object('latitude',c->'location'->'latitude','longitude',c->'location'->'longitude'));
 end if;
 return result;
end;
$$;
revoke all on function public.profile_contact_inquiry_valid(jsonb),public.profile_contact_inquiry_public(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.profile_contact_inquiry_valid(jsonb),public.profile_contact_inquiry_public(jsonb) to authenticated,service_role;

create or replace function public.profile_version_content_valid(v jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>300000 then return false; end if;
 if v ? 'contactInquiry' and not public.profile_contact_inquiry_valid(v->'contactInquiry') then return false; end if;
 if not public.profile_version_content_valid_introduction(v-'detailDocument'-'contactInquiry') then return false; end if;
 return not (v ? 'detailDocument') or public.profile_detail_document_valid(v->'detailDocument');
exception when others then return false;
end;
$$;

create or replace function public.profile_version_visible_expert(expert jsonb,content jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
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
 if content ? 'currentWorkplace' then
  result:=result||jsonb_build_object(
   'workplace_center_name',nullif(content->'currentWorkplace'->>'centerName',''),
   'workplace_address',nullif(content->'currentWorkplace'->>'address',''),
   'workplace_phone',nullif(content->'currentWorkplace'->>'phone',''),
   'workplace_website_url',nullif(content->'currentWorkplace'->>'websiteUrl',''),
   'workplace_address_detail',null,'workplace_external_contact_url',null,'workplace_latitude',null,'workplace_longitude',null);
 end if;
 if coalesce(content->'excluded','[]'::jsonb) ? 'workplace:0' then
  foreach field in array array['workplace_region','workplace_center_name','workplace_address','workplace_address_detail','workplace_phone','workplace_website_url','workplace_external_contact_url','workplace_latitude','workplace_longitude'] loop result:=jsonb_set(result,array[field],'null'::jsonb); end loop;
 end if;
 if content ? 'activityRegion' then result:=jsonb_set(result,'{workplace_region}',coalesce(to_jsonb(nullif(content->>'activityRegion','')),'null'::jsonb)); end if;
 result:=result||jsonb_build_object('introduction_document',null);
 if not (coalesce(content->'excluded','[]'::jsonb) ? 'introduction:0') and content ? 'introductionDocument' and public.profile_version_content_valid(content) then
  result:=result||jsonb_build_object('introduction_document',content->'introductionDocument');
 end if;
 result:=result||jsonb_build_object('detail_document',null);
 if content ? 'detailDocument' and public.profile_detail_document_valid(content->'detailDocument') then result:=result||jsonb_build_object('detail_document',content->'detailDocument'); end if;
 -- Never trust previously stored contact projections; rebuild only the closed public DTO.
 return (result-'contactInquiry'-'contact_inquiry')||jsonb_build_object('contact_inquiry',public.profile_contact_inquiry_public(content->'contactInquiry'));
end;
$$;
commit;
