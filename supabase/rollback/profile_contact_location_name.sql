-- Restore the former pure projection without name; preserve all grants and stored data.
-- Compatible with profile_contact_inquiry.sql rollback: no public card is re-enabled.
begin;
create or replace function public.profile_contact_inquiry_public(c jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:='{}'::jsonb;
begin
 if c is null then return null; end if;
 if not public.profile_contact_inquiry_valid(c) then return '{}'::jsonb; end if;
 if (c->'inquiry'->>'visible')::boolean and btrim(c->'inquiry'->>'value')<>'' then
   result:=result||jsonb_build_object('inquiry',jsonb_build_object('label',coalesce(nullif(btrim(c->>'inquiryLabel'),''),'수업 문의하기'),'url',c->'inquiry'->>'value'));
 end if;
 if (c->'phone'->>'visible')::boolean and btrim(c->'phone'->>'value')<>'' then result:=result||jsonb_build_object('phone',btrim(c->'phone'->>'value')); end if;
 if (c->'email'->>'visible')::boolean and btrim(c->'email'->>'value')<>'' then result:=result||jsonb_build_object('email',btrim(c->'email'->>'value')); end if;
 if (c->'address'->>'visible')::boolean and btrim(c->'address'->>'value')<>'' then
   result:=result||jsonb_build_object('address',jsonb_build_object('base',btrim(c->'address'->>'value'),'detail',btrim(c->>'detailAddress')));
 end if;
 if (c->>'mapVisible')::boolean and c->'location'<>'null'::jsonb then
   result:=result||jsonb_build_object('map',jsonb_build_object('latitude',c->'location'->'latitude','longitude',c->'location'->'longitude'));
 end if;
 return result;
end;
$$;
commit;
