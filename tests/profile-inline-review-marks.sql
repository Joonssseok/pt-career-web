-- Read-only verification; uses the already-public example profile, no member writes.
begin;
set local role anon;
do $$
declare
  profile uuid := '5caf08f5-0a7a-4ba4-a81d-38d668654ea5';
begin
  if exists (
    select id, files from public.public_profile_item_reviews(profile)
    except select id, files from public.public_profile_item_review_marks(profile)
  ) or exists (
    select id, files from public.public_profile_item_review_marks(profile)
    except select id, files from public.public_profile_item_reviews(profile)
  ) then raise exception 'Public approval/file scope changed'; end if;
  if exists (
    select 1 from public.public_profile_item_review_marks(profile)
    where item_ref !~ '^[0-9a-f]{64}$'
  ) then raise exception 'Raw item identity exposed'; end if;
  if exists (
    select 1 from public.public_profile_item_review_marks('00000000-0000-0000-0000-000000000000')
  ) then raise exception 'Unknown profile exposed'; end if;
end $$;
rollback;
