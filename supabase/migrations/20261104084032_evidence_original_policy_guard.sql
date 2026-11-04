-- Evaluate administrator membership internally; anonymous callers receive only a caller-scoped boolean.
create function damoa_internal.original_file_readable(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    split_part(p_path,'/',1)=auth.uid()::text or public.is_admin(auth.uid())
  );
$$;
revoke all on function damoa_internal.original_file_readable(text) from public;
grant execute on function damoa_internal.original_file_readable(text) to anon,authenticated;
alter policy evidence_original_read_fence on storage.objects
using (
  bucket_id not in ('damoa-files','evidence-files')
  or damoa_internal.original_file_readable(name)
);
