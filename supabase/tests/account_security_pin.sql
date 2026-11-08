-- Synthetic fixtures only. Everything, including trigger side effects, is rolled back.
begin;
select set_config('test.pin_uid',gen_random_uuid()::text,true);
select set_config('test.pin_sid',gen_random_uuid()::text,true);
select set_config('test.pin_other_sid',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at)
values(current_setting('test.pin_uid')::uuid,'pin-fixture-'||current_setting('test.pin_uid')||'@example.invalid',now());
insert into auth.sessions(id,user_id,created_at)
values(current_setting('test.pin_sid')::uuid,current_setting('test.pin_uid')::uuid,now()),
(current_setting('test.pin_other_sid')::uuid,current_setting('test.pin_uid')::uuid,now());
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.pin_uid'),'role','authenticated','session_id',current_setting('test.pin_sid'),'is_anonymous',false,'amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',floor(extract(epoch from now()))::bigint)))::text,true);
set local role authenticated;
do $$ begin
  if public.account_pin_status()->>'configured'<>'false' then raise exception 'initial_status'; end if;
  if public.set_account_pin('12345',false)<>'invalid_pin' then raise exception 'invalid_input'; end if;
  if public.set_account_pin('012345',false)<>'ok' then raise exception 'setup'; end if;
  if public.set_account_pin('999999',false)<>'already_configured' then raise exception 'overwrite'; end if;
  if public.set_account_pin('999999',true)<>'recovery_required' then raise exception 'reset_without_email'; end if;
  if public.account_pin_status()->>'verified'<>'false' then raise exception 'setup_does_not_unlock'; end if;
  if public.verify_account_pin('012345')<>'ok' then raise exception 'verify'; end if;
  if public.account_pin_status()->>'verified'<>'true' then raise exception 'verified_status'; end if;
  for i in 1..4 loop
    if public.verify_account_pin('999999')<>'incorrect' then raise exception 'attempt_counter'; end if;
  end loop;
  if public.verify_account_pin('999999')<>'locked' then raise exception 'fifth_lock'; end if;
  if public.verify_account_pin('012345')<>'locked' then raise exception 'correct_during_lock'; end if;
  begin
    perform 1 from pin_private.account_pins;
    raise exception 'hash_table_exposed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from pin_private.account_pins where pin_hash='012345' or pin_hash not like '$2a$12$%') then raise exception 'hash_format'; end if;
end $$;
update pin_private.account_pins set locked_until=now()-interval '1 second' where user_id=current_setting('test.pin_uid')::uuid;
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{session_id}',to_jsonb(current_setting('test.pin_other_sid')))::text,true);
set local role authenticated;
do $$ begin
  if public.account_pin_status()->>'verified'<>'false' then raise exception 'other_session'; end if;
  if public.verify_account_pin('012345')<>'ok' then raise exception 'expired_lock'; end if;
end $$;
reset role;
update pin_private.personal_verifications set expires_at=now()-interval '1 second' where user_id=current_setting('test.pin_uid')::uuid;
-- Simulate an older PIN and a fresh signed email-recovery authentication claim.
update pin_private.account_pins set updated_at=now()-interval '1 minute' where user_id=current_setting('test.pin_uid')::uuid;
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{amr}',jsonb_build_array(jsonb_build_object('method','recovery','timestamp',floor(extract(epoch from now()))::bigint)))::text,true);
set local role authenticated;
do $$ begin
  if public.account_pin_status()->>'verified'<>'false' then raise exception 'expired_unlock'; end if;
  if public.account_pin_status()->>'recovery_allowed'<>'true' then raise exception 'fresh_recovery'; end if;
  if public.set_account_pin('654321',true)<>'ok' then raise exception 'reset'; end if;
  if public.account_pin_status()->>'verified'<>'false' then raise exception 'reset_revokes_all'; end if;
  if public.set_account_pin('123456',true)<>'recovery_required' then raise exception 'recovery_replay'; end if;
  if public.verify_account_pin('012345')<>'incorrect' then raise exception 'old_pin'; end if;
  if public.verify_account_pin('654321')<>'ok' then raise exception 'new_pin'; end if;
end $$;
reset role;
-- Another account never gets status or verification of the first account.
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{sub}',to_jsonb(gen_random_uuid()::text))::text,true);
set local role authenticated;
do $$ begin
  begin perform public.account_pin_status(); raise exception 'wrong_owner';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.pin_uid'),'session_id',current_setting('test.pin_sid'),'amr',jsonb_build_array(jsonb_build_object('method','recovery','timestamp',extract(epoch from now()-interval '11 minutes')::bigint)))::text,true);
set local role authenticated;
do $$ begin
  if public.set_account_pin('123456',true)<>'recovery_required' then raise exception 'expired_recovery'; end if;
end $$;
reset role;
delete from auth.sessions where id=current_setting('test.pin_sid')::uuid;
set local role authenticated;
do $$ begin
  begin perform public.verify_account_pin('654321'); raise exception 'revoked_session';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.account_pin_status(); raise exception 'anonymous_status';
  exception when insufficient_privilege then null; end;
  begin perform public.set_account_pin('123456',false); raise exception 'anonymous_setup';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'account_pin_security_checks_passed_and_rolled_back' as result;

