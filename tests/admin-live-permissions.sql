-- All synthetic writes are rolled back. Existing profiles and files are untouched.
begin;
do $test$
declare
 admin_uid uuid; visitor uuid:=gen_random_uuid(); event_id uuid:=gen_random_uuid(); campaign uuid; second uuid;
 campaign_payload jsonb; data jsonb; denied boolean; n bigint;
begin
 select user_id into admin_uid from public.admin_users limit 1;
 if admin_uid is null then raise exception 'admin fixture missing'; end if;
 if has_function_privilege('anon','public.get_admin_live_data(int)','execute')
 or has_function_privilege('anon','public.get_admin_members(text,int)','execute')
 or has_function_privilege('authenticated','public.collect_site_event(jsonb)','execute')
 or has_table_privilege('authenticated','public.site_events','select')
 or has_table_privilege('authenticated','public.operating_entries','insert') then raise exception 'unsafe grant'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 denied:=false;begin perform public.get_admin_live_data(30);exception when others then denied:=true;end;
 if not denied then raise exception 'non-admin aggregate access'; end if;
 denied:=false;begin perform public.get_admin_members('',0);exception when others then denied:=true;end;
 if not denied then raise exception 'non-admin member access'; end if;
 denied:=false;begin perform public.save_ad_campaign('{}');exception when others then denied:=true;end;
 if not denied then raise exception 'non-admin campaign write'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_uid,'role','authenticated')::text,true);
 data:=public.get_admin_live_data(30);
 if data->'storage' is null or data->'finance' is null then raise exception 'aggregate schema'; end if;
 if jsonb_array_length(public.get_admin_members('',0))=0 then raise exception 'members missing'; end if;
 campaign_payload:=jsonb_build_object('advertiser','[ROLLBACK TEST]','title','test','slot','left','amount',50000,'image_url','https://example.com/test.png','target_url','https://example.com/','active',false,'starts_on',(now() at time zone 'Asia/Seoul')::date,'ends_on',(now() at time zone 'Asia/Seoul')::date);
 campaign:=public.save_ad_campaign(campaign_payload);
 if exists(select 1 from jsonb_array_elements(public.get_active_ad_campaigns()) a where a->>'id'=campaign::text) then raise exception 'inactive ad exposed'; end if;
 perform public.add_operating_entry(jsonb_build_object('kind','payment','campaign_id',campaign,'label','test paid','amount',30000,'occurred_on',current_date,'note','synthetic'));
 denied:=false;begin perform public.add_operating_entry(jsonb_build_object('kind','payment','campaign_id',campaign,'label','overpaid','amount',30000,'occurred_on',current_date,'note','synthetic'));exception when others then denied:=true;end;
 if not denied then raise exception 'overpayment accepted'; end if;
 denied:=false;begin perform public.save_ad_campaign(campaign_payload||jsonb_build_object('id',campaign,'amount',20000));exception when others then denied:=true;end;
 if not denied then raise exception 'contract below paid accepted'; end if;
 perform public.save_ad_campaign(campaign_payload||jsonb_build_object('id',campaign,'active',true));
 denied:=false;begin second:=public.save_ad_campaign(campaign_payload||jsonb_build_object('active',true));exception when others then denied:=true;end;
 if not denied then raise exception 'overlapping active ads accepted'; end if;
 data:=public.get_active_ad_campaigns();
 if not exists(select 1 from jsonb_array_elements(data) a where a->>'id'=campaign::text) or data::text like '%advertiser%' or data::text like '%amount%' then raise exception 'public ad projection invalid'; end if;
 if (select count(*) from public.operating_audit where target_id=campaign::text)<2 then raise exception 'campaign audit missing'; end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 data:=jsonb_build_object('id',event_id,'visitor_id',visitor,'kind','pageview','path','/home','referrer','google.com','device','desktop');
 perform public.collect_site_event(data); perform public.collect_site_event(data);
 if (select count(*) from public.site_events where id=event_id)<>1 then raise exception 'event retry duplicated'; end if;
 for n in 1..65 loop perform public.collect_site_event(data||jsonb_build_object('id',gen_random_uuid())); end loop;
 if (select count(*) from public.site_events where visitor_id=visitor)<>60 then raise exception 'rate limit broken'; end if;
 perform public.collect_site_event(jsonb_build_object('id',gen_random_uuid(),'visitor_id',gen_random_uuid(),'kind','ad_view','path','/home','referrer','','device','desktop','campaign_id',campaign));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_uid,'role','authenticated')::text,true);
 data:=public.get_admin_live_data(1);
 if (data->>'pageviews')::int<60 or not exists(select 1 from jsonb_array_elements(data->'campaigns') a where a->>'id'=campaign::text and (a->>'views')::int=1 and (a->>'paid')::int=30000) then raise exception 'live metrics wrong'; end if;
end $test$;
rollback;
select 'admin permissions, private projection, payment limits, overlap locks, audit, event dedup, rate limiting and metrics passed; synthetic writes rolled back' as result;
