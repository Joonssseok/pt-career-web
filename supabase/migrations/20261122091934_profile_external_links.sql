-- Upgrade existing external-link storage only; never auto-convert legacy social fields.
begin;
alter table public.profile_extra_links
 add column kind text not null default 'custom' check(kind in ('youtube','instagram','blog','threads','kakao','custom')),
 add column is_primary boolean not null default false;
create unique index profile_extra_links_one_primary on public.profile_extra_links(profile_id) where is_primary;
grant select(kind,is_primary) on public.profile_extra_links to anon,authenticated;

create function public.load_own_external_links() returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
 select * into p from public.profiles where user_id=auth.uid();
 if not found then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(link order by section,position,id),'[]'::jsonb) into result from (
   select 0 section,s.position, s.kind id,
     jsonb_build_object('id',gen_random_uuid(),'kind',s.kind,'label',s.label,'url',s.url,'is_primary',false) link
   from (values
     (0,'youtube','유튜브',p.youtube_url),(1,'instagram','인스타그램',p.instagram_url),
     (2,'blog','블로그',p.blog_url),(3,'threads','스레드',p.threads_url),(4,'kakao','카카오톡',p.kakao_url)
   ) s(position,kind,label,url) where nullif(btrim(s.url),'') is not null
   union all
   select 1,e.display_order,e.id::text,
     jsonb_build_object('id',e.id,'kind',e.kind,'label',e.label,'url',e.url,'is_primary',e.is_primary)
   from public.profile_extra_links e where e.profile_id=p.id
 ) links;
 return result;
end;
$$;

create function public.save_own_external_links(p_links jsonb,p_expected_links jsonb) returns table(ok boolean,error text)
language plpgsql security definer set search_path='' as $$
declare profile uuid; link jsonb; primary_count integer:=0; current_links jsonb;
begin
 if auth.uid() is null then return query select false,'Not authenticated'::text; return; end if;
 select id into profile from public.profiles where user_id=auth.uid() for update;
 if not found then return query select false,'Profile not found'::text; return; end if;
 select coalesce(jsonb_agg(item-'id' order by ord),'[]'::jsonb) into current_links
   from jsonb_array_elements(public.load_own_external_links()) with ordinality links(item,ord);
 if p_expected_links is distinct from current_links then
   return query select false,'External links changed'::text; return;
 end if;
 if jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links)>15 then
   return query select false,'Invalid external links'::text; return;
 end if;
 for link in select value from jsonb_array_elements(p_links) loop
   if jsonb_typeof(link) is distinct from 'object' or (link-array['kind','label','url','is_primary'])<>'{}'::jsonb
     or jsonb_typeof(link->'kind') is distinct from 'string' or link->>'kind' not in ('youtube','instagram','blog','threads','kakao','custom')
     or jsonb_typeof(link->'label') is distinct from 'string' or char_length(btrim(link->>'label')) not between 1 and 40
     or link->>'label' ~ '[[:cntrl:]]'
     or jsonb_typeof(link->'url') is distinct from 'string' or link->>'url' ~ '[[:cntrl:]]'
     or not posts_private.editor_link_valid(btrim(link->>'url'))
     or jsonb_typeof(link->'is_primary') is distinct from 'boolean' then
     return query select false,'Invalid external link'::text; return;
   end if;
   if (link->>'is_primary')::boolean then primary_count:=primary_count+1; end if;
 end loop;
 if primary_count>1 then return query select false,'Only one primary link is allowed'::text; return; end if;
 delete from public.profile_extra_links where profile_id=profile;
 insert into public.profile_extra_links(profile_id,label,url,display_order,kind,is_primary)
   select profile,btrim(item->>'label'),btrim(item->>'url'),ord-1,item->>'kind',(item->>'is_primary')::boolean
   from jsonb_array_elements(p_links) with ordinality links(item,ord);
 update public.profiles set youtube_url=null,instagram_url=null,blog_url=null,threads_url=null,kakao_url=null where id=profile;
 return query select true,''::text;
end;
$$;

-- Old clients cannot discard kind/primary metadata or truncate the unified 15 slots.
create or replace function public.save_own_extra_links(p_links jsonb) returns table(ok boolean,error text)
language plpgsql security definer set search_path='' as $$
declare profile uuid; link jsonb;
begin
 if auth.uid() is null then return query select false,'Not authenticated'::text; return; end if;
 select id into profile from public.profiles where user_id=auth.uid() for update;
 if not found then return query select false,'Profile not found'::text; return; end if;
 if exists(select 1 from public.profile_extra_links e where e.profile_id=profile and (e.kind<>'custom' or e.is_primary))
   or (select count(*) from public.profile_extra_links e where e.profile_id=profile)>10 then
   return query select false,'Use the external links editor'::text; return;
 end if;
 if jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links)>10 then
   return query select false,'Invalid payload'::text; return;
 end if;
 for link in select value from jsonb_array_elements(p_links) loop
   if jsonb_typeof(link) is distinct from 'object' or (link-array['label','url'])<>'{}'::jsonb
     or jsonb_typeof(link->'label') is distinct from 'string' or char_length(btrim(link->>'label')) not between 1 and 40
     or link->>'label' ~ '[[:cntrl:]]' or jsonb_typeof(link->'url') is distinct from 'string'
     or link->>'url' ~ '[[:cntrl:]]' or not posts_private.editor_link_valid(btrim(link->>'url')) then
     return query select false,'Invalid link'::text; return;
   end if;
 end loop;
 delete from public.profile_extra_links where profile_id=profile;
 insert into public.profile_extra_links(profile_id,label,url,display_order)
   select profile,btrim(item->>'label'),btrim(item->>'url'),ord-1
   from jsonb_array_elements(p_links) with ordinality links(item,ord);
 return query select true,''::text;
end;
$$;
revoke all on function public.load_own_external_links(),public.save_own_external_links(jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.load_own_external_links(),public.save_own_external_links(jsonb,jsonb) to authenticated;

-- Patch only this aggregate in the current view; preserve every other projection/gate.
do $$
declare definition text; patched text; matches integer;
 pattern text:=$pattern$jsonb_build_object\(\s*'label'(?:::text)?,\s*el\.label,\s*'url'(?:::text)?,\s*el\.url\s*\)$pattern$;
begin
 if not coalesce((select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.public_expert_detail'::regclass),false) then
   raise exception 'Expected security-invoker public expert view';
 end if;
 definition:=pg_get_viewdef('public.public_expert_detail'::regclass,true);
 select count(*) into matches from regexp_matches(definition,pattern,'g');
 if matches<>1 then raise exception 'Expected exactly one external-link projection; review current view definition'; end if;
 patched:=regexp_replace(definition,pattern,$replacement$jsonb_build_object('label', el.label, 'url', el.url, 'kind', el.kind, 'is_primary', el.is_primary)$replacement$);
 execute 'create or replace view public.public_expert_detail with (security_invoker=true) as '||patched;
end;
$$;
commit;
