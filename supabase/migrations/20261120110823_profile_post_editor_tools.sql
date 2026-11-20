-- Additive posts-only editor validation. No data rewrites or public privilege changes.
begin;
create function posts_private.editor_link_valid(v text) returns boolean
language plpgsql immutable set search_path='' as $$
declare authority text; host text; port_text text; address inet;
begin
 if v is null or char_length(v)>2048 or v ~ '[[:cntrl:] <>]' or strpos(v,chr(92))>0 then return false; end if;
 authority:=substring(v from '(?i)^https?://([^/?#]+)');
 if authority is null or strpos(authority,'@')>0 then return false; end if;
 if left(authority,1)='[' then
   host:=substring(authority from '^\[([^]]+)\]');
   if host is null then return false; end if;
   address:=host::inet;
   if family(address)<>6 then return false; end if;
   port_text:=substring(authority from '^\[[^]]+\]:(.*)$');
   if authority<>'['||host||']' and port_text is null then return false; end if;
 else
   host:=split_part(authority,':',1);
   if host='' or host !~ '^[A-Za-z0-9_.-]+$' then return false; end if;
   if strpos(authority,':')>0 then port_text:=substring(authority from ':(.*)$'); end if;
 end if;
 if port_text is not null and port_text<>'' and (port_text !~ '^[0-9]{1,5}$' or port_text::integer>65535) then return false; end if;
 return true;
exception when others then return false;
end;
$$;

create function posts_private.editor_node_valid(v jsonb,parent text,depth integer default 0) returns boolean
language plpgsql immutable set search_path='' as $$
declare t text; a jsonb; child jsonb; children jsonb; allowed text[]; mark jsonb; ma jsonb; mt text;
 seen text[]:='{}'; crop jsonb; key text; part jsonb;
