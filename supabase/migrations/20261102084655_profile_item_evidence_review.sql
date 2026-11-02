
-- Additive review records. Originals remain private and share the Damoa quota.
create table public.profile_item_reviews (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 version_id uuid not null references public.profile_versions(id) on delete cascade,
 item_key text not null check(length(item_key) between 1 and 20000),
 item_snapshot jsonb not null,
 title text not null,
 file_ids uuid[] not null default '{}',
 public_file_ids uuid[] not null default '{}',
 status text not null default 'draft' check(status in ('draft','pending','verified','rejected')),
 reason text not null default '',
 requested_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 updated_at timestamptz not null default clock_timestamp(),
 unique(version_id,item_key)
);
create index profile_item_reviews_queue on public.profile_item_reviews(status,requested_at);
create index profile_item_reviews_owner on public.profile_item_reviews(owner_id);
create index profile_item_reviews_files on public.profile_item_reviews using gin(file_ids);
alter table public.profile_item_reviews enable row level security;
revoke all on public.profile_item_reviews from public,anon,authenticated;
grant select on public.profile_item_reviews to authenticated;
create policy review_owner_admin_read on public.profile_item_reviews for select to authenticated
 using(owner_id=(select auth.uid()) or public.is_admin(auth.uid()));

create function public.profile_review_target(p_key text,p_content jsonb,p_expert jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare section text:=split_part(p_key,':',1); candidate jsonb; wanted jsonb;
begin
 if p_key=any(array(select jsonb_array_elements_text(coalesce(p_content->'excluded','[]')))) then return null; end if;
 if section='damoa' then
  select value into candidate from jsonb_array_elements(coalesce(p_content->'activities','[]')) where 'damoa:'||(value->>'id')=p_key;
  return candidate;
 end if;
 if section='introduction' and p_key='introduction:0' and coalesce(p_content->>'introduction','')<>'' then
  return jsonb_build_object('title','소개','text',p_content->>'introduction');
 end if;
 if section='workplace' and p_key='workplace:0' then
  return jsonb_build_object('title',coalesce(p_expert->>'workplace_center_name','근무 기관'),'address',p_expert->'workplace_address','phone',p_expert->'workplace_phone');
 end if;
 if not coalesce(p_content->'sections','[]') ? section then return null; end if;
 if section not in ('experiences','academic_records','educations','licenses') then return null; end if;
 begin wanted:=substring(p_key from length(section)+2)::jsonb; exception when others then return null; end;
 for candidate in select value from jsonb_array_elements(coalesce(p_expert->section,'[]')) loop
  if (case when section='licenses' then candidate-'id'-'document_public' else candidate end)=wanted then
   return candidate;
  end if;
 end loop;
 return null;
end $$;
revoke all on function public.profile_review_target(text,jsonb,jsonb) from public,anon,authenticated;

create function public.save_profile_item_review(p_version uuid,p_key text,p_files uuid[],p_public uuid[],p_request boolean,p_expected timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); v public.profile_versions; old public.profile_item_reviews; target jsonb; expert jsonb; f uuid;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 select * into v from public.profile_versions where id=p_version and owner_id=u for update;
 if not found then raise exception '본인의 저장된 프로필만 사용할 수 있습니다.'; end if;
 select to_jsonb(e) into expert from public.public_expert_detail e where id=v.profile_id;
 target:=public.profile_review_target(p_key,v.draft_content,expert);
 if target is null then raise exception '프로필을 저장한 뒤 현재 항목을 다시 확인해주세요.'; end if;
 if p_files is null or p_public is null or p_request is null or cardinality(p_files)>20 or not p_public<@p_files
 or cardinality(p_files)<>(select count(distinct x) from unnest(p_files) x) then raise exception '첨부 자료 선택을 확인해주세요.'; end if;
 if p_request and cardinality(p_files)=0 then raise exception '심사할 증빙자료를 첨부해주세요.'; end if;
 foreach f in array p_files loop
  if not exists(select 1 from public.damoa_files where owner=u and id=f and ready and not deleting) then raise exception '본인이 보관한 업로드 완료 자료만 첨부할 수 있습니다.'; end if;
 end loop;
 select * into old from public.profile_item_reviews where version_id=p_version and item_key=p_key for update;
 if found and old.updated_at is distinct from p_expected then raise exception '다른 창에서 변경되었습니다. 새로고침 후 다시 시도해주세요.'; end if;
 insert into public.profile_item_reviews(owner_id,version_id,item_key,item_snapshot,title,file_ids,public_file_ids,status,requested_at)
 values(u,p_version,p_key,target,coalesce(target->>'title',target->>'organization_name',target->>'school_name',target->>'education_name',target->>'license_name','증빙 항목'),p_files,p_public,case when p_request then 'pending' else 'draft' end,case when p_request then clock_timestamp() end)
 on conflict(version_id,item_key) do update set item_snapshot=excluded.item_snapshot,title=excluded.title,file_ids=excluded.file_ids,public_file_ids=excluded.public_file_ids,status=excluded.status,reason='',requested_at=excluded.requested_at,reviewed_at=null,reviewed_by=null,updated_at=clock_timestamp() returning * into old;
 return to_jsonb(old);
end $$;
revoke all on function public.save_profile_item_review(uuid,text,uuid[],uuid[],boolean,timestamptz) from public,anon;
grant execute on function public.save_profile_item_review(uuid,text,uuid[],uuid[],boolean,timestamptz) to authenticated;

create function public.decide_profile_item_review(p_id uuid,p_decision text,p_reason text,p_expected timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception '관리자만 심사할 수 있습니다.'; end if;
 if p_decision not in ('verified','rejected') or length(coalesce(p_reason,''))>2000 or (p_decision='rejected' and btrim(coalesce(p_reason,''))='') then raise exception '심사 결과와 반려 사유를 확인해주세요.'; end if;
 update public.profile_item_reviews set status=p_decision,reason=coalesce(p_reason,''),reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),updated_at=clock_timestamp()
 where id=p_id and status='pending' and updated_at=p_expected;
 if not found then raise exception '이미 처리되었거나 변경된 요청입니다. 새로고침해주세요.'; end if;
end $$;
revoke all on function public.decide_profile_item_review(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.decide_profile_item_review(uuid,text,text,timestamptz) to authenticated;

create function public.public_profile_item_reviews(p_profile uuid)
returns table(id uuid,title text,files jsonb) language sql stable security definer set search_path='' as $$
 select r.id,r.title,coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name)) from public.damoa_files f where f.owner=r.owner_id and f.id=any(r.public_file_ids) and f.ready and not f.deleting),'[]'::jsonb)
 from public.get_representative_profiles(array[p_profile]) p
 join public.profile_versions v on v.profile_id=p_profile and v.is_representative
 join public.profile_item_reviews r on r.version_id=v.id and r.status='verified'
 where public.profile_review_target(r.item_key,p.content,p.expert)=r.item_snapshot;
