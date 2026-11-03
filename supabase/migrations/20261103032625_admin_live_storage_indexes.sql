create index site_events_campaign_date on public.site_events(campaign_id,created_at) where campaign_id is not null;
create index operating_entries_campaign on public.operating_entries(campaign_id) where campaign_id is not null;
create index operating_entries_admin on public.operating_entries(admin_id) where admin_id is not null;
create or replace function public.get_admin_live_data(p_days int default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare since_at timestamptz; result jsonb;
begin
 if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception '관리자만 조회할 수 있습니다.'; end if;
 if p_days not in (1,7,30) then raise exception '조회 기간을 확인해주세요.'; end if;
 since_at:=((now() at time zone 'Asia/Seoul')::date-(p_days-1))::timestamp at time zone 'Asia/Seoul';
 select jsonb_build_object(
 'started_at',(select started_at from public.site_collection_settings where id),
 'visitors',(select count(distinct visitor_id) from public.site_events where created_at>=since_at and kind='pageview'),
 'pageviews',(select count(*) from public.site_events where created_at>=since_at and kind='pageview'),
 'today_visitors',(select count(distinct visitor_id) from public.site_events where created_at>=((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul' and kind='pageview'),
 'daily',(select coalesce(jsonb_agg(t),'[]') from (select (created_at at time zone 'Asia/Seoul')::date as day,count(*) filter(where kind='pageview') as views,count(distinct visitor_id) filter(where kind='pageview') as visitors from public.site_events where created_at>=since_at group by 1 order by 1) t),
 'paths',(select coalesce(jsonb_agg(t),'[]') from(select path,count(*) as views from public.site_events where created_at>=since_at and kind='pageview' group by 1 order by 2 desc limit 20)t),
 'devices',(select coalesce(jsonb_agg(t),'[]') from(select device,count(*) as views from public.site_events where created_at>=since_at and kind='pageview' group by 1)t),
 'referrers',(select coalesce(jsonb_agg(t),'[]') from(select referrer,count(*) as views from public.site_events where created_at>=since_at and kind='pageview' group by 1 order by 2 desc limit 20)t),
 'events',(select coalesce(jsonb_agg(t),'[]') from(select kind,count(*) as total from public.site_events where created_at>=since_at group by 1)t),
 'campaigns',(select coalesce(jsonb_agg(t),'[]') from(select c.*,coalesce((select sum(amount) from public.operating_entries where campaign_id=c.id and kind='payment'),0) as paid,(select count(*) from public.site_events where campaign_id=c.id and kind='ad_view' and created_at>=since_at) as views,(select count(*) from public.site_events where campaign_id=c.id and kind='ad_click' and created_at>=since_at) as clicks from public.ad_campaigns c order by created_at desc limit 100)t),
 'entries',(select coalesce(jsonb_agg(t),'[]') from(select * from public.operating_entries order by created_at desc limit 100)t),
 'last_backup',(select to_jsonb(t) from(select * from public.operating_entries where kind='backup_check' order by occurred_on desc,created_at desc limit 1)t),
 'finance',(select jsonb_build_object('outstanding',(select coalesce(sum(c.amount-coalesce((select sum(e.amount) from public.operating_entries e where e.campaign_id=c.id and e.kind='payment'),0)),0) from public.ad_campaigns c),'received',coalesce(sum(amount) filter(where kind='payment'),0),'expenses',coalesce(sum(amount) filter(where kind='expense'),0)) from public.operating_entries where occurred_on between (now() at time zone 'Asia/Seoul')::date-(p_days-1) and (now() at time zone 'Asia/Seoul')::date),
 'storage',(select jsonb_build_object('bytes',coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0),'files',count(*)) from storage.objects ),
 'storage_accounts',(select coalesce(jsonb_agg(t),'[]') from(select f.owner,p.display_name,sum(f.bytes) filter(where f.ready and not f.deleting) as bytes,sum(f.bytes) filter(where not f.ready) as reserved from public.damoa_files f left join public.profiles p on p.user_id=f.owner group by f.owner,p.display_name order by 3 desc nulls last limit 20)t),
 'audit',(select coalesce(jsonb_agg(t),'[]') from(select created_at,action,target_id,detail from public.operating_audit order by created_at desc limit 50)t),
 'signups',(select count(*) from auth.users where created_at>=since_at),
 'activities',(select count(*) from public.damoa_activities),
 'public_profiles',(select count(*) from public.profiles where is_public and owner_visible and verification_status='approved' and suspended_at is null and deletion_requested_at is null)
 ) into result; return result;
end $$;
