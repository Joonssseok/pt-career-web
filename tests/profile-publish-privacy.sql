-- Run after the public-publishing migration. Synthetic values only; no profile is modified.
DO $test$
DECLARE
 item jsonb:='{"organization_name":"비공개 기관","position":"담당"}'::jsonb;
 expert jsonb; content jsonb; safe jsonb; ordering jsonb;
BEGIN
 content:=jsonb_build_object('headline','소개','introduction','본문','sections',jsonb_build_array('experiences'),'activities','[]'::jsonb,'excluded',jsonb_build_array('experiences:'||item::text,'introduction:0','workplace:0'));
 expert:=jsonb_build_object('experiences',jsonb_build_array(item,jsonb_build_object('organization_name','공개 기관')),'licenses','[]'::jsonb,'educations','[]'::jsonb,'academic_records','[]'::jsonb,'introduction','본문','total_experience_years',10,'workplace_address','비공개 주소');
 safe:=public.profile_version_visible_expert(expert,content);
 IF safe->'experiences' <> '[{"organization_name":"공개 기관"}]'::jsonb THEN RAISE EXCEPTION 'excluded item exposed'; END IF;
 IF safe->>'introduction' IS NOT NULL OR safe->>'workplace_address' IS NOT NULL OR safe->>'total_experience_years' IS NOT NULL THEN RAISE EXCEPTION 'private singleton exposed'; END IF;
 ordering:=jsonb_build_object('sections',jsonb_build_array('experiences'),'experiences',jsonb_build_array(item::text,'{"organization_name":"공개 기관"}'));
 IF public.profile_version_public_order(ordering,safe,'[]'::jsonb)::text LIKE '%비공개%' THEN RAISE EXCEPTION 'hidden item leaked in order metadata'; END IF;
 IF NOT public.profile_version_content_valid(content) THEN RAISE EXCEPTION 'new content rejected'; END IF;
 IF public.profile_version_content_valid(content||'{"excluded":true}'::jsonb) THEN RAISE EXCEPTION 'invalid exclusions accepted'; END IF;
 IF has_function_privilege('anon','public.publish_profile_version(uuid)','EXECUTE') THEN RAISE EXCEPTION 'anonymous publish enabled'; END IF;
END $test$;
SELECT 'exclusion privacy, order sanitization, validation and anonymous publishing checks passed' as result;