$$;
revoke all on function public.public_profile_item_reviews(uuid) from public;
grant execute on function public.public_profile_item_reviews(uuid) to anon,authenticated;

create function public.profile_review_file(p_review uuid,p_file uuid)
returns table(path text,name text,mime text) language sql stable security definer set search_path='' as $$
 select f.path,f.name,f.mime from public.profile_item_reviews r
 join public.profile_versions v on v.id=r.version_id
 join public.damoa_files f on f.owner=r.owner_id and f.id=p_file and f.id=any(r.file_ids) and f.ready and not f.deleting
 where r.id=p_review and (
  auth.uid()=r.owner_id or (auth.uid() is not null and public.is_admin(auth.uid()))
  or (p_file=any(r.public_file_ids) and exists(select 1 from public.public_profile_item_reviews(v.profile_id) visible where visible.id=r.id))
 );
$$;
revoke all on function public.profile_review_file(uuid,uuid) from public;
grant execute on function public.profile_review_file(uuid,uuid) to anon,authenticated;
-- Storage remains private; access is limited to the exact authorized review/file pair.
create function damoa_internal.review_file_readable(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.damoa_files stored join public.profile_item_reviews r on r.owner_id=stored.owner and r.file_ids @> array[stored.id], lateral public.profile_review_file(r.id,stored.id) f where stored.path=p_path and f.path=p_path);
$$;
revoke all on function damoa_internal.review_file_readable(text) from public;
grant usage on schema damoa_internal to anon;
grant execute on function damoa_internal.review_file_readable(text) to anon,authenticated;
create policy damoa_review_read on storage.objects for select to anon,authenticated
 using(bucket_id='damoa-files' and damoa_internal.review_file_readable(name));
-- A referenced proof cannot disappear through the unused-file cleanup flow.
create function damoa_internal.protect_review_file() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='DELETE' or new.deleting) and exists(select 1 from public.profile_item_reviews where owner_id=old.owner and old.id=any(file_ids)) then raise exception '프로필에 첨부한 자료입니다. 첨부를 해제한 뒤 정리해주세요.'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function damoa_internal.protect_review_file() from public,anon,authenticated;
create trigger protect_profile_review_file before update or delete on public.damoa_files for each row execute function damoa_internal.protect_review_file();
