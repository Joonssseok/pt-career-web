-- Permission-only rollback. Retains campaigns, registrations and timestamps.
-- Does not grant a restore path or delete/change any data. Run only with approval.
begin;
revoke all on function public.own_referral_status(), public.register_referral_code(text),
  public.list_referral_campaigns(), public.create_referral_campaign(text,text),
  public.set_referral_campaign_active(text,boolean) from public, anon, authenticated;
revoke all on all functions in schema referral_private from public, anon, authenticated;
revoke all on all tables in schema referral_private from public, anon, authenticated;
revoke all on schema referral_private from public, anon, authenticated;
commit;
