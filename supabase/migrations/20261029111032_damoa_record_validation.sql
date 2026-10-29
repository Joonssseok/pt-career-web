alter table public.damoa_activities add constraint damoa_text_fields check(coalesce(
 jsonb_typeof(content->'title')='string' and
 jsonb_typeof(content->'category')='string' and
 jsonb_typeof(content->'period')='string' and
 jsonb_typeof(content->'description')='string' and
 jsonb_typeof(content->'learning')='string' and
 jsonb_typeof(content->'link')='string' and
 jsonb_typeof(content->'memo')='string',false));
grant all on public.damoa_activities,public.damoa_files,public.damoa_browser_imports to service_role;
