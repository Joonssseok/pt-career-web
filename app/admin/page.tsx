import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getAdminDashboardStats,
  getAdminReviewKpis,
  getAdminUsersList,
} from '@/app/actions/admin';
import { AuditLog } from './AuditLog';

export const dynamic = 'force-dynamic';

// 10_DECISION_LOG.md (2026-07-28): 출시(2026-10) 시점까지 전문가 프로필 10명 내외가 1차 목표.
const LAUNCH_TARGET_PUBLIC_PROFILES = 10;

type PendingProfile = {
  id: string;
  display_name: string | null;
  profession: string | null;
  submitted_at: string | null;
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/admin');
  }

  const { data: isAdmin } = await supabase.rpc('is_admin');

  if (!isAdmin) {
    redirect('/');
  }

  const [{ data, error }, statsResult, kpisResult, adminsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, profession, submitted_at')
      .eq('verification_status', 'pending')
      .order('submitted_at', { ascending: true }),
    getAdminDashboardStats(),
    getAdminReviewKpis(),
    getAdminUsersList(),
  ]);

  const pending = (data ?? []) as PendingProfile[];
  const stats = statsResult.ok ? statsResult.stats : null;
  const kpis = kpisResult.ok ? kpisResult.kpis : null;
  const admins = adminsResult.ok ? adminsResult.admins : [];

  const approvalRateText =
    kpis && kpis.approved_count + kpis.rejected_count > 0
      ? `${Math.round((kpis.approved_count / (kpis.approved_count + kpis.rejected_count)) * 100)}%`
      : '—';

  const avgProcessingText =
    kpis?.avg_processing_hours != null ? `${kpis.avg_processing_hours.toFixed(1)}시간` : '—';

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between px-4 py-4 sm:px-6 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">관리자 대시보드</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          홈으로
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-8">
        {/* 1. 가입/검증 파이프라인 현황 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">가입 · 검증 현황</h2>
          {stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="총 가입자" value={stats.total_signups} />
              <StatCard label="작성 중 (draft)" value={stats.draft_count} />
              <StatCard label="검토 대기 (pending)" value={stats.pending_count} />
              <StatCard label="승인 (approved)" value={stats.approved_count} />
              <StatCard label="반려 (rejected)" value={stats.rejected_count} />
              <StatCard
                label={`공개 전문가 (목표 ${LAUNCH_TARGET_PUBLIC_PROFILES}명)`}
                value={`${stats.public_count} / ${LAUNCH_TARGET_PUBLIC_PROFILES}`}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400">현황을 불러오지 못했습니다.</p>
          )}
        </section>

        {/* 2-1. 검토 대기열 KPI */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">검토 대기열 KPI</h2>
          {kpis ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="대기 중" value={kpis.pending_count} />
              <StatCard label="평균 처리 시간" value={avgProcessingText} />
              <StatCard label="승인율" value={approvalRateText} />
            </div>
          ) : (
            <p className="text-sm text-gray-400">KPI를 불러오지 못했습니다.</p>
          )}
        </section>

        {/* 검토 대기 목록 (기존) */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">검토 대기 목록</h2>
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
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 transition-colors min-h-[44px]"
              >
                <div>
                  <p className="font-medium text-gray-900">{p.display_name ?? '이름 미입력'}</p>
                  <p className="text-sm text-gray-500">{p.profession ?? '직군 미입력'}</p>
                </div>
                <div className="text-xs text-gray-400">
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString('ko-KR') : ''}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 2-2. 감사로그 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">감사로그 (승인/반려 이력)</h2>
          <AuditLog admins={admins} />
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
