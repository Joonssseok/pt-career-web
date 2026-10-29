-- Additive: browser originals and the existing profile publishing path are untouched.
create table public.damoa_activities (
  owner uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 131072),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(owner,id)
);
create table public.damoa_files (
  owner uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  activity_id uuid not null,
  name text not null check(length(name) between 1 and 255),
  mime text not null check(mime in ('image/jpeg','image/png','image/webp','application/pdf')),
  path text not null unique,
  bytes bigint not null default 10485760 check(bytes between 0 and 10485760),
  ready boolean not null default false,
  deleting boolean not null default false,
  primary key(owner,id)
);
create index damoa_files_activity_idx on public.damoa_files(owner,activity_id);
alter table public.damoa_activities enable row level security;
alter table public.damoa_files enable row level security;
revoke all on public.damoa_activities,public.damoa_files from anon,authenticated;
grant select on public.damoa_activities,public.damoa_files to authenticated;
create policy damoa_activities_owner_read on public.damoa_activities for select to authenticated using(owner=(select auth.uid()));
create policy damoa_files_owner_read on public.damoa_files for select to authenticated using(owner=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('damoa-files','damoa-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);

-- A full bucket-sized reservation prevents forged sizes and concurrent uploads exceeding 100 MiB.
-- Released to actual server-observed size only after upload. Objects are immutable (no UPDATE policy).
create function public.damoa_reserve_file(p_id uuid,p_activity uuid,p_name text,p_mime text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); f public.damoa_files; total bigint;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 select * into f from public.damoa_files where owner=u and id=p_id;
 if found then
  if f.deleting or f.activity_id<>p_activity or f.name<>p_name or f.mime<>p_mime then raise exception '첨부 자료가 변경되었습니다. 다시 선택해주세요.'; end if;
  return to_jsonb(f);
 end if;
 select coalesce(sum(bytes),0) into total from public.damoa_files where owner=u;
 if total+10485760>104857600 then raise exception '100MB 저장 한도입니다. 안전한 업로드를 위해 10MB의 여유 공간이 필요합니다. 사용하지 않는 자료를 정리해주세요.'; end if;
 insert into public.damoa_files(owner,id,activity_id,name,mime,path)
 values(u,p_id,p_activity,p_name,p_mime,u::text||'/'||p_activity::text||'/'||p_id::text) returning * into f;
 return to_jsonb(f);
end $$;
create function public.damoa_finish_file(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); f public.damoa_files; m jsonb;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 select * into f from public.damoa_files where owner=u and id=p_id for update;
 if not found or f.deleting then raise exception '업로드 예약이 없습니다.'; end if;
 select metadata into m from storage.objects where bucket_id='damoa-files' and name=f.path;
 if m is null or (m->>'size') is null then raise exception '업로드를 확인하지 못했습니다. 다시 시도해주세요.'; end if;
 if (m->>'size')::bigint>10485760 or m->>'mimetype'<>f.mime then raise exception '파일 크기 또는 형식이 올바르지 않습니다.'; end if;
 update public.damoa_files set bytes=(m->>'size')::bigint,ready=true where owner=u and id=p_id returning * into f;
 return to_jsonb(f);
end $$;
create function public.damoa_save_activity(p_id uuid,p_content jsonb,p_expected timestamptz default null,p_create_only boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.damoa_activities; item jsonb; f public.damoa_files; files jsonb:='[]'::jsonb;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 select * into r from public.damoa_activities where owner=u and id=p_id for update;
 if found then
  if p_create_only then return to_jsonb(r); end if;
  if p_expected is distinct from r.updated_at then raise exception '다른 창에서 수정된 기록입니다. 새로고침 후 다시 작성해주세요.'; end if;
 elsif p_expected is not null then raise exception '삭제되었거나 변경된 기록입니다. 새로고침해주세요.';
 end if;
 if jsonb_typeof(p_content)<>'object' or jsonb_typeof(p_content->'files') is distinct from 'array'
 or jsonb_typeof(p_content->'details') is distinct from 'object' then raise exception '기록 형식이 올바르지 않습니다.'; end if;
 if p_content->>'category' not in ('academic','education','license','study','career','intern','project','volunteer','external','club','association','lecture','mentor','research','content','award','contest','other')
 or coalesce(p_content->>'category','')='' then raise exception '카테고리를 선택해주세요.'; end if;
 if coalesce(p_content->>'link','')<>'' and p_content->>'link' !~* '^https?://' then raise exception '관련 링크를 확인해주세요.'; end if;
 if jsonb_array_length(p_content->'files')>100 then raise exception '한 기록에 자료는 100개까지 첨부할 수 있습니다.'; end if;
 for item in select value from jsonb_array_elements(p_content->'files') loop
  select * into f from public.damoa_files where owner=u and id=(item->>'id')::uuid and activity_id=p_id and ready and not deleting;
  if not found then raise exception '첨부 자료 저장을 먼저 완료해주세요.'; end if;
  if exists(select 1 from jsonb_array_elements(files) v where v->>'id'=f.id::text) then raise exception '첨부 자료가 중복되었습니다.'; end if;
  files:=files||jsonb_build_array(jsonb_build_object('id',f.id,'name',f.name,'size',f.bytes,'type',f.mime,'path',f.path));
 end loop;
 if btrim(coalesce(p_content->>'title',''))='' and jsonb_array_length(files)=0 then raise exception '활동 이름을 적거나 자료를 첨부해주세요.'; end if;
 insert into public.damoa_activities(owner,id,content) values(u,p_id,p_content||jsonb_build_object('files',files))
 on conflict(owner,id) do update set content=excluded.content,updated_at=clock_timestamp() returning * into r;
 return to_jsonb(r);
end $$;
create function public.damoa_delete_activity(p_id uuid,p_expected timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 delete from public.damoa_activities where owner=u and id=p_id and updated_at=p_expected;
 if not found then raise exception '기록이 변경되었습니다. 새로고침 후 다시 확인해주세요.'; end if;
end $$;
create function public.damoa_claim_file_delete(p_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); f public.damoa_files;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 select * into f from public.damoa_files where owner=u and id=p_id;
 if not found then return null; end if;
 if exists(select 1 from public.damoa_activities a,jsonb_array_elements(a.content->'files') v where a.owner=u and v->>'id'=p_id::text) then return null; end if;
 update public.damoa_files set deleting=true where owner=u and id=p_id;
 return f.path;
end $$;
-- Storage API deletes the actual bytes first; only then can quota reservations be released.
create function public.damoa_release_file(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); f public.damoa_files;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 select * into f from public.damoa_files where owner=u and id=p_id;
 if not found then return; end if;
 if exists(select 1 from storage.objects where bucket_id='damoa-files' and name=f.path)
 or exists(select 1 from public.damoa_activities a, jsonb_array_elements(a.content->'files') v where a.owner=u and v->>'id'=p_id::text)
 then raise exception '저장된 자료는 먼저 기록에서 제거해주세요.'; end if;
 delete from public.damoa_files where owner=u and id=p_id;
end $$;
revoke all on function public.damoa_reserve_file(uuid,uuid,text,text),public.damoa_finish_file(uuid),public.damoa_save_activity(uuid,jsonb,timestamptz,boolean),public.damoa_delete_activity(uuid,timestamptz),public.damoa_release_file(uuid),public.damoa_claim_file_delete(uuid) from public,anon;
grant execute on function public.damoa_reserve_file(uuid,uuid,text,text),public.damoa_finish_file(uuid),public.damoa_save_activity(uuid,jsonb,timestamptz,boolean),public.damoa_delete_activity(uuid,timestamptz),public.damoa_release_file(uuid),public.damoa_claim_file_delete(uuid) to authenticated;
create policy damoa_object_read on storage.objects for select to authenticated using(
 bucket_id='damoa-files' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create schema if not exists damoa_internal;
revoke all on schema damoa_internal from public;
grant usage on schema damoa_internal to authenticated;
create function damoa_internal.can_upload(p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then return false; end if;
 -- Also taken by the final Storage permission probe: serialize with cleanup/reservation release.
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 return exists(select 1 from public.damoa_files f where f.owner=u and f.path=p_path and not f.ready and not f.deleting and f.bytes=10485760);
end $$;
revoke all on function damoa_internal.can_upload(text) from public,anon;
grant execute on function damoa_internal.can_upload(text) to authenticated;
create policy damoa_object_insert on storage.objects for insert to authenticated with check(
 bucket_id='damoa-files' and damoa_internal.can_upload(storage.objects.name)
);
create policy damoa_object_delete on storage.objects for delete to authenticated using(
 bucket_id='damoa-files' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.damoa_files f where f.owner=(select auth.uid()) and f.path=storage.objects.name and f.deleting)
);
