import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getNextOnboardingStep } from '@/lib/auth/get-next-onboarding-step';
import { getSpecialties } from '@/app/actions/specialties';
import { getProfessions } from '@/app/actions/professions';
import { type ExpertListItem } from './ExpertCard';
import { ExpertFilters } from './ExpertFilters';
import { LoadMoreExperts, EXPERTS_PAGE_SIZE } from './LoadMoreExperts';

export const dynamic = 'force-dynamic';

// 공개 전문가가 이 수 미만이면 목록이 "비어있다"가 아니라 "초기 단계다"로
// 읽히도록 상단에 콜드스타트 안내 배너를 띄운다. 필터와 무관하게 전체
// 공개 수 기준 -- 목표치를 넘기면 배너는 자동으로 사라진다.
const COLD_START_THRESHOLD = 10;

function ExpertCardSkeleton() {
  return (
    <div className="flex gap-4 p-4 rounded-lg border border-gray-200 bg-white animate-pulse">
      <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-1/3 bg-gray-200 rounded" />
        <div className="h-3 w-2/3 bg-gray-200 rounded" />
        <div className="h-3 w-1/4 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

function ExpertListSkeleton() {
  return (
    <div className="space-y-3" aria-label="전문가 목록을 불러오는 중">
      {Array.from({ length: 3 }).map((_, i) => (
        <ExpertCardSkeleton key={i} />
      ))}
    </div>
  );
}

type SearchParams = Promise<{
  profession?: string;
  region?: string;
  specialty?: string;
  query?: string;
}>;

// 콤마 구분 단일 파라미터를 배열로 파싱한다. 빈 문자열/미지정은 빈 배열이
// 아니라 undefined(=파라미터 자체를 안 보냄 -> RPC에서 NULL -> 필터 없음)로
// 취급해야 "0개 선택 = 전체"가 유지된다.
function parseMulti(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const arr = value.split(',').filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

async function ExpertResults({ searchParams }: { searchParams: SearchParams }) {
  const { profession, region, specialty, query } = await searchParams;
  const filters = {
    profession: profession || null,
    region: region || null,
    specialty: specialty || null,
    query: query || null,
  };

  const supabase = await createClient();
  // 배너 임계치 판정은 목록과 같은 소스(public_expert_list 뷰)의 전체 수로
  // 해야 필터 결과 수와 혼동되지 않는다.
  const [{ data, error }, { count: publicCount }, expertEntryHref] = await Promise.all([
    supabase.rpc('search_public_experts', {
      p_professions: parseMulti(profession) ?? null,
      p_regions: parseMulti(region) ?? null,
      p_specialty_slugs: parseMulti(specialty) ?? null,
      p_query: filters.query,
      p_limit: EXPERTS_PAGE_SIZE,
      p_offset: 0,
    }),
    supabase.from('public_expert_list').select('id', { count: 'exact', head: true }),
    getNextOnboardingStep(),
  ]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
        전문가 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>
    );
  }

  const experts = (data ?? []) as ExpertListItem[];
  const isColdStart = (publicCount ?? 0) < COLD_START_THRESHOLD;

  return (
    <>
      {isColdStart && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900">
          PT Career는 이제 막 시작했어요. 지금 합류하는 전문가는 초기 멤버로 가장
          먼저 눈에 띕니다.
        </div>
      )}

      {experts.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">
          조건에 맞는 전문가가 아직 없습니다.
        </div>
      ) : (
        <LoadMoreExperts
          key={`${filters.profession}|${filters.region}|${filters.specialty}|${filters.query}`}
          initialExperts={experts}
          filters={filters}
        />
      )}

      <Link
        href={expertEntryHref}
        className="flex gap-4 p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40 transition-colors min-h-[44px]"
      >
        <div className="w-16 h-16 rounded-full bg-white border border-dashed border-gray-300 flex-shrink-0 flex items-center justify-center text-2xl text-gray-400">
          +
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <p className="font-semibold text-gray-900">전문가로 등록하기</p>
          <p className="text-sm text-gray-600 mt-1">
            약 5분이면 프로필을 만들 수 있어요. 경력과 자격으로 나를 소개해보세요.
          </p>
        </div>
      </Link>
    </>
  );
}

export default function ExpertsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← 홈
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">전문가 찾기</h1>
      </nav>

      <div className="px-4 py-4 sm:px-6 max-w-2xl mx-auto space-y-4">
        <Suspense fallback={null}>
          <FiltersWithData />
        </Suspense>

        <Suspense fallback={<ExpertListSkeleton />}>
          <ExpertResults searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function FiltersWithData() {
  const [specialtiesResult, professionsResult] = await Promise.all([
    getSpecialties(),
    getProfessions(),
  ]);
  const specialties = specialtiesResult.ok ? specialtiesResult.specialties : [];
  const professions = professionsResult.ok ? professionsResult.professions : [];
  return <ExpertFilters specialties={specialties} professions={professions} />;
}
