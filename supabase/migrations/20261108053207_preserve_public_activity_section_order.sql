-- Preserve only the order of sections already visible in the public profile.
-- Explicit aliases keep the activity subquery from shadowing the saved section key.
create or replace function public.profile_version_public_order(ordering jsonb, expert jsonb, activities jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='{}'::jsonb; group_name text; keys jsonb; entry jsonb; key_text text; identity jsonb; allowed jsonb; kept jsonb; permitted boolean;
begin
 for group_name,keys in select key,value from jsonb_each(coalesce(ordering,'{}'::jsonb)) loop
  kept:='[]'::jsonb;
  if group_name='sections' then
   select coalesce(jsonb_agg(section_key.value order by section_key.ordinality),'[]'::jsonb) into kept
   from jsonb_array_elements(keys) with ordinality as section_key(value,ordinality)
   where section_key.value#>>'{}' in ('specialties','introduction','experiences','academic_records','educations','licenses','gallery','workplace','detail_images')
    or exists(select 1 from jsonb_array_elements(activities) as visible_activity(value)
      where 'activity:'||(visible_activity.value->>'category')=section_key.value#>>'{}');
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
