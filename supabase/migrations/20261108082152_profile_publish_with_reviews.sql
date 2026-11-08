-- Keep evidence requests and representative publication in one transaction.
create function public.publish_profile_with_reviews(p_id uuid, p_content jsonb, p_reviews jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
 u uuid := auth.uid();
 v public.profile_versions;
 old public.profile_item_reviews;
 expert jsonb;
 item jsonb;
 target jsonb;
 k text;
 keys_seen text[] := '{}';
 files uuid[];
 public_files uuid[];
 expected timestamptz;
 has_previous boolean;
 unchanged boolean;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 if jsonb_typeof(p_reviews) is distinct from 'array' or jsonb_array_length(p_reviews)>200 then
  raise exception '심사 자료 목록을 확인해주세요.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2901));
 -- Match the existing publisher's lock order during mixed-version releases.
 perform 1 from public.profiles where user_id=u for update;
 select * into v from public.profile_versions where id=p_id and owner_id=u for update;
 if not found then raise exception '본인의 저장된 프로필만 게시할 수 있습니다.'; end if;
 if v.draft_content is distinct from p_content then
  raise exception '프로필이 변경되었습니다. 저장 내용을 다시 확인해주세요.';
 end if;
 select to_jsonb(e) into expert from public.public_expert_detail e where id=v.profile_id;
 for item in select value from jsonb_array_elements(p_reviews) loop
  k:=item->>'key';
  if k is null or length(k) not between 1 and 20000 or k=any(keys_seen)
   or jsonb_typeof(item->'fileIds') is distinct from 'array'
   or jsonb_typeof(item->'publicIds') is distinct from 'array' then
   raise exception '중복되거나 잘못된 심사 항목입니다.';
  end if;
  keys_seen:=array_append(keys_seen,k);
  files:=array(select value::uuid from jsonb_array_elements_text(item->'fileIds'));
  public_files:=array(select value::uuid from jsonb_array_elements_text(item->'publicIds'));
  expected:=(item->>'expected')::timestamptz;
  target:=public.profile_review_target(k,v.draft_content,expert);
  if target is null then raise exception '현재 프로필에 포함된 항목만 요청할 수 있습니다.'; end if;
  if left(k,6)='damoa:' and not public.profile_activity_has_content(target) then
   raise exception '프로필에서 숨긴 항목은 심사 요청할 수 없습니다.';
  end if;
  if cardinality(files)>20 or not public_files<@files
    or cardinality(files)<>(select count(distinct x) from unnest(files) x)
    or cardinality(public_files)<>(select count(distinct x) from unnest(public_files) x) then
   raise exception '첨부 자료 선택을 확인해주세요.';
  end if;
  if exists(select 1 from unnest(files) f where not exists(
    select 1 from public.damoa_files d where d.id=f and d.owner=u and d.ready and not d.deleting
  )) then raise exception '본인이 보관한 업로드 완료 자료만 사용할 수 있습니다.'; end if;
  select * into old from public.profile_item_reviews where version_id=p_id and item_key=k for update;
  has_previous:=found;
  if has_previous and old.updated_at is distinct from expected
    or not has_previous and expected is not null then
   raise exception '심사 내역이 변경되었습니다. 다시 불러와주세요.';
  end if;
  unchanged:=has_previous and old.item_snapshot=target
   and files@>old.file_ids and old.file_ids@>files
   and public_files@>old.public_file_ids and old.public_file_ids@>public_files;
  -- Preserve completed and in-flight reviews; unchanged rejected files need correction first.
  if unchanged and old.status in ('verified','pending','rejected') then continue; end if;
  if cardinality(files)=0 and not has_previous then continue; end if;
  perform public.save_profile_item_review(p_id,k,files,public_files,cardinality(files)>0,expected);
 end loop;
 -- Any publish failure rolls back every review request above.
 perform public.publish_profile_version(p_id);
end $$;
revoke all on function public.publish_profile_with_reviews(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.publish_profile_with_reviews(uuid,jsonb,jsonb) to authenticated;
