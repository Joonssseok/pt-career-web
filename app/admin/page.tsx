import { AdRevenueEstimator } from "./AdRevenueEstimator";
import { AdminFeedbackQueue } from "@/components/feedback/AdminFeedbackQueue";
import { EvidenceReviewQueue } from "./EvidenceReviewQueue";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAdminDashboardStats,
  getAdminReviewKpis,
  getAdminUsersList,
} from "@/app/actions/admin";
import { AuditLog } from "./AuditLog";
import { AllProfilesList, type AdminProfileListItem } from "./AllProfilesList";

export const dynamic = "force-dynamic";

// 10_DECISION_LOG.md (2026-07-28): 출시(2026-10) 시점까지 전문가 프로필 10명 내외가 1차 목표.
const LAUNCH_TARGET_PUBLIC_PROFILES = 10;

type ProfessionRef = { name: string; slug: string };

type PendingProfile = {
  id: string;
  display_name: string | null;
  submitted_at: string | null;
  profile_professions: {
    custom_label: string | null;
    display_order: number;
    // supabase-js의 조인 타입 추론이 to-one FK를 배열로 볼 때가 있어 둘 다 수용
    professions: ProfessionRef | ProfessionRef[] | null;
  }[];
};

// custom 슬롯은 custom_label을, 그 외에는 참조 테이블 name을 표시한다
// (public 뷰의 CASE 처리와 동일한 규칙).
function professionNames(p: PendingProfile): string {
  const names = [...p.profile_professions]
    .sort((a, b) => a.display_order - b.display_order)
    .map((pp) => {
      const ref = Array.isArray(pp.professions)
        ? pp.professions[0]
        : pp.professions;
      return ref?.slug === "custom" ? pp.custom_label : ref?.name;
    })
    .filter(Boolean);
  return names.length > 0 ? names.join(" · ") : "직군 미입력";
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

  if (adminError || !isAdmin) {
    redirect("/");
  }

  const [
    { data, error },
    { data: allProfilesData, error: allProfilesError },
    statsResult,
    kpisResult,
    adminsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, submitted_at, profile_professions(custom_label, display_order, professions(name, slug))",
      )
      .eq("verification_status", "pending")
      .order("submitted_at", { ascending: true }),
    // 승인·게시 완료 프로필을 포함해 전체를 검색/조회하기 위한 목록 --
    // admin_all RLS 정책(is_admin(auth.uid()))이 이미 관리자에게 상태
    // 무관 전체 조회를 허용하므로 새 RPC/마이그레이션 없이 필터만 뺀다.
    supabase
      .from("profiles")
      .select(
        "id, display_name, verification_status, is_public, suspended_at, profile_professions(custom_label, display_order, professions(name, slug))",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    getAdminDashboardStats(),
    getAdminReviewKpis(),
    getAdminUsersList(),
  ]);

  const query = await searchParams;
  const views = [
    "overview",
    "profiles",
    "reviews",
    "feedback",
    "traffic",
    "ads",
    "operations",
  ];
  const view = views.includes(query.view ?? "") ? query.view! : "overview";
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
  const todayStart = new Date(`${day}T00:00:00+09:00`).toISOString();
  const [evidenceResult, evidenceCount, feedbackCount, newProfileCount] =
    await Promise.all([
      supabase
        .from("profile_item_reviews")
        .select(
          "id,version_id,item_key,item_snapshot,title,file_ids,public_file_ids,status,reason,updated_at",
        )
        .neq("status", "draft")
        .order("requested_at", { ascending: false })
        .limit(200),
      supabase
        .from("profile_item_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("feedback_tickets")
        .select("id", { count: "exact", head: true })
        .neq("status", "resolved"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),
    ]);
  const { data: evidenceReviews, error: evidenceError } = evidenceResult;
  const countText = (result: { error: unknown; count: number | null }) =>
    result.error || result.count === null
      ? "조회 실패"
      : result.count.toLocaleString("ko-KR");
  const pending = (data ?? []) as unknown as PendingProfile[];
  const allProfiles = (allProfilesData ??
    []) as unknown as AdminProfileListItem[];
  const stats = statsResult.ok ? statsResult.stats : null;
  const kpis = kpisResult.ok ? kpisResult.kpis : null;
  const admins = adminsResult.ok ? adminsResult.admins : [];

  const approvalRateText =
    kpis && kpis.approved_count + kpis.rejected_count > 0
      ? `${Math.round((kpis.approved_count / (kpis.approved_count + kpis.rejected_count)) * 100)}%`
      : "—";

  const avgProcessingText =
    kpis?.avg_processing_hours == null
      ? "—"
      : kpis.avg_processing_hours < 0
        ? "기록 확인 필요"
        : `${kpis.avg_processing_hours.toFixed(1)}시간`;

  const navigation = [
    ["overview", "운영 요약", "오늘의 운영 현황을 한눈에 확인하세요."],
    [
      "profiles",
      "회원·프로필",
      "프로필 상태를 확인하고 전문가 정보를 관리하세요.",
    ],
    ["reviews", "심사 관리", "프로필과 항목별 증빙자료를 검토하세요."],
    ["feedback", "제안·신고", "접수된 의견과 신고를 확인하고 답변하세요."],
    [
      "traffic",
      "방문·이용 통계",
      "방문부터 전문가 연결까지의 흐름을 확인하는 공간입니다.",
    ],
    ["ads", "광고·매출", "광고 자리 현황과 단가 가정을 구분해 관리하세요."],
    [
      "operations",
      "운영 기록",
      "관리자 처리 이력과 운영 연결 상태를 확인하세요.",
    ],
  ];
  const selected = navigation.find(([id]) => id === view)!;
  return (
    <main className="min-h-screen bg-white py-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-7">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary">
            PT CAREER / ADMIN
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
            운영 관리
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            사람과 신뢰가 쌓이는 과정을 관리합니다.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">서버 조회 기준 · 한국 시간</p>
          <p className="mt-1 text-sm text-slate-600">
            {new Date().toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
              hour12: false,
            })}
          </p>
          <Link
            href="/home"
            className="mt-3 inline-block text-sm font-medium text-primary"
          >
            서비스로 이동 ↗
          </Link>
        </div>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <nav
            aria-label="관리자 메뉴"
            className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-28 lg:flex-col lg:overflow-visible"
          >
            {navigation.map(([id, label]) => (
              <Link
                key={id}
                href={`/admin?view=${id}`}
                aria-current={view === id ? "page" : undefined}
                className={`flex min-h-12 shrink-0 items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${view === id ? "bg-blue-50 text-primary" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                {label}
                <span aria-hidden="true">{view === id ? "→" : ""}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 space-y-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{selected[1]}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {selected[2]}
            </p>
          </div>
          {view === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                <StatCard label="오늘 방문자" value="미연결" />
                <StatCard
                  label="전체 가입 계정"
                  value={stats?.total_signups ?? "조회 실패"}
                />
                <StatCard
                  label="공개 설정 프로필"
                  value={stats?.public_count ?? "조회 실패"}
                />
                <StatCard
                  label="오늘 생성된 프로필"
                  value={countText(newProfileCount)}
                />
                <StatCard
                  label="증빙 심사 대기"
                  value={countText(evidenceCount)}
                />
                <StatCard
                  label="미처리 제안·신고"
                  value={countText(feedbackCount)}
                />
              </div>
              <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 sm:p-6">
                <h3 className="font-bold text-slate-900">먼저 확인할 일</h3>
                <div className="mt-4 divide-y divide-blue-100">
                  <TaskLink
                    href="/admin?view=reviews"
                    label="프로필 검토 대기"
                    value={stats?.pending_count ?? "조회 실패"}
                  />
                  <TaskLink
                    href="/admin?view=reviews"
                    label="항목별 증빙 심사"
                    value={countText(evidenceCount)}
                  />
                  <TaskLink
                    href="/admin?view=feedback"
                    label="제안·신고 답변"
                    value={countText(feedbackCount)}
                  />
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 p-5 sm:p-6">
                <h3 className="font-bold">성장의 두 가지 흐름</h3>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-primary">이용자</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      방문 → 전문가 탐색 → 프로필 열람 → 연락처·SNS 클릭
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary">전문가</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      가입 → 활동 기록 → 프로필 작성 → 공개 → 공유
                    </p>
                  </div>
                </div>
                <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-400">
                  단계별 전환 통계는 미연결입니다. 연락처 클릭과 실제 상담
                  성사는 별도 지표입니다. 공개 설정 수는 공개 여부를 켠 프로필
                  기준으로, 실제 검색 노출 수와 다를 수 있습니다.
                </p>
              </section>
            </>
          )}
          {view === "profiles" && (
            <>
              {/* 1. 가입/검증 파이프라인 현황 */}
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  가입 · 검증 현황
                </h2>
                {stats ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard label="총 가입자" value={stats.total_signups} />
                    <StatCard label="작성 중" value={stats.draft_count} />
                    <StatCard label="검토 대기" value={stats.pending_count} />
                    <StatCard label="승인" value={stats.approved_count} />
                    <StatCard label="반려" value={stats.rejected_count} />
                    <StatCard
                      label={`공개 전문가 (목표 ${LAUNCH_TARGET_PUBLIC_PROFILES}명)`}
                      value={`${stats.public_count} / ${LAUNCH_TARGET_PUBLIC_PROFILES}`}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    현황을 불러오지 못했습니다.
                  </p>
                )}
              </section>

              {/* 전체 프로필 검색 -- 승인·게시된 프로필 등 상태 무관하게 상세로
            들어갈 수 있는 유일한 경로(임시조치 등은 /admin/[id]에서만 가능). */}
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  전체 프로필 검색
                </h2>
                {allProfilesError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                    목록을 불러오지 못했습니다: {allProfilesError.message}
                  </div>
                ) : (
                  <AllProfilesList profiles={allProfiles} />
                )}
              </section>

              <p className="text-xs leading-6 text-slate-400">
                목록은 최근 프로필 최대 200개 기준입니다. 전체 계정
                명부·가입일·미작성 회원 조회는 별도 연결이 필요합니다.
              </p>
            </>
          )}
          {view === "reviews" && (
            <>
              {/* 2-1. 검토 대기열 KPI */}
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  검토 대기열 KPI
                </h2>
                {kpis ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard label="대기 중" value={kpis.pending_count} />
                    <StatCard
                      label="평균 처리 시간"
                      value={avgProcessingText}
                    />
                    <StatCard label="승인율" value={approvalRateText} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    KPI를 불러오지 못했습니다.
                  </p>
                )}
              </section>

              {/* 검토 대기 목록 (기존) */}
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  검토 대기 목록
                </h2>
                <div className="space-y-3">
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                      목록을 불러오지 못했습니다: {error.message}
                    </div>
                  )}

                  {!error && pending.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm bg-white rounded-lg border border-gray-200">
                      검토 대기 중인 프로필이 없습니다.
                    </div>
                  )}

                  {pending.map((p) => (
                    <Link
                      key={p.id}
                      href={`/admin/${p.id}`}
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 transition-colors min-h-tap"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {p.display_name ?? "이름 미입력"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {professionNames(p)}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {p.submitted_at
                          ? new Date(p.submitted_at).toLocaleDateString("ko-KR")
                          : ""}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {evidenceError ? (
                <p role="alert" className="text-sm text-red-600">
                  증빙 심사 내역을 불러오지 못했습니다.
                </p>
              ) : (
                <EvidenceReviewQueue rows={evidenceReviews ?? []} />
              )}
              <p className="text-xs text-slate-400">
                증빙 내역은 최근 요청 최대 200개입니다. 상단 대기 수는 전체
                기준입니다.
              </p>
            </>
          )}
          {view === "feedback" && <AdminFeedbackQueue />}
          {view === "traffic" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="오늘 방문자" value="미연결" />
                <StatCard label="최근 30일 페이지 조회" value="미연결" />
              </div>
              <ConnectionCard
                title="방문·행동 통계를 연결할 공간입니다."
                description="실제 방문 통계가 연결되면 오늘·최근 7일·최근 30일의 추이와 유입 경로, PC·모바일 비율을 보여줍니다. 현재 수치를 수집하거나 표시하고 있지 않습니다."
              />
              <section className="rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold">측정 기준</h3>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                  <li>비회원 포함 방문자와 로그인 회원 활동을 구분합니다.</li>
                  <li>
                    방문자 수와 반복 열람을 포함한 페이지 조회 수를 구분합니다.
                  </li>
                  <li>
                    관리자·테스트 방문 제외 여부와 수집 시작일을 표시합니다.
                  </li>
                  <li>
                    데이터가 없거나 연결되지 않은 값은 0으로 표시하지 않습니다.
                  </li>
                </ul>
              </section>
            </>
          )}
          {view === "ads" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {["왼쪽", "오른쪽"].map((side) => (
                  <section
                    key={side}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">{side} 배너</h3>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                        현재 비노출
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      160 × 600px · 홈 / 전문가 탐색
                    </p>
                    <p className="mt-2 text-xs leading-6 text-slate-400">
                      흰색 빈 영역으로 유지합니다. 숨긴 자리는 광고 노출로
                      집계하지 않습니다.
                    </p>
                  </section>
                ))}
              </div>
              <AdRevenueEstimator />
              <ConnectionCard
                title="광고 계약·실적은 아직 미연결입니다."
                description="광고주·게재 기간·계약 금액·청구·입금·미수금과 실제 노출·클릭은 연결 후 관리합니다. 계산기의 예상 금액은 실제 매출이나 권장 시세가 아닙니다."
              />
            </>
          )}
          {view === "operations" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="전체 파일 저장량" value="미연결" />
                <StatCard label="서버·저장소 비용" value="미연결" />
              </div>
              <p className="text-sm leading-7 text-slate-500">
                다모아 개인당 한도는 100MB입니다. 전체 사용량·백업 성공
                여부·최근 배포 상태는 운영 시스템 연결 후 표시합니다. 개인 자료
                원문은 이 화면에서 조회하지 않습니다.
              </p>
              {/* 2-2. 감사로그 */}
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  감사로그 (승인/반려 이력)
                </h2>
                <AuditLog admins={admins} />
              </section>
              <p className="text-xs leading-6 text-slate-400">
                위 이력은 기존 프로필·자격 승인/반려 기록입니다. 증빙 심사 및
                제안·신고의 모든 변경을 통합한 감사 기록은 아직 연결되지
                않았습니다.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-3 text-2xl font-extrabold tracking-tight ${typeof value === "string" && ["미연결", "조회 실패"].includes(value) ? "text-slate-400" : "text-slate-950"}`}
      >
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </p>
    </div>
  );
}
function TaskLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string | number;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm text-slate-700 hover:text-primary"
    >
      <span>{label}</span>
      <span className="font-semibold text-primary">
        {value} <span aria-hidden="true">↗</span>
      </span>
    </Link>
  );
}
function ConnectionCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6">
      <span className="text-xs font-semibold text-slate-400">미연결</span>
      <h3 className="mt-3 font-bold text-slate-800">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
    </section>
  );
}
