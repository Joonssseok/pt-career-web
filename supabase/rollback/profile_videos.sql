-- Disable every new API path while preserving metadata and all existing data.
begin;
revoke all on function public.get_own_video_profile(), public.list_profile_videos(uuid,boolean,integer,integer,text),
  public.save_profile_video(uuid,text,text,text,timestamptz), public.delete_profile_video(uuid) from public, anon, authenticated, service_role;
revoke all on all functions in schema video_private from public, anon, authenticated, service_role;
revoke all on video_private.profile_videos from public, anon, authenticated, service_role;
revoke all on schema video_private from public, anon, authenticated, service_role;
commit;
