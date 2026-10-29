-- Additive profile versions. Existing profiles.id remains the public identity.
-- Rollback: revert readers to public_expert_detail; retain this table to preserve drafts.
create or replace function public.profile_version_content_valid(v jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; k text;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>200000 then return false; end if;
 if (v - array['headline','introduction','sections','activities']::text[]) <> '{}'::jsonb then return false; end if;
 if jsonb_typeof(v->'headline') is distinct from 'string' or length(v->>'headline')>100 then return false; end if;
 if jsonb_typeof(v->'introduction') is distinct from 'string' or length(v->>'introduction')>5000 then return false; end if;
 if jsonb_typeof(v->'sections') is distinct from 'array' or jsonb_typeof(v->'activities') is distinct from 'array' then return false; end if;
 if jsonb_array_length(v->'activities')>100 or jsonb_array_length(v->'sections')>5 then return false; end if;
 for item in select value from jsonb_array_elements(v->'sections') loop
  if jsonb_typeof(item) is distinct from 'string' or (item#>>'{}') not in ('experiences','academic_records','educations','licenses','gallery') then return false; end if;
 end loop;
 for item in select value from jsonb_array_elements(v->'activities') loop
  if jsonb_typeof(item) is distinct from 'object' or (item-array['id','category','title','period','description','learning']::text[])<>'{}'::jsonb then return false; end if;
  foreach k in array array['id','category','title','period','description','learning'] loop
   if jsonb_typeof(item->k) is distinct from 'string' or length(item->>k)>5000 then return false; end if;
  end loop;
  if length(btrim(item->>'title'))=0 then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.profile_version_content_valid(jsonb) from public;
grant execute on function public.profile_version_content_valid(jsonb) to authenticated;

create table public.profile_versions (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 80),
 draft_content jsonb not null check(public.profile_version_content_valid(draft_content)),
 published_content jsonb,
 published_expert jsonb,
 published_gallery jsonb,
 is_representative boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 check(not is_representative or (published_content is not null and published_expert is not null))
);
create index profile_versions_owner_idx on public.profile_versions(owner_id);
create unique index profile_versions_one_representative on public.profile_versions(owner_id) where is_representative;
alter table public.profile_versions enable row level security;
revoke all on public.profile_versions from anon, authenticated;
grant select on public.profile_versions to authenticated;
create policy profile_versions_owner_read on public.profile_versions for select to authenticated using(owner_id=(select auth.uid()));

-- Existing published data is captured by the existing filtered public view only.
insert into public.profile_versions(profile_id,owner_id,title,draft_content,published_content,published_expert,published_gallery,is_representative,published_at)
select p.id,p.user_id,'기본 프로필',c.content,
 case when d.id is not null then c.content end,
 case when d.id is not null then to_jsonb(d) end,
 case when d.id is not null then coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'imagePath',g.image_path,'caption',coalesce(g.caption,'')) order by g.display_order) from public.profile_gallery_images g where g.profile_id=p.id),'[]'::jsonb) end,
 d.id is not null,case when d.id is not null then now() end
from public.profiles p left join public.public_expert_detail d on d.id=p.id
cross join lateral (select jsonb_build_object('headline',coalesce(p.headline,''),'introduction',coalesce(p.introduction,''),'sections',jsonb_build_array('experiences','academic_records','educations','licenses','gallery'),'activities','[]'::jsonb) content) c;

create function public.save_profile_version(p_id uuid,p_title text,p_content jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); pid uuid; result uuid;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 80 then raise exception '관리용 제목은 1~80자로 입력해주세요.'; end if;
 if not public.profile_version_content_valid(p_content) then raise exception '프로필 입력 형식을 확인해주세요.'; end if;
 select id into pid from public.profiles where user_id=uid;
 if pid is null then raise exception '먼저 기본 정보와 기존 프로필을 작성해주세요.'; end if;
 if p_id is null then
  insert into public.profile_versions(profile_id,owner_id,title,draft_content) values(pid,uid,btrim(p_title),p_content) returning id into result;
 else
  update public.profile_versions set title=btrim(p_title),draft_content=p_content,updated_at=now() where id=p_id and owner_id=uid returning id into result;
  if result is null then raise exception '수정할 프로필을 찾을 수 없습니다.'; end if;
 end if;
 return result;
end $$;
revoke all on function public.save_profile_version(uuid,text,jsonb) from public;
grant execute on function public.save_profile_version(uuid,text,jsonb) to authenticated;

create function public.publish_profile_version(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.profiles%rowtype; v public.profile_versions%rowtype; snapshot jsonb; gallery jsonb;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 select * into p from public.profiles where user_id=uid for update;
 if p.id is null then raise exception '프로필이 없습니다.'; end if;
 if p.suspended_at is not null or p.deletion_requested_at is not null then raise exception '현재 공개할 수 없는 계정입니다.'; end if;
 if p.verification_status<>'approved' or not p.is_public then raise exception '기본 프로필 공개 승인이 먼저 필요합니다.'; end if;
 select * into v from public.profile_versions where id=p_id and owner_id=uid and profile_id=p.id for update;
 if v.id is null then raise exception '공개할 프로필을 찾을 수 없습니다.'; end if;
 update public.profiles set owner_visible=true where id=p.id;
 select to_jsonb(d) into snapshot from public.public_expert_detail d where d.id=p.id;
 if snapshot is null then raise exception '공개 조건을 확인하지 못했습니다.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'imagePath',g.image_path,'caption',coalesce(g.caption,'')) order by g.display_order),'[]'::jsonb) into gallery from public.profile_gallery_images g where g.profile_id=p.id;
 update public.profile_versions set is_representative=false where owner_id=uid and is_representative;
 update public.profile_versions set is_representative=true,published_content=draft_content,published_expert=snapshot,published_gallery=gallery,published_at=now() where id=v.id;
end $$;
revoke all on function public.publish_profile_version(uuid) from public;
grant execute on function public.publish_profile_version(uuid) to authenticated;

-- Never return private titles, unpublished drafts, owner IDs or attachment originals.
create function public.get_representative_profiles(p_profile_ids uuid[])
returns table(profile_id uuid,content jsonb,expert jsonb,gallery jsonb)
language sql stable security definer set search_path='' as $$
 select v.profile_id,v.published_content,
 v.published_expert || jsonb_build_object('licenses', d.licenses),v.published_gallery
 from public.profile_versions v join public.profiles p on p.id=v.profile_id
 join public.public_expert_detail d on d.id=p.id
 where v.is_representative and v.profile_id=any(p_profile_ids)
 and p.is_public and p.owner_visible and p.verification_status='approved' and p.suspended_at is null and p.deletion_requested_at is null;
$$;
revoke all on function public.get_representative_profiles(uuid[]) from public;
grant execute on function public.get_representative_profiles(uuid[]) to anon,authenticated;
