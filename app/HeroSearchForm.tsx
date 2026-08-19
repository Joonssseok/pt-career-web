'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// region은 자유 텍스트 -- search_public_experts의 p_regions는 workplace_region
// 정확 일치라서 자유 텍스트를 그대로 넘기면 안 맞을 수 있지만, 홈 히어로
// 검색은 /experts로 넘겨 그 페이지의 필터 파싱을 그대로 타므로 여기서는
// 값만 쿼리스트링에 싣는다(검증/매칭은 /experts 쪽 책임 그대로 유지).
export function HeroSearchForm() {
  const router = useRouter();
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (region.trim()) params.set('region', region.trim());
    if (query.trim()) params.set('query', query.trim());
    router.push(`/experts${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto"
    >
      <label className="flex-1 text-left">
        <span className="sr-only">지역</span>
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="지역 (예: 서울, 경기)"
          className="w-full min-h-[44px] px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>
      <label className="flex-1 text-left">
        <span className="sr-only">직군 또는 전문분야</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="직군 또는 전문분야"
          className="w-full min-h-[44px] px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>
      <button
        type="submit"
        className="min-h-[44px] px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
      >
        찾기
      </button>
    </form>
  );
}