begin
 if parent is null or depth is null or depth<0 or depth>16 or jsonb_typeof(v) is distinct from 'object'
   or (v-array['type','attrs','content','marks','text'])<>'{}'::jsonb or jsonb_typeof(v->'type') is distinct from 'string' then return false; end if;
 t:=v->>'type';
 allowed:=case
   when parent='root' then array['doc']
   when parent='doc' then array['paragraph','heading','bulletList','orderedList','blockquote','horizontalRule','codeBlock','table','profileMedia','youtubeVideo']
   when parent='table' then array['tableRow']
   when parent='tableRow' then array['tableCell','tableHeader']
   when parent in ('blockquote','listItem','tableCell','tableHeader') then array['paragraph','heading','bulletList','orderedList','blockquote','horizontalRule','codeBlock']
   when parent in ('bulletList','orderedList') then array['listItem']
   when parent='codeBlock' then array['text']
   when parent in ('paragraph','heading') then array['text','hardBreak']
   else array[]::text[] end;
 if not (t=any(allowed)) then return false; end if;
 a:=case when v->'attrs' is null or v->'attrs'='null'::jsonb then '{}'::jsonb else v->'attrs' end;
 if jsonb_typeof(a) is distinct from 'object' then return false; end if;
 if t in ('paragraph','heading') then
   if (a-case when t='heading' then array['level','textAlign'] else array['textAlign'] end)<>'{}'::jsonb then return false; end if;
   if t='heading' and (jsonb_typeof(a->'level') is distinct from 'number' or (a->>'level')::numeric not in (2,3)) then return false; end if;
   if a ? 'textAlign' and a->'textAlign'<>'null'::jsonb and a->>'textAlign' not in ('left','center','right','justify') then return false; end if;
 elsif t='orderedList' then
   if (a-array['start'])<>'{}'::jsonb then return false; end if;
   if a ? 'start' and a->'start'<>'null'::jsonb and (jsonb_typeof(a->'start') is distinct from 'number'
     or (a->>'start')::numeric not between 1 and 999 or mod((a->>'start')::numeric,1)<>0) then return false; end if;
 elsif t='codeBlock' then
   if (a-array['language'])<>'{}'::jsonb or (a ? 'language' and a->'language'<>'null'::jsonb
     and (jsonb_typeof(a->'language') is distinct from 'string' or (a->>'language')!~'^[-a-zA-Z0-9_+#.]{1,30}$')) then return false; end if;
 elsif t in ('tableCell','tableHeader') then
   if (a-array['colspan','rowspan','colwidth'])<>'{}'::jsonb then return false; end if;
   foreach key in array array['colspan','rowspan'] loop
     if a ? key and a->key<>'null'::jsonb and (jsonb_typeof(a->key) is distinct from 'number'
       or mod((a->>key)::numeric,1)<>0 or (a->>key)::numeric not between 1 and (case when key='colspan' then 100 else 200 end)) then return false; end if;
   end loop;
   if a ? 'colwidth' and a->'colwidth'<>'null'::jsonb then
     if jsonb_typeof(a->'colwidth') is distinct from 'array' or jsonb_array_length(a->'colwidth')>100 then return false; end if;
     for part in select value from jsonb_array_elements(a->'colwidth') loop
       if jsonb_typeof(part) is distinct from 'number' or part::text::numeric not between 25 and 2000 or mod(part::text::numeric,1)<>0 then return false; end if;
     end loop;
   end if;
 elsif t='profileMedia' then
   if (a-array['fileId','mime','widthPercent','crop'])<>'{}'::jsonb or jsonb_typeof(a->'fileId') is distinct from 'string'
     or (a->>'fileId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or a->>'mime' is null or a->>'mime' not in ('image/jpeg','image/png','image/webp','image/gif') then return false; end if;
   if a ? 'widthPercent' and (jsonb_typeof(a->'widthPercent') is distinct from 'number'
     or (a->>'widthPercent')::numeric not between 10 and 100 or mod((a->>'widthPercent')::numeric,1)<>0) then return false; end if;
   if a ? 'crop' then
     crop:=a->'crop';
     if jsonb_typeof(crop) is distinct from 'object' or (crop-array['x','y','width','height'])<>'{}'::jsonb then return false; end if;
     foreach key in array array['x','y','width','height'] loop
       if jsonb_typeof(crop->key) is distinct from 'number' or (crop->>key)::numeric not between
         (case when key in ('x','y') then 0 else 1 end) and 100 then return false; end if;
     end loop;
     if (crop->>'x')::numeric+(crop->>'width')::numeric>100.000001 or (crop->>'y')::numeric+(crop->>'height')::numeric>100.000001 then return false; end if;
   end if;
 elsif t='youtubeVideo' then
   if (a-array['videoId','widthPercent'])<>'{}'::jsonb or jsonb_typeof(a->'videoId') is distinct from 'string'
     or (a->>'videoId')!~'^[A-Za-z0-9_-]{11}$' then return false; end if;
   if a ? 'widthPercent' and a->'widthPercent'<>'null'::jsonb and (jsonb_typeof(a->'widthPercent') is distinct from 'number'
     or (a->>'widthPercent')::numeric not between 10 and 100 or mod((a->>'widthPercent')::numeric,1)<>0) then return false; end if;
 elsif a<>'{}'::jsonb then return false;
 end if;
 if t='text' then
   if jsonb_typeof(v->'text') is distinct from 'string' or char_length(v->>'text')=0 or v ? 'content' then return false; end if;
   if v ? 'marks' then
     if jsonb_typeof(v->'marks') is distinct from 'array' or jsonb_array_length(v->'marks')>8
       or (parent='codeBlock' and jsonb_array_length(v->'marks')>0) then return false; end if;
     for mark in select value from jsonb_array_elements(v->'marks') loop
       if jsonb_typeof(mark) is distinct from 'object' or (mark-array['type','attrs'])<>'{}'::jsonb
         or jsonb_typeof(mark->'type') is distinct from 'string' then return false; end if;
       mt:=mark->>'type';
       if mt=any(seen) then return false; end if;
       seen:=array_append(seen,mt);
       ma:=case when mark->'attrs' is null or mark->'attrs'='null'::jsonb then '{}'::jsonb else mark->'attrs' end;
       if jsonb_typeof(ma) is distinct from 'object' then return false; end if;
       if mt in ('bold','italic','underline','strike','code') then
         if ma<>'{}'::jsonb then return false; end if;
       elsif mt='highlight' then
         if (ma-array['color'])<>'{}'::jsonb or ma->>'color' is null or ma->>'color' not in ('#fef08a','#bbf7d0','#bfdbfe','#fbcfe8','#fed7aa') then return false; end if;
       elsif mt='textStyle' then
         if (ma-array['color','fontSize','fontFamily'])<>'{}'::jsonb then return false; end if;
         if ma ? 'color' and ma->'color'<>'null'::jsonb and ma->>'color' not in ('#111827','#2563eb','#166534','#9a3412','#7e22ce') then return false; end if;
         if ma ? 'fontSize' and ma->'fontSize'<>'null'::jsonb and ma->>'fontSize' not in ('14px','16px','17px','18px','22px','28px','32px') then return false; end if;
         if ma ? 'fontFamily' and ma->'fontFamily'<>'null'::jsonb and ma->>'fontFamily' not in ('inherit','var(--font-profile-display)') then return false; end if;
       elsif mt='link' then
         if (ma-array['href','target','rel'])<>'{}'::jsonb or jsonb_typeof(ma->'href') is distinct from 'string'
           or not posts_private.editor_link_valid(ma->>'href') then return false; end if;
         if ma ? 'target' and ma->'target'<>'null'::jsonb and ma->>'target'<>'_blank' then return false; end if;
         if ma ? 'rel' and ma->'rel'<>'null'::jsonb and ma->>'rel'<>'noopener noreferrer nofollow' then return false; end if;
       else return false;
       end if;
     end loop;
   end if;
   return true;
 end if;
 if v ? 'text' or v ? 'marks' then return false; end if;
 if t in ('hardBreak','horizontalRule','profileMedia','youtubeVideo') then return not (v ? 'content'); end if;
 if v ? 'content' and jsonb_typeof(v->'content') is distinct from 'array' then return false; end if;
 children:=coalesce(v->'content','[]'::jsonb);
 if t in ('bulletList','orderedList','listItem','blockquote','table','tableRow','tableCell','tableHeader')
   and jsonb_array_length(children)=0 then return false; end if;
 if t='listItem' and children->0->>'type' is distinct from 'paragraph' then return false; end if;
 if (t='table' and jsonb_array_length(children)>200) or (t='tableRow' and jsonb_array_length(children)>100) then return false; end if;
 for child in select value from jsonb_array_elements(children) loop
   if not posts_private.editor_node_valid(child,t,depth+1) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end;
$$;

create function posts_private.editor_document_valid(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare nodes integer; max_depth integer;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>1000000 then return false; end if;
 with recursive tree(node,depth) as (
   select v,0 union all select c.value,t.depth+1 from tree t
   cross join lateral jsonb_array_elements(case when jsonb_typeof(t.node->'content')='array' then t.node->'content' else '[]'::jsonb end) c
   where t.depth<17
 ) select count(*),coalesce(max(depth),0) into nodes,max_depth from (select depth from tree limit 10001) bounded;
 if nodes>10000 or max_depth>16 then return false; end if;
 return posts_private.editor_node_valid(v,'root',0);
exception when others then return false;
end;
$$;

create or replace function posts_private.content_valid(v jsonb,p_post uuid,p_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare doc jsonb; node jsonb; tag jsonb;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>1000000
   or (v-array['title','document','category','tags'])<>'{}'::jsonb
   or jsonb_typeof(v->'title') is distinct from 'string' or char_length(v->>'title')>80
   or (v->>'title') ~ '[[:cntrl:]<>]'
   or jsonb_typeof(v->'category') is distinct from 'string' or char_length(v->>'category')>12
   or jsonb_typeof(v->'tags') is distinct from 'array' or jsonb_array_length(v->'tags')>10 then return false; end if;
 for tag in select value from jsonb_array_elements(v->'tags') loop
   if jsonb_typeof(tag) is distinct from 'string' or char_length(tag#>>'{}')>20 then return false; end if;
 end loop;
 doc:=v->'document';
 if not posts_private.editor_document_valid(doc) then return false; end if;
 for node in select value from jsonb_array_elements(coalesce(doc->'content','[]'::jsonb)) loop
   if node->>'type'='profileMedia' and not exists (
     select 1 from posts_private.files f where f.id=(node->'attrs'->>'fileId')::uuid
       and f.owner_id=p_owner and f.post_id=p_post and f.ready
       and f.mime=node->'attrs'->>'mime'
       and f.mime in ('image/jpeg','image/png','image/webp','image/gif')
   ) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end;
$$;

create or replace function posts_private.document_text(doc jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare result text;
begin
 if jsonb_typeof(doc) is distinct from 'object' or octet_length(doc::text)>1000000 then return ''; end if;
 with recursive tree(node,path,depth) as (
   select doc,array[]::integer[],0
   union all select c.value,t.path||c.ordinality::integer,t.depth+1 from tree t
   cross join lateral jsonb_array_elements(case when jsonb_typeof(t.node->'content')='array' then t.node->'content' else '[]'::jsonb end) with ordinality c
   where t.depth<16
 ), bounded as (select * from tree limit 10000)
 select string_agg(case when node->>'type'='text' and jsonb_typeof(node->'text')='string' then node->>'text'
   when node->>'type' in ('paragraph','heading','codeBlock','tableRow','hardBreak') then E'\n' else '' end,'' order by path) into result from bounded;
 return btrim(coalesce(result,''),E' \t\n\r');
end;
$$;
revoke all on function posts_private.editor_link_valid(text),posts_private.editor_node_valid(jsonb,text,integer),
 posts_private.editor_document_valid(jsonb) from public,anon,authenticated,service_role;
commit;
