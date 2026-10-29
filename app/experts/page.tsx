import { representativeCards } from '@/lib/profile-versions/public';
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
    <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 animate-pulse motion-reduce:animate-none sm:gap-6 sm:p-7">
      <div className="size-20 shrink-0 rounded-2xl bg-slate-100 sm:size-24" />
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

  const experts = await representativeCards(supabase,(data ?? []) as ExpertListItem[]);
  const isColdStart = (publicCount ?? 0) < COLD_START_THRESHOLD;

  return (
    <>
      {isColdStart && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-motion" />
          초기 오픈 중 · 새로운 전문가를 차근차근 소개합니다.
        </div>
      )}

      {experts.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-5 py-16 text-center text-sm text-slate-500">
          조건에 맞는 전문가가 아직 없습니다.
        </div>
      ) : (
        <LoadMoreExperts
          key={`${filters.profession}|${filters.region}|${filters.specialty}|${filters.query}`}
          initialExperts={experts}
          filters={filters}
        />
      )}

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">전문가이신가요? 경력과 자격을 소개해보세요.</p>
        <Link
          href={expertEntryHref}
          className="inline-flex min-h-tap items-center gap-3 self-start text-sm font-semibold text-primary hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          프로필 만들기 <span aria-hidden>↗</span>
        </Link>
      </div>
    </>
  );
}

export default function ExpertsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="relative isolate mx-auto min-h-screen max-w-4xl bg-white pb-16 pt-5 sm:pb-24 sm:pt-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
        <svg className="h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMaxYMid slice" fill="none">
          <path d="M0 700C200 690 320 630 460 560S720 420 860 320S1080 150 1200 110" stroke="var(--color-primary)" strokeOpacity="0.1" strokeWidth="2" />
          <path d="M0 640C260 630 460 590 660 500S980 300 1200 250" stroke="var(--color-motion)" strokeOpacity="0.35" strokeWidth="1.5" />
          <path d="M0 760C280 745 440 700 640 630S960 470 1200 400" stroke="var(--color-motion)" strokeOpacity="0.3" strokeWidth="1.5" />
          <circle cx="860" cy="320" r="6" fill="white" stroke="var(--color-primary)" strokeOpacity="0.2" strokeWidth="2" />
        </svg>
      </div>
      <nav aria-label="페이지 경로">
        <Link href="/home" className="inline-flex min-h-tap items-center gap-2 text-sm text-slate-500 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-blue-600">
          <span aria-hidden>←</span> 홈
        </Link>
      </nav>

      <header className="relative overflow-hidden pb-9 pt-7 sm:pb-12 sm:pt-10">
        <div className="relative">
          <h1 className="text-hero font-extrabold tracking-tight text-slate-900 sm:text-4xl">전문가 <span className="text-primary">탐색</span></h1>
          <p className="mt-3 text-sm text-slate-500 sm:text-base">경력과 자격으로, 나에게 맞는 전문가를.</p>
        </div>
      </header>

      <Suspense fallback={null}>
        <FiltersWithData />
      </Suspense>

      <section aria-labelledby="expert-results-title" className="mt-10 space-y-5 sm:mt-12 sm:space-y-6">
        <h2 id="expert-results-title" className="text-base font-semibold text-slate-900">전문가 프로필</h2>
        <Suspense fallback={<ExpertListSkeleton />}>
          <ExpertResults searchParams={searchParams} />
        </Suspense>
      </section>
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
