import Link from "next/link";
import { OperatingAudit } from "./OperatingAudit";
import type { LiveData } from "@/lib/admin-live";
import { CampaignForm, OperatingEntryForm } from "./LiveControls";
const money = (n: number) => `${n.toLocaleString("ko-KR")}원`;
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold">
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </p>
    </div>
  );
}
export function TrafficPanel({ data, days }: { data: LiveData; days: number }) {
  return (
    <div className="space-y-5">
      <PeriodLinks view="traffic" days={days} />
      <div className="grid grid-cols-2 gap-3">
        <Metric label="방문 브라우저" value={data.visitors} />
        <Metric label="페이지 조회" value={data.pageviews} />
      </div>
      <p className="text-xs leading-6 text-slate-500">
        통계 연결일{" "}
        {new Date(data.started_at).toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
        })}{" "}
        · 한국 날짜 기준. 방문자는 30일 쿠키로 구분한 브라우저 수이며 사람이
        아닙니다. 쿠키 삭제·차단 시 오차가 있습니다. 기존 Vercel 통계는 작업
        접속 제외 기준이 달라 합치지 않습니다.
      </p>
      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold">일별 방문 추이</h3>
        {!data.daily.length ? (
          <p className="mt-4 text-sm text-slate-500">
            선택 기간에 수집된 방문이 없습니다.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.daily.map((r) => (
              <div
                key={r.day}
                className="grid grid-cols-[90px_1fr] items-center gap-3 text-xs"
              >
                <span>{r.day}</span>
                <div>
                  <div className="h-2 rounded bg-blue-50">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{
                        width: `${Math.max(0, (r.views / Math.max(...data.daily.map((x) => x.views), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-slate-500">
                    방문 {r.visitors} · 조회 {r.views}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            title: "인기 페이지",
            rows: data.paths.map((r) => ({ label: r.path, value: r.views })),
          },
          {
            title: "접속 기기",
            rows: data.devices.map((r) => ({
              label:
                { desktop: "PC", mobile: "모바일", tablet: "태블릿" }[
                  r.device
                ] || r.device,
              value: r.views,
            })),
          },
          {
            title: "유입 경로",
            rows: data.referrers.map((r) => ({
              label: r.referrer || "직접·출처 없음",
              value: r.views,
            })),
          },
          {
            title: "주요 행동",
            rows: data.events
              .filter((r) => r.kind !== "pageview")
              .map((r) => ({
                label: (
                  {
                    search: "전문가 검색",
                    contact: "외부 연락 링크 클릭",
                    share: "프로필 공유",
                    ad_view: "광고 가시 노출",
                    ad_click: "광고 클릭",
                  } as Record<string, string>
                )[r.kind],
                value: r.total,
              })),
          },
        ].map((s) => (
          <section
            key={s.title}
            className="min-w-0 rounded-2xl border border-slate-200 p-5"
          >
            <h3 className="font-bold">{s.title}</h3>
            {s.rows.length ? (
              s.rows.map((r) => (
                <div
                  key={r.label}
                  className="mt-3 flex justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 break-all text-slate-500">
                    {r.label}
                  </span>
                  <strong>{r.value}</strong>
                </div>
              ))
            ) : (
              <p className="mt-3 text-sm text-slate-400">수집 기록 없음</p>
            )}
          </section>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        연락·공유 클릭 수는 상담 성사 수가 아닙니다. 검색어·연락 주소·IP·전체
        외부 URL은 저장하지 않습니다.
      </p>
    </div>
  );
}
export function CampaignPanel({
  data,
  days,
}: {
  data: LiveData;
  days: number;
}) {
  return (
    <div className="space-y-5">
      <PeriodLinks view="ads" days={days} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="선택 기간 기록된 입금"
          value={money(data.finance.received)}
        />
        <Metric
          label="선택 기간 기록된 비용"
          value={money(data.finance.expenses)}
        />
        <Metric
          label="전체 광고 계약 미수금"
          value={money(data.finance.outstanding)}
        />
      </div>
      <p className="text-xs leading-6 text-slate-500">
        입금·비용은 관리자가 원장에 기록한 금액입니다. 은행·Vercel·Supabase
        청구서 자동 연동은 아니며, 미등록 비용은 합계에 포함되지 않습니다.
      </p>
      <CampaignForm />
      <OperatingEntryForm campaigns={data.campaigns} />
      {!data.campaigns.length && (
        <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
          등록된 광고 계약이 없습니다. 흰색 광고 자리는 그대로 유지됩니다.
        </p>
      )}
      {data.campaigns.map((c) => (
        <section key={c.id} className="rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h3 className="font-bold">
                {c.advertiser} · {c.title}
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                {c.slot === "left" ? "왼쪽" : "오른쪽"} · {c.starts_on} ~{" "}
                {c.ends_on} · {c.active ? "게재 설정 켜짐" : "비노출"}
              </p>
            </div>
            <p className="text-sm">
              계약 {money(c.amount)} · 입금 {money(c.paid)}
            </p>
          </div>
          <div className="my-4 grid grid-cols-3 gap-3">
            <Metric label="가시 노출" value={c.views} />
            <Metric label="클릭" value={c.clicks} />
            <Metric
              label="클릭률"
              value={
                c.views
                  ? `${((c.clicks / c.views) * 100).toFixed(2)}%`
                  : "계산 불가"
              }
            />
          </div>
          <CampaignForm campaign={c} />
        </section>
      ))}
      <p className="text-xs leading-6 text-slate-500">
        광고 노출·클릭은 선택 기간 기준, 계약·입금 합계는 계약 전체 기준입니다.
        화면 50% 이상·1초 이상 표시된 광고만 브라우저 보고로 집계합니다. 제3자
        인증 측정은 아닙니다. 현재 계약 목록은 최근 100건입니다.
      </p>
      <EntryList data={data} />
    </div>
  );
}
function EntryList({ data }: { data: LiveData }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <h3 className="font-bold">운영 원장 · 최근 100건</h3>
      {data.entries.length ? (
        data.entries.map((e) => (
          <div key={e.id} className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <strong>{e.label}</strong>
              <span>
                {e.kind === "backup_check"
                  ? "백업 확인"
                  : e.kind === "payment"
                    ? `입금 ${money(e.amount)}`
                    : `비용 ${money(e.amount)}`}
              </span>
            </div>
            <p className="mt-1 break-words text-xs text-slate-500">
              {e.occurred_on} · {e.note}
            </p>
          </div>
        ))
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          관리자가 등록한 내역이 없습니다.
        </p>
      )}
    </section>
  );
}
export function OperationsPanel({ data }: { data: LiveData }) {
  const backup = data.last_backup;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="실제 파일 저장량"
          value={`${(data.storage.bytes / 1048576).toFixed(2)} MB`}
        />
        <Metric label="저장 파일 수" value={data.storage.files} />
        <Metric
          label="최근 백업 확인 기록"
          value={backup?.occurred_on || "확인 기록 없음"}
        />
      </div>
      <p className="text-xs leading-6 text-slate-500">
        저장량은 전체 Storage 객체 메타데이터 기준이며 DB 자체 용량은
        제외합니다. 업로드 예약 용량은 실제 파일 저장량과 구분합니다. 백업 확인
        기록은 공급자의 자동 백업 보증이 아닙니다.
      </p>
      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold">계정별 다모아 사용량 · 상위 20개</h3>
        {data.storage_accounts.length ? (
          data.storage_accounts.map((a) => (
            <div key={a.owner} className="mt-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>{a.display_name || "프로필 미작성 계정"}</span>
                <span>{((a.bytes || 0) / 1048576).toFixed(2)} / 100 MB</span>
              </div>
              <div className="mt-2 h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-primary"
                  style={{
                    width: `${Math.min(100, (a.bytes || 0) / 1048576)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                업로드 예약 {((a.reserved || 0) / 1048576).toFixed(2)} MB
              </p>
            </div>
          ))
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            등록된 다모아 파일이 없습니다.
          </p>
        )}
      </section>
      <OperatingEntryForm campaigns={data.campaigns} backup />
      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold">현재 실행 정보</h3>
        <p className="mt-3 break-all text-sm text-slate-500">
          환경: {process.env.VERCEL_ENV || "로컬 개발"}
          <br />
          커밋: {process.env.VERCEL_GIT_COMMIT_SHA || "로컬 작업본"}
        </p>
        <p className="mt-3 text-xs text-slate-400">
          현재 서버가 DB 집계에 성공한 결과입니다. 상시 장애 감시나 백업 복구
          테스트 결과는 아닙니다.
        </p>
      </section>
      <OperatingAudit rows={data.audit} />
    </div>
  );
}

function PeriodLinks({ view, days }: { view: string; days: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 7, 30].map((n) => (
        <Link
          key={n}
          href={`/admin?view=${view}&days=${n}`}
          aria-current={days === n ? "page" : undefined}
          className={`rounded-lg border px-4 py-3 text-sm ${days === n ? "border-blue-300 bg-blue-50 text-primary" : "border-slate-200"}`}
        >
          {n === 1 ? "오늘" : `최근 ${n}일`}
        </Link>
      ))}
    </div>
  );
}
