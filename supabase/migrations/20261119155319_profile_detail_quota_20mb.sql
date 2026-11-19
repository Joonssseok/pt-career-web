-- Limit new detail-media uploads to 20 MiB per account. Preserve all existing files and grants.
CREATE OR REPLACE FUNCTION public.reserve_profile_detail_image(p_id uuid, p_group uuid, p_name text, p_mime text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if total>=20971520 then raise exception '상세소개 자료 합계 20MB 한도입니다. 사용하지 않는 자료를 정리해주세요.'; end if;
 insert into public.profile_detail_uploads(owner_id,id,group_id,name,mime,path,bytes)
 values(u,p_id,p_group,p_name,p_mime,u::text||'/'||p_group::text||'/'||p_id::text,20971520-total) returning * into f;
 return to_jsonb(f);
end $function$;

CREATE OR REPLACE FUNCTION public.finish_profile_detail_image(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); f public.profile_detail_uploads; m jsonb; total bigint;
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 select * into f from public.profile_detail_uploads where owner_id=u and id=p_id for update;
 if not found or f.deleting then raise exception '이미지 업로드를 먼저 시작해주세요.'; end if;
 if f.ready then return; end if;
 select metadata into m from storage.objects where bucket_id='profile-detail-images' and name=f.path;
 if m is null or (m->>'size') is null or (m->>'size')::bigint not between 1 and 20971520 or m->>'mimetype' is distinct from f.mime then raise exception '파일 크기 또는 형식을 확인해주세요.'; end if;
 if (m->>'size')::bigint>f.bytes then raise exception '상세소개 자료 합계 20MB 한도입니다.'; end if;
 select coalesce(sum(bytes),0) into total from public.profile_detail_uploads where owner_id=u and id<>p_id;
 if total+(m->>'size')::bigint>20971520 then raise exception '상세소개 자료 합계 20MB 한도입니다.'; end if;
 update public.profile_detail_uploads set bytes=(m->>'size')::bigint,ready=true where owner_id=u and id=p_id;
end $function$;

CREATE OR REPLACE FUNCTION profile_images_internal.can_upload(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();
begin
 if u is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,7311));
 if (select coalesce(sum(bytes),0) from public.profile_detail_uploads where owner_id=u)>20971520 then return false; end if;
 return exists(select 1 from public.profile_detail_uploads where owner_id=u and path=p_path and not ready and not deleting and bytes between 1 and 20971520);
end $function$;
