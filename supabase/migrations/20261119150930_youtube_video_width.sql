-- Optional YouTube presentation width only; preserve video identity, documents, files and function grants.
CREATE OR REPLACE FUNCTION public.profile_detail_document_valid(v jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare item jsonb; attrs jsonb; text_doc jsonb:='[]'::jsonb; media_count integer:=0; seen text[]:='{}'; part text; nodes integer; crop_area jsonb; crop_key text;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>100000 or v->>'type' is distinct from 'doc' or (v-array['type','content'])<>'{}'::jsonb or jsonb_typeof(v->'content') is distinct from 'array' or jsonb_array_length(v->'content') not between 1 and 2500 then return false; end if;
 for item in select value from jsonb_array_elements(v->'content') loop
  if item->>'type' in ('profileMedia','youtubeVideo') then
   media_count:=media_count+1; attrs:=item->'attrs';
   if media_count>20 or (item-array['type','attrs'])<>'{}'::jsonb or jsonb_typeof(attrs) is distinct from 'object' then return false; end if;
   if item->>'type'='profileMedia' then
    if (attrs-array['fileId','mime','widthPercent','crop'])<>'{}'::jsonb or jsonb_typeof(attrs->'fileId') is distinct from 'string' or (attrs->>'fileId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(attrs->'mime') is distinct from 'string' or (attrs->>'mime')<>all(array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']) or (attrs->>'fileId')=any(seen) then return false; end if;
    if (attrs ? 'widthPercent' or attrs ? 'crop') and (attrs->>'mime') not like 'image/%' then return false; end if;
    if attrs ? 'widthPercent' and (jsonb_typeof(attrs->'widthPercent') is distinct from 'number' or (attrs->>'widthPercent')::numeric not between 10 and 100 or mod((attrs->>'widthPercent')::numeric,1)<>0) then return false; end if;
    if attrs ? 'crop' then
     crop_area:=attrs->'crop';
     if jsonb_typeof(crop_area) is distinct from 'object' or (crop_area-array['x','y','width','height'])<>'{}'::jsonb then return false; end if;
     foreach crop_key in array array['x','y','width','height'] loop
      if jsonb_typeof(crop_area->crop_key) is distinct from 'number' then return false; end if;
      if (crop_area->>crop_key)::numeric not between (case when crop_key in ('x','y') then 0 else 1 end) and 100 then return false; end if;
     end loop;
     if (crop_area->>'x')::numeric+(crop_area->>'width')::numeric>100.000001 or (crop_area->>'y')::numeric+(crop_area->>'height')::numeric>100.000001 then return false; end if;
    end if;
    seen:=array_append(seen,attrs->>'fileId');
   else
    if (attrs-array['videoId','widthPercent'])<>'{}'::jsonb or jsonb_typeof(attrs->'videoId') is distinct from 'string' or (attrs->>'videoId')!~'^[A-Za-z0-9_-]{11}$' then return false; end if;
    if attrs ? 'widthPercent' and (jsonb_typeof(attrs->'widthPercent') is distinct from 'number' or (attrs->>'widthPercent')::numeric not between 10 and 100 or mod((attrs->>'widthPercent')::numeric,1)<>0) then return false; end if;
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
end $function$
;
