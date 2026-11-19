-- Limit only new Damoa reservations; existing rows, files, function grants and retries remain unchanged.
create or replace function public.damoa_reserve_file(p_id uuid,p_activity uuid,p_name text,p_mime text)
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
 if total+10485760>52428800 then raise exception '50MB 저장 한도입니다. 안전한 업로드를 위해 10MB의 여유 공간이 필요합니다. 사용하지 않는 자료를 정리해주세요.'; end if;
 insert into public.damoa_files(owner,id,activity_id,name,mime,path)
 values(u,p_id,p_activity,p_name,p_mime,u::text||'/'||p_activity::text||'/'||p_id::text) returning * into f;
 return to_jsonb(f);
end $$;
