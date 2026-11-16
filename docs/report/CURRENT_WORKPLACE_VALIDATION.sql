-- Run after approval and application. Pure function assertions; no user rows are written.
do $test$
declare c jsonb := '{"headline":"","introduction":"","sections":[],"activities":[]}'::jsonb;
w jsonb := '{"sourceActivityId":"00000000-0000-4000-8000-000000000001","centerName":"예시 기관","address":"서울특별시 중구 세종대로 110","phone":"02-1234-5678","websiteUrl":"https://example.com"}'::jsonb;
e jsonb := '{"experiences":[],"academic_records":[],"educations":[],"licenses":[],"workplace_center_name":"기존 기관","workplace_address":"기존 주소"}'::jsonb;
r jsonb;
begin
 if not public.profile_version_content_valid(c) then raise exception 'legacy validation changed'; end if;
 if not public.profile_version_content_valid(c || jsonb_build_object('currentWorkplace',w)) then raise exception 'valid workplace rejected'; end if;
 if not public.profile_version_content_valid(c || '{"currentWorkplace":null}'::jsonb) then raise exception 'clear rejected'; end if;
 if public.profile_version_content_valid(c || '{"currentWorkplace":"invalid"}'::jsonb) then raise exception 'scalar accepted'; end if;
 if public.profile_version_content_valid(c || jsonb_build_object('currentWorkplace',w || '{"websiteUrl":"javascript:alert(1)"}'::jsonb)) then raise exception 'unsafe URL accepted'; end if;
 if public.profile_version_content_valid(c || jsonb_build_object('currentWorkplace',w || '{"privateNotes":"never public"}'::jsonb)) then raise exception 'unknown field accepted'; end if;
 if public.profile_version_visible_expert(e,c)->>'workplace_address' <> '기존 주소' then raise exception 'legacy display changed'; end if;
 r:=public.profile_version_visible_expert(e,c || jsonb_build_object('currentWorkplace',w));
 if r->>'workplace_address' <> w->>'address' then raise exception 'snapshot not applied'; end if;
 if r ? 'sourceActivityId' or r ? 'currentWorkplace' then raise exception 'private source leaked'; end if;
 r:=public.profile_version_visible_expert(e,c || jsonb_build_object('currentWorkplace',w,'excluded',jsonb_build_array('workplace:0'),'activityRegion','서울'));
 if r->>'workplace_address' is not null or r->>'workplace_center_name' is not null or r->>'workplace_region' <> '서울' then raise exception 'hidden workplace leaked'; end if;
 r:=public.profile_version_visible_expert(e,c || '{"currentWorkplace":null}'::jsonb);
 if r->>'workplace_address' is not null then raise exception 'clear failed'; end if;
end $test$;
