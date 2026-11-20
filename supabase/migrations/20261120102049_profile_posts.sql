-- New posts only. Keep posts_private outside exposed schemas; no existing data changes.
begin;
create schema posts_private;
revoke all on schema posts_private from public,anon,authenticated,service_role;
alter default privileges in schema posts_private revoke execute on functions from public;
alter default privileges in schema posts_private revoke all on tables from public,anon,authenticated,service_role;
create table posts_private.posts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 draft jsonb not null default '{"title":"","document":{"type":"doc","content":[]},"category":"","tags":[]}',
 published jsonb,
 visibility text not null default 'private' check(visibility in ('public','private')),
 published_at timestamptz,
 updated_at timestamptz not null default clock_timestamp(),
 admin_hidden boolean not null default false
);
create index posts_owner_updated_idx on posts_private.posts(owner_id,updated_at desc,id desc);
create table posts_private.files (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references posts_private.posts(id) on delete cascade,
 path text not null unique,
 name text not null check(char_length(name) between 1 and 255),
 mime text not null check(mime in ('image/jpeg','image/png','image/webp','image/gif')),
 bytes bigint check(bytes>0),
 ready boolean not null default false
);
create index post_files_post_idx on posts_private.files(post_id);
-- No account FK: cleanup must survive the final account purge.
create table posts_private.file_cleanup (
 path text primary key,
 created_at timestamptz not null default clock_timestamp(),
 done boolean not null default false
);
alter table posts_private.posts enable row level security;
alter table posts_private.files enable row level security;
alter table posts_private.file_cleanup enable row level security;
revoke all on all tables in schema posts_private from public,anon,authenticated,service_role;
-- NULL retains the platform upload limit; no per-product byte/count quota.
insert into storage.buckets(id,name,public,allowed_mime_types)
 values('profile-post-images','profile-post-images',false,array['image/jpeg','image/png','image/webp','image/gif']);

create function posts_private.content_valid(v jsonb,p_post uuid,p_owner uuid) returns boolean
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
 if jsonb_typeof(doc) is distinct from 'object' or doc->>'type' is distinct from 'doc'
   or (doc-array['type','content'])<>'{}'::jsonb or jsonb_typeof(doc->'content') is distinct from 'array' then return false; end if;
 for node in select value from jsonb_array_elements(doc->'content') loop
   -- Reuse the strict node validator without importing the detail editor's 20-media cap.
   if not public.profile_detail_document_valid(jsonb_build_object('type','doc','content',jsonb_build_array(node))) then return false; end if;
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

create function posts_private.document_text(doc jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare node jsonb; result text:='';
begin
 for node in select value from jsonb_array_elements(doc->'content') loop
   if node->>'type' not in ('profileMedia','youtubeVideo') then
     result:=result||public.profile_introduction_format_text(jsonb_build_object('type','doc','content',jsonb_build_array(node)))||E'\n';
   end if;
 end loop;
 return btrim(result);
end;
$$;

create function posts_private.create_profile_post() returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved posts_private.posts;
begin
 perform video_private.own_profile(true);
 insert into posts_private.posts(owner_id) values(auth.uid()) returning * into saved;
 return jsonb_build_object('id',saved.id,'updatedAt',saved.updated_at);
end;
$$;

create function posts_private.save_profile_post(p_id uuid,p_content jsonb,p_publish boolean,p_visibility text,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved posts_private.posts;
begin
 perform video_private.own_profile(true);
 select * into saved from posts_private.posts where id=p_id and owner_id=auth.uid() for update;
 if not found then raise exception 'not_allowed' using errcode='42501'; end if;
 if p_expected is null or p_expected is distinct from saved.updated_at then raise exception 'post_conflict' using errcode='40001'; end if;
 if p_publish is null or p_visibility is null or p_visibility not in ('public','private')
   or not posts_private.content_valid(p_content,p_id,auth.uid()) then raise exception 'invalid_post' using errcode='22023'; end if;
 if p_publish and (not (p_content->>'title' ~ '[^[:space:]]') or (
   not (posts_private.document_text(p_content->'document') ~ '[^[:space:]]')
   and not exists(select 1 from jsonb_array_elements(p_content->'document'->'content') n
     where n->>'type' in ('profileMedia','youtubeVideo'))
 )) then raise exception 'empty_post' using errcode='22023'; end if;
 update posts_private.posts set draft=p_content,
   published=case when p_publish then p_content else published end,
   published_at=case when p_publish then coalesce(published_at,clock_timestamp()) else published_at end,
   visibility=case when p_publish then p_visibility else visibility end,
   updated_at=greatest(clock_timestamp(),saved.updated_at+interval '1 microsecond')
   where id=p_id returning * into saved;
 return jsonb_build_object('id',saved.id,'updatedAt',saved.updated_at);
end;
$$;

create function posts_private.dto(p posts_private.posts,p_own boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 with payload as (select case when p_own then p.draft else p.published end c)
 select jsonb_build_object('id',p.id,'title',c->'title','document',c->'document','category',c->'category','tags',c->'tags',
   'summary',left(posts_private.document_text(c->'document'),240), 'visibility',p.visibility,
   'status',case when p.published is null then 'draft' else 'published' end,
   'adminHidden',p.admin_hidden,'publishedAt',p.published_at,'updatedAt',p.updated_at,
   'images',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',case when p_own then f.name else '' end,'size',f.bytes,'mime',f.mime,
     'src','/api/profile-post-images/'||f.id::text) order by f.id)
     from posts_private.files f where f.post_id=p.id and f.owner_id=p.owner_id and f.ready
     and exists(select 1 from jsonb_array_elements(c->'document'->'content') n
       where n->>'type'='profileMedia' and (n->'attrs'->>'fileId')::uuid=f.id)), '[]'::jsonb))
 from payload;
