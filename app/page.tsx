import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { getNextOnboardingStep } from '@/lib/auth/get-next-onboarding-step';
import { MotionPath } from '@/components/MotionPath';
import { ExpertCard, type ExpertListItem } from './experts/ExpertCard';

export const dynamic = 'force-dynamic';

// 실제 specialties 12개 중 6개만 노출하고 나머지는 "전체보기"로 연결.
// slug/name은 DB 값 그대로 (임의 카테고리 추가 금지).
const FEATURED_SPECIALTIES = [
  { slug: 'weight-management', name: '다이어트·체형관리' },
  { slug: 'strength-body-profile', name: '근력강화·바디프로필' },
  { slug: 'posture-pain-management', name: '자세교정·통증관리' },
  { slug: 'rehab-post-surgery', name: '재활운동·수술 후 회복' },
  { slug: 'pilates-yoga-flexibility', name: '필라테스·요가·유연성' },
  { slug: 'sports-performance', name: '스포츠 퍼포먼스' },
];

export default async function Home() {
  const supabase = await createClient();
  const [{ data: expertsData }, expertEntryHref] = await Promise.all([
    supabase.from('public_expert_list').select('*').limit(3),
    getNextOnboardingStep(),
  ]);
  const experts = (expertsData ?? []) as ExpertListItem[];

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Hero -- 이미지가 섹션 전체를 채우는 풀블리드 배경(컨테이너 1240px
          폭 안에서만, 뷰포트 브레이크아웃은 하지 않음) + 좌측 텍스트 오버레이.
          인물이 사진 우측에 있어 텍스트는 여백 있는 좌측에 배치. */}
      <section className="relative overflow-hidden min-h-[520px] max-h-[640px] lg:max-h-none lg:min-h-[85vh]">
        <Image
          src="/images/hero-pt-session.jpg"
          alt="태블릿을 들고 있는 트레이너"
          fill
          priority
          sizes="(min-width: 1240px) 1240px, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/75 to-white/30 lg:bg-gradient-to-r lg:from-white/92 lg:via-white/55 lg:to-transparent" />

        <div className="relative z-10 flex h-full min-h-[520px] max-h-[640px] lg:max-h-none lg:min-h-[85vh] items-center px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-xl lg:max-w-md">
            <h1 className="text-hero sm:text-4xl font-bold text-slate-900 leading-tight mb-4">
              좋은 움직임은,
              <br />
              검증된 경력에서 시작됩니다.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 mb-2 leading-relaxed">
              재활·운동 전문가를 경력과 자격으로 확인해보세요.
            </p>
            <p className="text-xs text-slate-500 mb-8">
              자격증은 관리자가 직접 검증하지만, 경력 소개글은 전문가 본인이 작성한
              내용입니다.
            </p>

            <div className="space-y-3 sm:space-y-4 sm:max-w-sm">
              <Link
                href={expertEntryHref}
                className="block w-full py-3 sm:py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-[0_8px_18px_-12px_rgba(37,99,235,0.8)] active:scale-[0.97] transition-all text-center"
              >
                전문가 프로필 만들기
              </Link>
              <Link
                href="/experts"
                className="block w-full py-3 sm:py-4 px-4 bg-white border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-600 font-bold rounded-xl transition-colors text-center"
              >
                전문가 찾기
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MotionPath />

      {/* Quick Category Grid */}
      <section className="bg-white px-4 py-8 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-page-title font-bold text-slate-900">분야별로 찾기</h2>
            <Link href="/experts" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              전체보기
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FEATURED_SPECIALTIES.map((s) => (
              <Link
                key={s.slug}
                href={`/experts?specialty=${s.slug}`}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 p-4 text-sm font-semibold text-slate-800 hover:text-blue-600"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MotionPath />

      {/* Verified Expert Cards */}
      <section className="px-4 py-8 sm:px-6 bg-[var(--color-background)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-page-title font-bold text-slate-900 mb-4">인증된 전문가</h2>
          <div className="space-y-3">
            {experts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}

            {/* 콜드스타트 안내 카드 -- 공개 전문가가 0명이 되어도 이 카드만
                남아 섹션이 깨지지 않는다. */}
            <div className="p-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40">
              <p className="text-sm text-blue-900 leading-relaxed">
                지금은 등록된 전문가가 많지 않습니다. 초기 단계라 프로필을 하나씩
                채워가고 있어요. 먼저 등록하면 가장 눈에 띄는 자리를 차지할 수
                있습니다.
              </p>
              <Link
                href={expertEntryHref}
                className="inline-block mt-3 text-sm font-bold text-blue-600 hover:text-blue-700"
              >
                전문가로 등록하기 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MotionPath />

      {/* Trust 3-column */}
      <section className="bg-white px-4 py-8 sm:px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-bold text-emerald-600 mb-1">자격 검증</p>
            <p className="text-sm text-slate-600">
              등록된 자격증은 관리자가 직접 확인 후에만 인증 배지가 붙습니다.
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-bold text-emerald-600 mb-1">경력 자동 합산</p>
            <p className="text-sm text-slate-600">
              등록한 경력 기간이 겹치는 부분 없이 자동으로 합산되어 총 경력으로
              표시됩니다.
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-bold text-emerald-600 mb-1">중개 없는 직접 연결</p>
            <p className="text-sm text-slate-600">
              서비스 내 채팅·예약·결제 없이 전화·이메일·SNS로 전문가에게 직접
              연락합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 전문가 등록 유도 배너 -- 커리어가이드/블로그 콘텐츠는 아직 없어 만들지 않음 */}
      <section className="bg-[var(--color-background)] px-4 py-8 sm:px-6 pb-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-blue-50/80 via-white to-gray-50 border border-blue-100 rounded-2xl p-6 text-center">
          <p className="font-bold text-slate-900 mb-1">아직 프로필이 없으신가요?</p>
          <p className="text-sm text-slate-600 mb-4">약 5분이면 경력과 자격으로 나를 소개할 수 있어요.</p>
          <Link
            href={expertEntryHref}
            className="inline-block py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-[0_8px_18px_-12px_rgba(37,99,235,0.8)] active:scale-[0.97] transition-all"
          >
            전문가 프로필 만들기
          </Link>
        </div>
      </section>
    </main>
  );
}
