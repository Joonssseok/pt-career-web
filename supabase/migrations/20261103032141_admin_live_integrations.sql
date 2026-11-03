-- Additive operational data. No existing profile, evidence or owner permissions change.
create table public.site_events (
 id uuid primary key, visitor_id uuid not null, created_at timestamptz not null default clock_timestamp(),
 kind text not null check(kind in ('pageview','search','contact','share','ad_view','ad_click')),
 path text not null check(length(path)<=160), referrer text not null default '' check(length(referrer)<=200),
 device text not null check(device in ('desktop','mobile','tablet')), campaign_id uuid
);
create index site_events_date on public.site_events(created_at);
create index site_events_visitor on public.site_events(visitor_id,created_at);
create table public.ad_campaigns (
 id uuid primary key default gen_random_uuid(), advertiser text not null check(length(btrim(advertiser)) between 1 and 100),
 title text not null check(length(btrim(title)) between 1 and 100), slot text not null check(slot in ('left','right')),
 image_url text not null check(length(image_url)<=2000), target_url text not null check(length(target_url)<=2000),
 starts_on date not null, ends_on date not null, active boolean not null default false,
 amount bigint not null default 0 check(amount between 0 and 1000000000),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check(ends_on>=starts_on), check(image_url ~ '^https://[^[:space:]]+$' and image_url !~ '^https://[^/?#]*@'),
 check(target_url ~ '^https://[^[:space:]]+$' and target_url !~ '^https://[^/?#]*@')
);
alter table public.site_events add foreign key(campaign_id) references public.ad_campaigns(id);
create table public.operating_entries (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('payment','expense','backup_check')),
 label text not null check(length(btrim(label)) between 1 and 200), amount bigint not null default 0 check(amount between 0 and 1000000000),
 campaign_id uuid references public.ad_campaigns(id), occurred_on date not null, note text not null default '' check(length(note)<=2000),
 created_at timestamptz not null default clock_timestamp(), admin_id uuid references auth.users(id) on delete set null,
 check(kind<>'payment' or campaign_id is not null), check(kind<>'backup_check' or amount=0)
);
create table public.operating_audit (
 id bigint generated always as identity primary key, created_at timestamptz not null default clock_timestamp(),
 admin_id uuid, action text not null, target_id text not null, detail text not null
);
create table public.site_collection_settings (id boolean primary key default true check(id),started_at timestamptz not null default clock_timestamp());
insert into public.site_collection_settings(id) values(true);
alter table public.site_events enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.operating_entries enable row level security;
alter table public.operating_audit enable row level security;
alter table public.site_collection_settings enable row level security;
revoke all on public.site_events,public.ad_campaigns,public.operating_entries,public.operating_audit,public.site_collection_settings from public,anon,authenticated;
grant select on public.ad_campaigns,public.operating_entries,public.operating_audit to authenticated;
create policy campaigns_admin on public.ad_campaigns for select to authenticated using(public.is_admin((select auth.uid())));
create policy entries_admin on public.operating_entries for select to authenticated using(public.is_admin((select auth.uid())));
create policy operating_audit_admin on public.operating_audit for select to authenticated using(public.is_admin((select auth.uid())));

