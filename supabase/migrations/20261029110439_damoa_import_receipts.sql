-- Receipts survive record deletion so browser originals are not accidentally resurrected.
create table public.damoa_browser_imports (
 owner uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 imported_at timestamptz not null default now(),
 primary key(owner,id)
);
alter table public.damoa_browser_imports enable row level security;
revoke all on public.damoa_browser_imports from anon,authenticated;
grant select on public.damoa_browser_imports to authenticated;
create policy damoa_imports_owner_read on public.damoa_browser_imports for select to authenticated using(owner=(select auth.uid()));
create or replace function public.damoa_save_activity(p_id uuid,p_content jsonb,p_expected timestamptz default null,p_create_only boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.damoa_activities; item jsonb; f public.damoa_files; files jsonb:='[]'::jsonb;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 select * into r from public.damoa_activities where owner=u and id=p_id for update;
 if found then
  if p_create_only then insert into public.damoa_browser_imports(owner,id) values(u,p_id) on conflict do nothing; return to_jsonb(r); end if;
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
 if p_create_only then insert into public.damoa_browser_imports(owner,id) values(u,p_id) on conflict do nothing; end if;
 return to_jsonb(r);
end $$;
