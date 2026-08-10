'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PROFILE_STATUS_META } from '@/lib/constants/status-badges';

type ProfessionRef = { name: string; slug: string };

export type AdminProfileListItem = {
  id: string;
  display_name: string | null;
  verification_status: string;
  is_public: boolean;
  suspended_at: string | null;
  profile_professions: {
    custom_label: string | null;
    display_order: number;
    // supabase-js의 조인 타입 추론이 to-one FK를 배열로 볼 때가 있어 둘 다 수용
    professions: ProfessionRef | ProfessionRef[] | null;
  }[];
};

// app/admin/page.tsx의 professionNames()와 동일한 규칙(공개 뷰의 CASE
// 처리와 일치) -- 서버 컴포넌트 파일에서 클라이언트 컴포넌트로 함수를
// 그대로 import하면 RSC 번들 경계 문제가 생길 수 있어 짧으니 그대로 복제.
function professionNames(p: AdminProfileListItem): string {
  const names = [...p.profile_professions]
    .sort((a, b) => a.display_order - b.display_order)
    .map((pp) => {
      const ref = Array.isArray(pp.professions) ? pp.professions[0] : pp.professions;
      return ref?.slug === 'custom' ? pp.custom_label : ref?.name;
    })
    .filter(Boolean);
  return names.length > 0 ? names.join(' · ') : '직군 미입력';
}

const STATUS_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'draft', label: '작성 중' },
  { value: 'pending', label: '검토 중' },
  { value: 'approved', label: '공개 중' },
  { value: 'rejected', label: '반려됨' },
  { value: 'suspended', label: '임시조치' },
] as const;

export function AllProfilesList({ profiles }: { profiles: AdminProfileListItem[] }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (q && !(p.display_name ?? '').toLowerCase().includes(q)) return false;
      if (statusFilter === 'suspended') return !!p.suspended_at;
      if (statusFilter !== 'all') return p.verification_status === statusFilter;
      return true;
    });
  }, [profiles, query, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름으로 검색"
          className="flex-1 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm bg-white rounded-lg border border-gray-200">
          조건에 맞는 프로필이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const statusMeta = PROFILE_STATUS_META[p.verification_status];
            return (
              <Link
                key={p.id}
                href={`/admin/${p.id}`}
                className="flex items-center justify-between gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 transition-colors min-h-[44px]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {p.display_name ?? '이름 미입력'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{professionNames(p)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {statusMeta && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                  )}
                  {p.suspended_at && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
                      🚫 임시조치
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
