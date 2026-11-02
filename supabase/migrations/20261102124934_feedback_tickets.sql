-- Private feedback intake. No profile/public-data changes.
create table public.feedback_tickets (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('suggestion','report')),
 category text not null,
 subject text not null check(length(btrim(subject)) between 1 and 100),
 body text not null check(length(btrim(body)) between 10 and 5000),
 page_url text not null default '' check(length(page_url)<=2000),
 status text not null default 'submitted' check(status in ('submitted','reviewing','resolved')),
 reply text not null default '' check(length(reply)<=5000),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index feedback_owner_date on public.feedback_tickets(owner_id,created_at desc);
create index feedback_queue on public.feedback_tickets(status,created_at desc);
alter table public.feedback_tickets enable row level security;
revoke all on public.feedback_tickets from public,anon,authenticated;
grant select on public.feedback_tickets to authenticated;
create policy feedback_owner_admin on public.feedback_tickets for select to authenticated
 using(owner_id=(select auth.uid()) or public.is_admin(auth.uid()));
create function public.submit_feedback(p_id uuid,p_kind text,p_category text,p_subject text,p_body text,p_page_url text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); old public.feedback_tickets; total int;
begin
 if u is null then raise exception '로그인 후 접수해주세요.'; end if;
 if p_id is null or p_kind is null or p_category is null or p_subject is null or p_body is null or p_page_url is null then raise exception '입력 내용을 확인해주세요.'; end if;
 if (p_kind='suggestion' and p_category not in ('서비스 개선','기능 제안','오류 제보','기타 의견'))
 or (p_kind='report' and p_category not in ('허위 프로필·이력','부적절한 내용','개인정보 침해','기타 신고'))
 or p_kind not in ('suggestion','report') then raise exception '제안·신고 분류를 확인해주세요.'; end if;
 if length(btrim(p_subject)) not between 1 and 100 or length(btrim(p_body)) not between 10 and 5000 or length(p_page_url)>2000
 or (btrim(p_page_url)<>'' and btrim(p_page_url)!~* '^https?://[^[:space:]]+$') or btrim(p_page_url)~* '^https?://[^/?#]*@' then raise exception '제목·내용·페이지 주소를 확인해주세요.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,45672));
 select * into old from public.feedback_tickets where id=p_id;
 if found then
  if old.owner_id<>u or old.kind<>p_kind or old.category<>p_category or old.subject<>btrim(p_subject) or old.body<>btrim(p_body) or old.page_url<>btrim(p_page_url) then raise exception '새 접수 화면에서 다시 작성해주세요.'; end if;
  return old.id;
 end if;
 select count(*) into total from public.feedback_tickets where owner_id=u and created_at>clock_timestamp()-interval '1 hour';
 if total>=5 then raise exception '한 시간에 5건까지 접수할 수 있습니다. 잠시 후 다시 시도해주세요.'; end if;
 insert into public.feedback_tickets(id,owner_id,kind,category,subject,body,page_url) values(p_id,u,p_kind,p_category,btrim(p_subject),btrim(p_body),btrim(p_page_url));
 return p_id;
end $$;
revoke all on function public.submit_feedback(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.submit_feedback(uuid,text,text,text,text,text) to authenticated;
create function public.update_feedback(p_id uuid,p_status text,p_reply text,p_expected timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception '관리자만 처리할 수 있습니다.'; end if;
 if p_status is null or p_reply is null or p_status not in ('reviewing','resolved') or length(p_reply)>5000 or (p_status='resolved' and btrim(p_reply)='') then raise exception '처리 상태와 안내 내용을 확인해주세요.'; end if;
 update public.feedback_tickets set status=p_status,reply=btrim(p_reply),updated_at=clock_timestamp() where id=p_id and updated_at=p_expected;
 if not found then raise exception '다른 창에서 변경된 접수입니다. 새로고침해주세요.'; end if;
end $$;
revoke all on function public.update_feedback(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.update_feedback(uuid,text,text,timestamptz) to authenticated;