create function public.collect_site_event(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v uuid:=(p->>'visitor_id')::uuid; k text:=p->>'kind'; route text:=p->>'path'; c uuid:=nullif(p->>'campaign_id','')::uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service only'; end if;
 if v is null or (p->>'id') is null or k not in ('pageview','search','contact','share','ad_view','ad_click')
 or route !~ '^(/|/home|/experts|/about|/experts/[0-9a-f-]{36})$' then raise exception 'invalid event'; end if;
 if k in ('ad_view','ad_click') and not exists(select 1 from public.ad_campaigns where id=c and active and (clock_timestamp() at time zone 'Asia/Seoul')::date between starts_on and ends_on) then return; end if;
 if k not in ('ad_view','ad_click') then c:=null; end if;
 perform pg_advisory_xact_lock(hashtextextended(v::text,32454));
 if (select count(*) from public.site_events where visitor_id=v and created_at>clock_timestamp()-interval '1 minute')>=60 then return; end if;
 insert into public.site_events(id,visitor_id,kind,path,referrer,device,campaign_id)
 values((p->>'id')::uuid,v,k,route,left(coalesce(p->>'referrer',''),200),p->>'device',c) on conflict(id) do nothing;
 -- Opportunistic cleanup supplements the daily retention job.
 delete from public.site_events where id in (select id from public.site_events where created_at<clock_timestamp()-interval '90 days' order by created_at limit 1000);
end $$;
revoke all on function public.collect_site_event(jsonb) from public,anon,authenticated;
grant execute on function public.collect_site_event(jsonb) to service_role;

create function public.get_active_ad_campaigns() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(t),'[]') from (
 select distinct on(slot) id,title,slot,image_url,target_url from public.ad_campaigns
 where active and (now() at time zone 'Asia/Seoul')::date between starts_on and ends_on order by slot,created_at desc
 ) t;
$$;
revoke all on function public.get_active_ad_campaigns() from public;
grant execute on function public.get_active_ad_campaigns() to anon,authenticated;

create function public.save_ad_campaign(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
begin
 if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception '관리자만 변경할 수 있습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ad-campaigns',32455));
 if (p->>'amount')::bigint < coalesce((select sum(amount) from public.operating_entries where campaign_id=v and kind='payment'),0) then raise exception '계약 금액은 이미 받은 입금 합계보다 작을 수 없습니다.'; end if;
 if (p->>'active')::boolean and exists(select 1 from public.ad_campaigns where id<>v and slot=p->>'slot' and active and starts_on<=(p->>'ends_on')::date and ends_on>=(p->>'starts_on')::date) then raise exception '같은 자리의 광고 기간이 겹칩니다.'; end if;
 insert into public.ad_campaigns(id,advertiser,title,slot,image_url,target_url,starts_on,ends_on,active,amount)
 values(v,btrim(p->>'advertiser'),btrim(p->>'title'),p->>'slot',p->>'image_url',p->>'target_url',(p->>'starts_on')::date,(p->>'ends_on')::date,(p->>'active')::boolean,(p->>'amount')::bigint)
 on conflict(id) do update set advertiser=excluded.advertiser,title=excluded.title,slot=excluded.slot,image_url=excluded.image_url,target_url=excluded.target_url,starts_on=excluded.starts_on,ends_on=excluded.ends_on,active=excluded.active,amount=excluded.amount,updated_at=clock_timestamp();
 return v;
end $$;
create function public.add_operating_entry(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid:=gen_random_uuid(); c uuid:=nullif(p->>'campaign_id','')::uuid;
begin
 if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception '관리자만 기록할 수 있습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ad-campaigns',32455));
 if (p->>'occurred_on')::date > (now() at time zone 'Asia/Seoul')::date then raise exception '확인 기록은 미래 날짜로 등록할 수 없습니다.'; end if;
 if p->>'kind'='payment' and coalesce((select sum(amount) from public.operating_entries where campaign_id=c and kind='payment'),0)+(p->>'amount')::bigint > coalesce((select amount from public.ad_campaigns where id=c),-1) then raise exception '입금 합계는 계약 금액을 초과할 수 없습니다.'; end if;
 insert into public.operating_entries(id,kind,label,amount,campaign_id,occurred_on,note,admin_id) values(v,p->>'kind',btrim(p->>'label'),(p->>'amount')::bigint,c,(p->>'occurred_on')::date,coalesce(p->>'note',''),auth.uid());
 return v;
end $$;
revoke all on function public.save_ad_campaign(jsonb),public.add_operating_entry(jsonb) from public,anon;
grant execute on function public.save_ad_campaign(jsonb),public.add_operating_entry(jsonb) to authenticated;

