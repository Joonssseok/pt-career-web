-- Reuse the existing public eligibility checks; expose no snapshots or raw keys.
create function public.public_profile_item_review_marks(p_profile uuid)
returns table(id uuid, item_ref text, files jsonb)
language sql stable security definer set search_path = ''
as $$
  select visible.id,
         encode(sha256(convert_to(review.item_key, 'UTF8')), 'hex'),
         visible.files
  from public.public_profile_item_reviews(p_profile) visible
  join public.profile_item_reviews review on review.id = visible.id;
$$;
revoke all on function public.public_profile_item_review_marks(uuid) from public, anon, authenticated;
grant execute on function public.public_profile_item_review_marks(uuid) to anon, authenticated;
