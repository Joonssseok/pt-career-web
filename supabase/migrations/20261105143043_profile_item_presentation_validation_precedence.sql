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
