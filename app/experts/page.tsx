import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getSpecialties } from '@/app/actions/specialties';
import { type ExpertListItem } from './ExpertCard';
import { ExpertFilters } from './ExpertFilters';
import { LoadMoreExperts, EXPERTS_PAGE_SIZE } from './LoadMoreExperts';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  profession?: string;
  region?: string;
  specialty?: string;
}>;

async function ExpertResults({ searchParams }: { searchParams: SearchParams }) {
  const { profession, region, specialty } = await searchParams;
  const filters = {
    profession: profession || null,
    region: region || null,
    specialty: specialty || null,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_public_experts', {
    p_profession: filters.profession,
    p_region: filters.region,
    p_specialty_slug: filters.specialty,
    p_limit: EXPERTS_PAGE_SIZE,
    p_offset: 0,
  });

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
        전문가 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>
    );
  }

  const experts = (data ?? []) as ExpertListItem[];

  if (experts.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        조건에 맞는 전문가가 아직 없습니다.
      </div>
    );
  }

  return (
    <LoadMoreExperts
      key={`${filters.profession}|${filters.region}|${filters.specialty}`}
      initialExperts={experts}
      filters={filters}
    />
  );
}

export default function ExpertsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← 홈
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">내 주변 전문가 찾기</h1>
      </nav>

      <div className="px-4 py-4 sm:px-6 max-w-2xl mx-auto space-y-4">
        <Suspense fallback={null}>
          <FiltersWithData />
        </Suspense>

        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>}>
          <ExpertResults searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function FiltersWithData() {
  const result = await getSpecialties();
  const specialties = result.ok ? result.specialties : [];
  return <ExpertFilters specialties={specialties} />;
}
