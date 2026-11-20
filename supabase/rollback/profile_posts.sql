-- Disable only the new feature. Retain posts, snapshots, images and cleanup records.
begin;
drop policy if exists post_image_read on storage.objects;
drop policy if exists post_image_insert on storage.objects;
alter policy post_image_read_fence on storage.objects using(bucket_id<>'profile-post-images');
alter policy post_image_insert_fence on storage.objects with check(bucket_id<>'profile-post-images');
-- Other bucket policies are untouched; new bucket remains private and denied.
revoke all on all functions in schema posts_private from public,anon,authenticated,service_role;
revoke all on all tables in schema posts_private from public,anon,authenticated,service_role;
revoke all on schema posts_private from public,anon,authenticated,service_role;
do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('create_profile_post','save_profile_post','list_profile_posts','get_profile_post','delete_profile_post','reserve_profile_post_image','finish_profile_post_image','profile_post_image_path','profile_post_cleanup_batch','ack_profile_post_cleanup')
 loop execute format('revoke all on function %s from public,anon,authenticated,service_role',fn); end loop;
end $$;
commit;
