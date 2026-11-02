-- Keep review evidence protected during ordinary cleanup without blocking account deletion.
alter table public.profile_item_reviews drop constraint profile_item_reviews_reviewed_by_fkey;
alter table public.profile_item_reviews add constraint profile_item_reviews_reviewed_by_fkey foreign key(reviewed_by) references auth.users(id) on delete set null;
create or replace function damoa_internal.protect_review_file() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='DELETE' or new.deleting)
 and exists(select 1 from auth.users where id=old.owner)
 and exists(select 1 from public.profile_item_reviews where owner_id=old.owner and old.id=any(file_ids))
 then raise exception '프로필에 첨부한 자료입니다. 첨부를 해제한 뒤 정리해주세요.'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function damoa_internal.protect_review_file() from public,anon,authenticated;
