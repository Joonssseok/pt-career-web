-- Disable new RPCs/projection only; retain all existing and newly saved rows/metadata.
begin;
revoke all on function public.load_own_external_links(),public.save_own_external_links(jsonb,jsonb) from public,anon,authenticated,service_role;
do $$
declare definition text; patched text; matches integer;
 pattern text:=$pattern$jsonb_build_object\(\s*'label'(?:::text)?,\s*el\.label,\s*'url'(?:::text)?,\s*el\.url,\s*'kind'(?:::text)?,\s*el\.kind,\s*'is_primary'(?:::text)?,\s*el\.is_primary\s*\)$pattern$;
begin
 definition:=pg_get_viewdef('public.public_expert_detail'::regclass,true);
 select count(*) into matches from regexp_matches(definition,pattern,'g');
 if matches<>1 then raise exception 'Expected exactly one enriched external-link projection; review current view definition'; end if;
 patched:=regexp_replace(definition,pattern,$replacement$jsonb_build_object('label', el.label, 'url', el.url)$replacement$);
 execute 'create or replace view public.public_expert_detail with (security_invoker=true) as '||patched;
end;
$$;
revoke select(kind,is_primary) on public.profile_extra_links from anon,authenticated;
-- Keep the safe legacy-writer guard so rollback cannot silently erase saved metadata.
commit;
