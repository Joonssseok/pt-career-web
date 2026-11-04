-- Additive: a separate private bucket, 20 MiB/image and 200 MiB/account.
-- Damoa quotas, evidence access and existing drafts/public files are unchanged.
-- Rollback: revert application callers; retain private originals and attachment rows.
create schema profile_images_internal;
revoke all on schema profile_images_internal from public;
grant usage on schema profile_images_internal to anon,authenticated;
create table public.profile_detail_uploads (
 owner_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 group_id uuid not null,
 name text not null check(length(name) between 1 and 255),
 mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
 path text not null unique,
 bytes bigint not null default 20971520 check(bytes between 1 and 20971520),
 ready boolean not null default false,
 deleting boolean not null default false,
 primary key(owner_id,id)
);
create table public.profile_detail_attachments (
 version_id uuid primary key references public.profile_versions(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 draft_file_ids uuid[] not null default '{}',
 published_file_ids uuid[] not null default '{}',
 updated_at timestamptz not null default clock_timestamp()
);
create index profile_detail_owner_idx on public.profile_detail_attachments(owner_id);
alter table public.profile_detail_uploads enable row level security;
alter table public.profile_detail_attachments enable row level security;
revoke all on public.profile_detail_uploads,public.profile_detail_attachments from public,anon,authenticated;
grant select on public.profile_detail_uploads,public.profile_detail_attachments to authenticated;
create policy detail_upload_owner_read on public.profile_detail_uploads for select to authenticated using(owner_id=(select auth.uid()));
create policy detail_attachment_owner_read on public.profile_detail_attachments for select to authenticated using(owner_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-detail-images','profile-detail-images',false,20971520,array['image/jpeg','image/png','image/webp']);

create function public.reserve_profile_detail_image(p_id uuid,p_group uuid,p_name text,p_mime text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); f public.profile_detail_uploads; total bigint;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 select * into f from public.profile_detail_uploads where owner_id=u and id=p_id;
 if found then
  if f.deleting or f.group_id<>p_group or f.name<>p_name or f.mime<>p_mime then raise exception '이미지가 변경되었습니다. 다시 선택해주세요.'; end if;
  return to_jsonb(f);
 end if;
 select coalesce(sum(bytes),0) into total from public.profile_detail_uploads where owner_id=u;
 if total+20971520>209715200 then raise exception '프로필 이미지 전용 200MB 한도입니다. 사용하지 않는 이미지를 정리해주세요.'; end if;
 insert into public.profile_detail_uploads(owner_id,id,group_id,name,mime,path)
 values(u,p_id,p_group,p_name,p_mime,u::text||'/'||p_group::text||'/'||p_id::text) returning * into f;
 return to_jsonb(f);
end $$;
create function public.finish_profile_detail_image(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); f public.profile_detail_uploads; m jsonb;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 select * into f from public.profile_detail_uploads where owner_id=u and id=p_id for update;
 if not found or f.deleting then raise exception '이미지 업로드를 먼저 시작해주세요.'; end if;
 select metadata into m from storage.objects where bucket_id='profile-detail-images' and name=f.path;
 if m is null or (m->>'size') is null or (m->>'size')::bigint not between 1 and 20971520 or m->>'mimetype' is distinct from f.mime then raise exception '파일 크기 또는 형식을 확인해주세요.'; end if;
 update public.profile_detail_uploads set bytes=(m->>'size')::bigint,ready=true where owner_id=u and id=p_id;
end $$;
revoke all on function public.reserve_profile_detail_image(uuid,uuid,text,text),public.finish_profile_detail_image(uuid) from public,anon;
grant execute on function public.reserve_profile_detail_image(uuid,uuid,text,text),public.finish_profile_detail_image(uuid) to authenticated;

create function profile_images_internal.can_upload(p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 return exists(select 1 from public.profile_detail_uploads where owner_id=u and path=p_path and not ready and not deleting and bytes=20971520);
end $$;
revoke all on function profile_images_internal.can_upload(text) from public;
grant execute on function profile_images_internal.can_upload(text) to authenticated;
create policy detail_object_owner_read on storage.objects for select to authenticated using(bucket_id='profile-detail-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy detail_object_insert on storage.objects for insert to authenticated with check(bucket_id='profile-detail-images' and profile_images_internal.can_upload(name));

-- Cleanup is opt-in and only claims images absent from every draft and published snapshot.
create function public.claim_unused_profile_detail_image(p_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); f public.profile_detail_uploads;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 select * into f from public.profile_detail_uploads where owner_id=u and id=p_id;
 if not found then return null; end if;
 if exists(select 1 from public.profile_detail_attachments where owner_id=u and (p_id=any(draft_file_ids) or p_id=any(published_file_ids))) then return null; end if;
 update public.profile_detail_uploads set deleting=true where owner_id=u and id=p_id;
 return f.path;
end $$;
create function public.release_profile_detail_image(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); f public.profile_detail_uploads;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 select * into f from public.profile_detail_uploads where owner_id=u and id=p_id;
 if not found then return; end if;
 if not f.deleting or exists(select 1 from storage.objects where bucket_id='profile-detail-images' and name=f.path)
 or exists(select 1 from public.profile_detail_attachments where owner_id=u and (p_id=any(draft_file_ids) or p_id=any(published_file_ids))) then raise exception '사용 중인 이미지는 정리할 수 없습니다.'; end if;
 delete from public.profile_detail_uploads where owner_id=u and id=p_id;
end $$;
revoke all on function public.claim_unused_profile_detail_image(uuid),public.release_profile_detail_image(uuid) from public,anon;
grant execute on function public.claim_unused_profile_detail_image(uuid),public.release_profile_detail_image(uuid) to authenticated;
create policy detail_object_delete on storage.objects for delete to authenticated using(bucket_id='profile-detail-images' and exists(select 1 from public.profile_detail_uploads f where f.owner_id=(select auth.uid()) and f.path=storage.objects.name and f.deleting));
create function public.save_profile_with_detail_images(p_id uuid,p_title text,p_content jsonb,p_files uuid[],p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result uuid; old public.profile_detail_attachments; f uuid;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 if p_files is null or cardinality(p_files)>20 or cardinality(p_files)<>(select count(distinct x) from unnest(p_files) x) then raise exception '첨부 이미지를 확인해주세요.'; end if;
 foreach f in array p_files loop
  if not exists(select 1 from public.profile_detail_uploads f1 where f1.owner_id=u and f1.id=f and f1.ready and not f1.deleting) then raise exception '본인의 업로드 완료 이미지만 저장할 수 있습니다.'; end if;
 end loop;
 if p_id is not null then
  perform 1 from public.profile_versions where id=p_id and owner_id=u for update;
  if not found then raise exception '본인의 프로필만 수정할 수 있습니다.'; end if;
  select * into old from public.profile_detail_attachments where version_id=p_id for update;
  if old.updated_at is distinct from p_expected then raise exception '다른 창에서 첨부파일이 변경되었습니다. 새로고침해주세요.'; end if;
 end if;
 result:=public.save_profile_version(p_id,p_title,p_content);
 insert into public.profile_detail_attachments(version_id,owner_id,draft_file_ids) values(result,u,p_files)
 on conflict(version_id) do update set draft_file_ids=excluded.draft_file_ids,updated_at=clock_timestamp();
 return jsonb_build_object('id',result,'revision',(select updated_at from public.profile_detail_attachments where version_id=result));
end $$;
revoke all on function public.save_profile_with_detail_images(uuid,text,jsonb,uuid[],timestamptz) from public,anon;
grant execute on function public.save_profile_with_detail_images(uuid,text,jsonb,uuid[],timestamptz) to authenticated;

-- Draft saves do not affect the live images. Snapshot only on explicit profile publication.
create function profile_images_internal.publish_detail_images() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.profile_detail_attachments set published_file_ids=draft_file_ids where version_id=new.id;
 return new;
end $$;
revoke all on function profile_images_internal.publish_detail_images() from public,anon,authenticated;
create trigger publish_profile_detail_images after update of published_at on public.profile_versions
 for each row execute function profile_images_internal.publish_detail_images();

create function public.public_profile_detail_images(p_profile uuid)
returns table(id uuid,bytes bigint) language sql stable security definer set search_path='' as $$
 select f.id,f.bytes from public.profile_versions v
 join public.profiles p on p.id=v.profile_id
 join public.profile_detail_attachments a on a.version_id=v.id and a.owner_id=v.owner_id
 cross join lateral unnest(a.published_file_ids) with ordinality ids(file_id,ord)
 join public.profile_detail_uploads f on f.owner_id=a.owner_id and f.id=ids.file_id and f.ready and not f.deleting
 where v.profile_id=p_profile and v.is_representative and v.published_at is not null
 and p.is_public and p.owner_visible and p.verification_status='approved' and p.suspended_at is null and p.deletion_requested_at is null
 order by ids.ord;
$$;
revoke all on function public.public_profile_detail_images(uuid) from public;
grant execute on function public.public_profile_detail_images(uuid) to anon,authenticated;

create function profile_images_internal.detail_image_readable(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profile_detail_uploads f
 join public.profiles p on p.user_id=f.owner_id
 cross join lateral public.public_profile_detail_images(p.id) visible
 where f.path=p_path and visible.id=f.id);
$$;
revoke all on function profile_images_internal.detail_image_readable(text) from public;
grant usage on schema profile_images_internal to anon;
grant execute on function profile_images_internal.detail_image_readable(text) to anon,authenticated;
create policy published_profile_detail_image_read on storage.objects for select to anon,authenticated
 using(bucket_id='profile-detail-images' and profile_images_internal.detail_image_readable(name));

-- Fence only this new bucket against any permissive policies on other buckets.
create policy detail_read_fence on storage.objects as restrictive for select to anon,authenticated
 using(bucket_id<>'profile-detail-images' or (storage.foldername(name))[1]=auth.uid()::text or profile_images_internal.detail_image_readable(name));
create policy detail_insert_fence on storage.objects as restrictive for insert to anon,authenticated
 with check(bucket_id<>'profile-detail-images' or profile_images_internal.can_upload(name));
create policy detail_update_fence on storage.objects as restrictive for update to anon,authenticated
 using(bucket_id<>'profile-detail-images') with check(bucket_id<>'profile-detail-images');
create policy detail_delete_fence on storage.objects as restrictive for delete to anon,authenticated
 using(bucket_id<>'profile-detail-images' or exists(select 1 from public.profile_detail_uploads f where f.owner_id=auth.uid() and f.path=storage.objects.name and f.deleting));

-- A proxy looks up only registered presentation images, then downloads with the caller's RLS.
create function public.profile_detail_image_path(p_file uuid) returns text
language sql stable security definer set search_path='' as $$
 select f.path from public.profile_detail_uploads f
 where f.id=p_file and f.ready and not f.deleting
 and (f.owner_id=auth.uid() or profile_images_internal.detail_image_readable(f.path));
$$;
revoke all on function public.profile_detail_image_path(uuid) from public;
grant execute on function public.profile_detail_image_path(uuid) to anon,authenticated;

create or replace function public.profile_version_public_order(ordering jsonb, expert jsonb, activities jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='{}'::jsonb; group_name text; keys jsonb; entry jsonb; key_text text; identity jsonb; allowed jsonb; kept jsonb; permitted boolean;
begin
 for group_name,keys in select key,value from jsonb_each(coalesce(ordering,'{}'::jsonb)) loop
  kept:='[]'::jsonb;
  if group_name='sections' then
   select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into kept
   from jsonb_array_elements(keys) with ordinality
   where value#>>'{}' in ('specialties','introduction','experiences','academic_records','educations','licenses','gallery','workplace','detail_images')
    or exists(select 1 from jsonb_array_elements(activities) a where 'activity:'||(a->>'category')=value#>>'{}');
  else
   if group_name in ('experiences','academic_records','educations','licenses','specialties') then allowed:=coalesce(expert->group_name,'[]'::jsonb);
   elsif left(group_name,9)='activity:' then select coalesce(jsonb_agg(value),'[]'::jsonb) into allowed from jsonb_array_elements(activities) where value->>'category'=substring(group_name from 10);
   else continue; end if;
   for entry in select value from jsonb_array_elements(keys) loop
    key_text:=entry#>>'{}'; permitted:=false;
    select exists(select 1 from jsonb_array_elements(allowed) a where a->>'id'=key_text or a->>'slug'=key_text) into permitted;
    if not permitted then
     begin identity:=key_text::jsonb; permitted:=allowed @> jsonb_build_array(identity); exception when invalid_text_representation then permitted:=false; end;
    end if;
    if permitted then kept:=kept||jsonb_build_array(key_text); end if;
   end loop;
  end if;
  if jsonb_array_length(kept)>0 then result:=jsonb_set(result,array[group_name],kept); end if;
 end loop;
 return result;
end $$;
revoke all on function public.profile_version_public_order(jsonb,jsonb,jsonb) from public;
