-- Public documents are rendered server-side. Originals remain owner/admin only.
create function public.public_profile_evidence_file(p_review uuid, p_file uuid)
returns table(path text, name text, mime text, bytes bigint, revision timestamptz)
language sql stable security definer set search_path='' as $$
  select f.path, f.name, f.mime, f.bytes, r.updated_at
  from public.profile_item_reviews r
  join public.profile_versions v on v.id=r.version_id
  join public.damoa_files f on f.owner=r.owner_id and f.id=p_file
  join lateral public.public_profile_item_reviews(v.profile_id) visible on visible.id=r.id
  where r.id=p_review and p_file=any(r.file_ids) and p_file=any(r.public_file_ids)
    and f.ready and not f.deleting;
$$;
revoke all on function public.public_profile_evidence_file(uuid,uuid) from public;
grant execute on function public.public_profile_evidence_file(uuid,uuid) to anon,authenticated,service_role;

create or replace function public.profile_review_file(p_review uuid,p_file uuid)
returns table(path text,name text,mime text)
language sql stable security definer set search_path='' as $$
  select f.path,f.name,f.mime from public.profile_item_reviews r
  join public.damoa_files f on f.owner=r.owner_id and f.id=p_file
    and f.id=any(r.file_ids) and f.ready and not f.deleting
  where r.id=p_review and auth.uid() is not null
    and (auth.uid()=r.owner_id or public.is_admin(auth.uid()));
$$;

-- Restrictive policies remain effective even if a permissive public policy is added later.
create policy evidence_original_read_fence on storage.objects
as restrictive for select to anon,authenticated
using (
  bucket_id not in ('damoa-files','evidence-files')
  or (auth.uid() is not null and (
    (storage.foldername(name))[1]=auth.uid()::text or public.is_admin(auth.uid())
  ))
);