$$;

create function posts_private.read_posts(p_profile uuid,p_own boolean,p_id uuid,p_offset integer,p_limit integer,p_query text,p_category text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare own_id uuid; owner_uid uuid; query_text text:=nullif(btrim(p_query),''); category_text text:=nullif(btrim(p_category),''); result jsonb;
begin
 if p_own is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
   or char_length(query_text)>100 or char_length(category_text)>12 then raise exception 'invalid_query' using errcode='22023'; end if;
 if p_own then
   own_id:=video_private.own_profile(false);
   if own_id is null or p_profile is distinct from own_id then raise exception 'not_allowed' using errcode='42501'; end if;
   owner_uid:=auth.uid();
 else select user_id into owner_uid from public.profiles where id=p_profile; end if;
 select coalesce(jsonb_agg(posts_private.dto(r,p_own) order by r.updated_at desc,r.id desc),'[]'::jsonb) into result
 from (select p.* from posts_private.posts p
   cross join lateral (select case when p_own then p.draft else p.published end c) payload
   where p.owner_id=owner_uid and (p_id is null or p.id=p_id)
     and (p_own or (p.published is not null and p.published_at is not null and p.visibility='public'
       and not p.admin_hidden and video_private.can_write(p_profile)))
     and (category_text is null or c->>'category'=category_text)
     and (query_text is null or position(lower(query_text) in lower(c->>'title'||' '||posts_private.document_text(c->'document')||' '||(c->'tags')::text))>0)
   order by p.updated_at desc,p.id desc offset p_offset limit p_limit) r;
 return result;
end;
$$;
create function posts_private.list_profile_posts(p_profile uuid,p_own boolean default false,p_offset integer default 0,p_limit integer default 10,p_query text default null,p_category text default null) returns jsonb
language sql security definer set search_path='' as $$ select posts_private.read_posts(p_profile,p_own,null,p_offset,p_limit,p_query,p_category); $$;
create function posts_private.get_profile_post(p_profile uuid,p_id uuid,p_own boolean default false) returns jsonb
language sql security definer set search_path='' as $$ select case when p_id is null then null else posts_private.read_posts(p_profile,p_own,p_id,0,1,null,null)->0 end; $$;
create function posts_private.delete_profile_post(p_id uuid,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare saved posts_private.posts;
begin
 perform video_private.own_profile(true);
 select * into saved from posts_private.posts where id=p_id and owner_id=auth.uid() for update;
 if not found then raise exception 'not_allowed' using errcode='42501'; end if;
 if p_expected is null or p_expected is distinct from saved.updated_at then raise exception 'post_conflict' using errcode='40001'; end if;
 delete from posts_private.posts where id=p_id;
end;
$$;

create function posts_private.reserve_profile_post_image(p_id uuid,p_post uuid,p_name text,p_mime text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f posts_private.files;
begin
 perform video_private.own_profile(true);
 perform 1 from posts_private.posts where id=p_post and owner_id=auth.uid() for update;
 if not found then raise exception 'not_allowed' using errcode='42501'; end if;
 if p_id is null or p_name is null or char_length(p_name) not between 1 and 255
   or p_mime is null or p_mime not in ('image/jpeg','image/png','image/webp','image/gif') then raise exception 'invalid_image' using errcode='22023'; end if;
 select * into f from posts_private.files where id=p_id;
 if found then
   if f.owner_id<>auth.uid() or f.post_id<>p_post or f.name<>p_name or f.mime<>p_mime then raise exception 'not_allowed' using errcode='42501'; end if;
 else
   -- Never adopt bytes left by a deleted reservation, even after cleanup completed.
   if exists(select 1 from posts_private.file_cleanup c where c.path=p_id::text)
     or exists(select 1 from storage.objects o where o.bucket_id='profile-post-images' and o.name=p_id::text) then
     raise exception 'image_id_retired' using errcode='42501';
   end if;
   insert into posts_private.files(id,owner_id,post_id,path,name,mime)
     values(p_id,auth.uid(),p_post,p_id::text,p_name,p_mime) returning * into f;
 end if;
 return jsonb_build_object('path',f.path,'ready',f.ready);
end;
$$;
create function posts_private.finish_profile_post_image(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare f posts_private.files; metadata jsonb;
begin
 perform video_private.own_profile(true);
 select * into f from posts_private.files where id=p_id and owner_id=auth.uid() for update;
 if not found then raise exception 'not_allowed' using errcode='42501'; end if;
 select o.metadata into metadata from storage.objects o where o.bucket_id='profile-post-images' and o.name=f.path;
 if metadata is null or coalesce(metadata->>'size','') !~ '^[0-9]{1,18}$'
   or (metadata->>'size')::bigint<=0 or metadata->>'mimetype' is distinct from f.mime then raise exception 'invalid_image' using errcode='22023'; end if;
 update posts_private.files set bytes=(metadata->>'size')::bigint,ready=true where id=f.id;
end;
$$;

create function posts_private.can_upload(p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform video_private.own_profile(true);
 return exists(select 1 from posts_private.files f join posts_private.posts p on p.id=f.post_id and p.owner_id=f.owner_id
   where f.path=p_path and f.owner_id=auth.uid() and not f.ready);
exception when insufficient_privilege then return false;
end;
$$;
create function posts_private.can_read_file(p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
declare own_id uuid;
begin
 if auth.uid() is not null then
   begin own_id:=video_private.own_profile(false);
   exception when insufficient_privilege then own_id:=null; end;
 end if;
 return exists(select 1 from posts_private.files f join posts_private.posts p on p.id=f.post_id and p.owner_id=f.owner_id
   join public.profiles profile on profile.user_id=p.owner_id
   where f.path=p_path and f.ready and (
     (f.owner_id=auth.uid() and own_id=profile.id) or (
       p.visibility='public' and not p.admin_hidden and p.published is not null and p.published_at is not null
       and video_private.can_write(profile.id)
       and exists(select 1 from jsonb_array_elements(p.published->'document'->'content') n
         where n->>'type'='profileMedia' and (n->'attrs'->>'fileId')::uuid=f.id)
     )
   ));
end;
$$;
create function posts_private.profile_post_image_path(p_file uuid) returns text
language sql security definer set search_path='' as $$
 select f.path from posts_private.files f where f.id=p_file and posts_private.can_read_file(f.path);
$$;

create function posts_private.enqueue_file_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into posts_private.file_cleanup(path) values(old.path) on conflict(path) do nothing;
 return old;
end;
$$;
create trigger post_file_cleanup_before_delete before delete on posts_private.files
 for each row execute function posts_private.enqueue_file_cleanup();

-- Only the service worker receives paths; it removes bytes through the Storage API.
create function posts_private.profile_post_cleanup_batch(p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_limit' using errcode='22023'; end if;
 select coalesce(jsonb_agg(q.path order by q.created_at,q.path),'[]'::jsonb) into result
 from (select c.path,c.created_at from posts_private.file_cleanup c
   where not c.done and not exists(select 1 from posts_private.files f where f.path=c.path)
   order by c.created_at,c.path limit p_limit) q;
 return result;
end;
$$;
create function posts_private.ack_profile_post_cleanup(p_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
 update posts_private.file_cleanup c set done=true where c.path=p_path and not c.done
   and not exists(select 1 from posts_private.files f where f.path=c.path)
   and not exists(select 1 from storage.objects o where o.bucket_id='profile-post-images' and o.name=c.path);
end;
$$;

create function public.create_profile_post() returns jsonb
language sql security invoker set search_path='' as $$ select posts_private.create_profile_post(); $$;
create function public.save_profile_post(p_id uuid,p_content jsonb,p_publish boolean,p_visibility text,p_expected timestamptz) returns jsonb
language sql security invoker set search_path='' as $$ select posts_private.save_profile_post(p_id,p_content,p_publish,p_visibility,p_expected); $$;
create function public.list_profile_posts(p_profile uuid,p_own boolean default false,p_offset integer default 0,p_limit integer default 10,p_query text default null,p_category text default null) returns jsonb
language sql security invoker set search_path='' as $$ select posts_private.list_profile_posts(p_profile,p_own,p_offset,p_limit,p_query,p_category); $$;
create function public.get_profile_post(p_profile uuid,p_id uuid,p_own boolean default false) returns jsonb
language sql security invoker set search_path='' as $$ select posts_private.get_profile_post(p_profile,p_id,p_own); $$;
create function public.delete_profile_post(p_id uuid,p_expected timestamptz) returns void
language sql security invoker set search_path='' as $$ select posts_private.delete_profile_post(p_id,p_expected); $$;
create function public.reserve_profile_post_image(p_id uuid,p_post uuid,p_name text,p_mime text) returns jsonb
language sql security invoker set search_path='' as $$ select posts_private.reserve_profile_post_image(p_id,p_post,p_name,p_mime); $$;
create function public.finish_profile_post_image(p_id uuid) returns void
language sql security invoker set search_path='' as $$ select posts_private.finish_profile_post_image(p_id); $$;
create function public.profile_post_image_path(p_file uuid) returns text
language sql security invoker set search_path='' as $$ select posts_private.profile_post_image_path(p_file); $$;
create function public.profile_post_cleanup_batch(p_limit integer default 20) returns jsonb
language sql security invoker set search_path='' as $$ select posts_private.profile_post_cleanup_batch(p_limit); $$;
create function public.ack_profile_post_cleanup(p_path text) returns void
language sql security invoker set search_path='' as $$ select posts_private.ack_profile_post_cleanup(p_path); $$;

revoke all on all functions in schema posts_private from public,anon,authenticated,service_role;
revoke all on function public.create_profile_post(),public.save_profile_post(uuid,jsonb,boolean,text,timestamptz),
 public.list_profile_posts(uuid,boolean,integer,integer,text,text),public.get_profile_post(uuid,uuid,boolean),
 public.delete_profile_post(uuid,timestamptz),public.reserve_profile_post_image(uuid,uuid,text,text),
 public.finish_profile_post_image(uuid),public.profile_post_image_path(uuid),public.profile_post_cleanup_batch(integer),
 public.ack_profile_post_cleanup(text) from public,anon,authenticated,service_role;
grant usage on schema posts_private to anon,authenticated;
grant execute on function posts_private.list_profile_posts(uuid,boolean,integer,integer,text,text),posts_private.get_profile_post(uuid,uuid,boolean),
 posts_private.profile_post_image_path(uuid),posts_private.can_read_file(text),public.list_profile_posts(uuid,boolean,integer,integer,text,text),
 public.get_profile_post(uuid,uuid,boolean),public.profile_post_image_path(uuid) to anon,authenticated;
grant execute on function posts_private.create_profile_post(),posts_private.save_profile_post(uuid,jsonb,boolean,text,timestamptz),
 posts_private.delete_profile_post(uuid,timestamptz),posts_private.reserve_profile_post_image(uuid,uuid,text,text),
 posts_private.finish_profile_post_image(uuid),posts_private.can_upload(text),public.create_profile_post(),
 public.save_profile_post(uuid,jsonb,boolean,text,timestamptz),public.delete_profile_post(uuid,timestamptz),
 public.reserve_profile_post_image(uuid,uuid,text,text),public.finish_profile_post_image(uuid) to authenticated;
grant usage on schema posts_private to service_role;
grant execute on function posts_private.profile_post_cleanup_batch(integer),posts_private.ack_profile_post_cleanup(text),
 public.profile_post_cleanup_batch(integer),public.ack_profile_post_cleanup(text) to service_role;

create policy post_image_read on storage.objects for select to anon,authenticated
 using(bucket_id='profile-post-images' and posts_private.can_read_file(name));
create policy post_image_insert on storage.objects for insert to authenticated
 with check(bucket_id='profile-post-images' and posts_private.can_upload(name));
-- Restrictive fences protect this bucket even if an existing permissive policy is broad.
create policy post_image_read_fence on storage.objects as restrictive for select to anon,authenticated
 using(bucket_id<>'profile-post-images' or posts_private.can_read_file(name));
create policy post_image_insert_fence on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'profile-post-images' or posts_private.can_upload(name));
create policy post_image_anon_insert_fence on storage.objects as restrictive for insert to anon
 with check(bucket_id<>'profile-post-images');
create policy post_image_update_fence on storage.objects as restrictive for update to anon,authenticated
 using(bucket_id<>'profile-post-images') with check(bucket_id<>'profile-post-images');
create policy post_image_delete_fence on storage.objects as restrictive for delete to anon,authenticated
 using(bucket_id<>'profile-post-images');
commit;
