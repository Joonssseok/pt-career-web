'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ExpertCard, type ExpertListItem } from './ExpertCard';

export const EXPERTS_PAGE_SIZE = 20;

type Filters = {
  profession: string | null;
  region: string | null;
  specialty: string | null;
  query: string | null;
};

export function LoadMoreExperts({
  initialExperts,
  filters,
}: {
  initialExperts: ExpertListItem[];
  filters: Filters;
}) {
  const [experts, setExperts] = useState(initialExperts);
  const [hasMore, setHasMore] = useState(initialExperts.length === EXPERTS_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    setError(false);

    const supabase = createClient();
    // query를 빠뜨리면 "더보기"로 다음 페이지를 불러올 때 검색어 조건이
    // 사라져 1페이지만 검색되고 2페이지부터 전체 목록이 섞이는 버그가 된다.
    const { data, error: rpcError } = await supabase.rpc('search_public_experts', {
      p_profession: filters.profession,
      p_region: filters.region,
      p_specialty_slug: filters.specialty,
      p_query: filters.query,
      p_limit: EXPERTS_PAGE_SIZE,
      p_offset: experts.length,
    });

    setLoading(false);

    if (rpcError || !data) {
      setError(true);
      return;
    }

    const next = data as ExpertListItem[];
    setExperts((prev) => [...prev, ...next]);
    setHasMore(next.length === EXPERTS_PAGE_SIZE);
  };

  return (
    <div className="space-y-3">
      {experts.map((expert) => (
        <ExpertCard key={expert.id} expert={expert} />
      ))}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
          더 불러오지 못했습니다. 다시 시도해주세요.
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full min-h-[44px] py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '불러오는 중...' : '더보기'}
        </button>
      )}
    </div>
  );
}