create function public.record_operating_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb:=to_jsonb(new); d text;
begin
 if tg_table_name='ad_campaigns' then d:='광고 설정 저장';
 elsif tg_table_name='operating_entries' then d:='운영 원장 등록: '||(v->>'kind');
 elsif tg_table_name='feedback_tickets' then
  if to_jsonb(old)->>'status' is not distinct from v->>'status' then return new; end if;
  d:='문의 상태: '||(v->>'status');
 elsif tg_table_name='profile_item_reviews' then
  if to_jsonb(old)->>'status' is not distinct from v->>'status' or v->>'status' not in ('verified','rejected') then return new; end if;
  d:='증빙 심사: '||(v->>'status');
 else return new; end if;
 insert into public.operating_audit(admin_id,action,target_id,detail) values(auth.uid(),tg_table_name,v->>'id',d);return new;
end $$;
revoke all on function public.record_operating_audit() from public,anon,authenticated;
create trigger campaign_audit after insert or update on public.ad_campaigns for each row execute function public.record_operating_audit();
create trigger entry_audit after insert on public.operating_entries for each row execute function public.record_operating_audit();
create trigger feedback_operating_audit after update on public.feedback_tickets for each row execute function public.record_operating_audit();
create trigger evidence_operating_audit after update on public.profile_item_reviews for each row execute function public.record_operating_audit();

create function public.get_admin_members(p_query text default '',p_offset int default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception '관리자만 조회할 수 있습니다.'; end if;
 if p_offset<0 or p_offset>100000 or length(p_query)>100 then raise exception '조회 조건을 확인해주세요.'; end if;
 return (select coalesce(jsonb_agg(t),'[]') from (select u.id,u.email,u.created_at,u.last_sign_in_at,p.display_name,p.id as profile_id,p.is_public,p.suspended_at,p.deletion_requested_at from auth.users u left join public.profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_query||'%' or coalesce(p.display_name,'') ilike '%'||p_query||'%' order by u.created_at desc,u.id limit 51 offset p_offset) t);
end $$;
revoke all on function public.get_admin_members(text,int) from public,anon;
grant execute on function public.get_admin_members(text,int) to authenticated;

create function public.get_admin_live_data(p_days int default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 'storage',(select jsonb_build_object('bytes',coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0),'files',count(*)) from storage.objects where bucket_id in ('damoa-files','profile-images','evidence-files')),
 'storage_accounts',(select coalesce(jsonb_agg(t),'[]') from(select f.owner,p.display_name,sum(f.bytes) filter(where f.ready and not f.deleting) as bytes,sum(f.bytes) filter(where not f.ready) as reserved from public.damoa_files f left join public.profiles p on p.user_id=f.owner group by f.owner,p.display_name order by 3 desc nulls last limit 20)t),
 'audit',(select coalesce(jsonb_agg(t),'[]') from(select created_at,action,target_id,detail from public.operating_audit order by created_at desc limit 50)t),
 'signups',(select count(*) from auth.users where created_at>=since_at),
 'activities',(select count(*) from public.damoa_activities),
 'public_profiles',(select count(*) from public.profiles where is_public and owner_visible and verification_status='approved' and suspended_at is null and deletion_requested_at is null)
 ) into result; return result;
end $$;
revoke all on function public.get_admin_live_data(int) from public,anon;
grant execute on function public.get_admin_live_data(int) to authenticated;

create function public.purge_expired_site_events() returns bigint language plpgsql security definer set search_path='' as $$
declare removed bigint;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service only'; end if;
 delete from public.site_events where created_at < clock_timestamp()-interval '90 days';
 get diagnostics removed = row_count; return removed;
end $$;
revoke all on function public.purge_expired_site_events() from public,anon,authenticated;
grant execute on function public.purge_expired_site_events() to service_role;
