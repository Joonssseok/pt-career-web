import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getNextOnboardingStep } from '@/lib/auth/get-next-onboarding-step';
import { MotionPath } from '@/components/MotionPath';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';
import { HeroSearchForm } from './HeroSearchForm';
import type { ExpertListItem } from './experts/ExpertCard';

export const dynamic = 'force-dynamic';

// 실제 specialties 12개 중 6개만 노출하고 나머지는 "전체보기"로 연결.
// slug/name은 DB 값 그대로(임의 카테고리 추가 금지), 서브카피만 새로 작성.
const FEATURED_SPECIALTIES = [
  { slug: 'rehab-post-surgery', name: '재활운동·수술 후 회복', sub: '통증·기능 회복' },
  { slug: 'posture-pain-management', name: '자세교정·통증관리', sub: '움직임 패턴 개선' },
  { slug: 'sports-performance', name: '스포츠 퍼포먼스', sub: '다시 운동장으로' },
  { slug: 'senior-fall-prevention', name: '시니어·낙상예방', sub: '안전한 근력 회복' },
  { slug: 'prenatal-postnatal', name: '산전·산후 운동', sub: '변화에 맞는 회복' },
  { slug: 'weight-management', name: '다이어트·체형관리', sub: '나만의 움직임 설계' },
];

const WHY_FEATURES = [
  {
    title: '경력 자동 합산',
    desc: '겹치는 기간을 정리해 실제 누적 경력을 한눈에 보여줍니다.',
  },
  {
    title: '자격증 검증',
    desc: '면허·교육·자격 정보를 관리자 검토 상태와 함께 공개합니다.',
  },
  {
    title: '다이렉트 상담',
    desc: '중개 수수료 없이 필요한 전문가에게 직접 상담을 요청합니다.',
  },
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
      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50/80 via-white to-gray-50 px-4 py-12 sm:px-6 sm:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-semibold text-blue-600 tracking-wide mb-3">
            국내 재활·운동 전문가 커리어 플랫폼
          </p>
          <h1 className="text-hero sm:text-5xl font-bold text-slate-900 leading-tight mb-4">
            좋은 움직임은,
            <br />
            검증된 경력에서 시작됩니다.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed">
            대학병원 출신 물리치료사부터 전문 퍼스널 트레이너까지. 경력과 자격을
            투명하게 확인하고, 나에게 맞는 전문가와 바로 연결하세요.
          </p>

          <HeroSearchForm />

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-6 text-xs font-medium text-slate-500">
            <span>자격증 검증 프로필</span>
            <span aria-hidden>·</span>
            <span>다이렉트 상담</span>
            <span aria-hidden>·</span>
            <span>투명한 커리어</span>
          </div>

          {/* 이미지 슬롯 1: 히어로 비주얼. 사람이 직접 채울 때까지 빈 플레이스홀더. */}
          <div
            aria-hidden
            className="mt-10 aspect-video max-w-md mx-auto rounded-2xl border border-dashed border-blue-200 bg-blue-50/40"
          />
        </div>
      </section>

      <MotionPath />

      {/* Explore by focus */}
      <section className="px-4 py-8 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end justify-between mb-1">
            <h2 className="text-page-title font-bold text-slate-900">
              나에게 필요한 움직임부터 찾아보세요
            </h2>
            <Link href="/experts" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex-shrink-0">
              전체보기
            </Link>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            통증, 회복, 퍼포먼스까지. 지금 필요한 전문 분야를 고르면 검증된 프로필을
            바로 비교할 수 있습니다.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FEATURED_SPECIALTIES.map((s) => (
              <Link
                key={s.slug}
                href={`/experts?specialty=${s.slug}`}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 p-4"
              >
                <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MotionPath />

      {/* Curated experts */}
      <section className="px-4 py-8 sm:px-6 bg-[var(--color-background)]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end justify-between mb-1">
            <h2 className="text-page-title font-bold text-slate-900">
              이번 주, 먼저 만나볼 전문가
            </h2>
            <Link href="/experts" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex-shrink-0">
              전체 전문가 보기
            </Link>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            운영팀이 자격과 경력을 확인한 전문가를 소개합니다. 숫자보다 이력의 맥락을
            먼저 살펴보세요.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {experts.map((expert) => {
              const primarySpecialty = expert.specialties[0]?.name ?? null;
              return (
                <article
                  key={expert.id}
                  className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col"
                >
                  <Link href={`/experts/${expert.id}`} className="flex flex-col flex-1">
                    {/* 이미지 슬롯 2: 전문가 카드 사진. 실제 프로필 사진 있으면
                        노출, 없으면 기존 이모지 placeholder 유지(외부 이미지
                        절대 안 가져옴). */}
                    <div className="aspect-square bg-blue-50 flex items-center justify-center text-4xl text-blue-300 overflow-hidden">
                      {expert.profile_image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getProfilePhotoUrl(expert.profile_image_path) ?? ''}
                          alt={expert.display_name ?? '전문가'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        '🏋️'
                      )}
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <span className="inline-block w-fit px-2 py-0.5 mb-2 bg-green-50 text-green-700 border border-green-200 rounded-full text-[11px] font-bold">
                        VERIFIED PROFILE
                      </span>
                      <h3 className="font-bold text-slate-900">
                        {expert.display_name ?? '이름 미공개'}
                      </h3>
                      {expert.professions.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {expert.professions.map((p) => p.name).join(' · ')}
                        </p>
                      )}

                      {(expert.total_experience_years != null || primarySpecialty) && (
                        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                          {expert.total_experience_years != null && (
                            <div>
                              <p className="text-[11px] text-slate-400">경력</p>
                              <p className="text-sm font-bold text-slate-800">
                                {expert.total_experience_years}년
                              </p>
                            </div>
                          )}
                          {primarySpecialty && (
                            <div>
                              <p className="text-[11px] text-slate-400">분야</p>
                              <p className="text-sm font-bold text-slate-800">{primarySpecialty}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {expert.headline && (
                        <p className="text-sm text-slate-600 mt-3 line-clamp-2">{expert.headline}</p>
                      )}

                      {expert.workplace_region && (
                        <p className="text-xs text-slate-400 mt-auto pt-3">{expert.workplace_region}</p>
                      )}

                      <span className="inline-block mt-3 text-sm font-bold text-blue-600">
                        프로필 보기 →
                      </span>
                    </div>
                  </Link>
                </article>
              );
            })}

            {/* 콜드스타트 안내 카드 -- 공개 전문가가 3명 미만이어도 섹션이
                비어 보이지 않게 항상 노출. */}
            <div className="p-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 flex flex-col justify-center">
              <p className="text-sm text-blue-900 leading-relaxed">
                초기 등록 전문가에게 프로필 검증과 상단 노출 혜택을 제공합니다.
              </p>
              <Link
                href={expertEntryHref}
                className="inline-block mt-3 text-sm font-bold text-blue-600 hover:text-blue-700"
              >
                전문가 등록 혜택 보기 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MotionPath />

      {/* Why PT career */}
      <section className="px-4 py-8 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end justify-between mb-1">
            <h2 className="text-page-title font-bold text-slate-900">
              프로필을 보는 방식부터 달라야 하니까
            </h2>
            <Link href="/experts" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex-shrink-0">
              검증된 프로필 둘러보기
            </Link>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            PT career는 멋진 말보다 확인 가능한 정보로 전문가와 고객 사이의 신뢰를
            설계합니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {WHY_FEATURES.map((f, i) => (
              <div key={f.title} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5">
                <p className="text-xs font-bold text-blue-400 mb-1">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="text-sm font-bold text-slate-900 mb-1">{f.title}</p>
                <p className="text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MotionPath />

      {/* Expert insight & care -- 가이드/아티클 콘텐츠는 아직 없어 자리만
          만들어 둔다. 나중에 실제 콘텐츠로 채운다. */}
      <section className="px-4 py-8 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-page-title font-bold text-slate-900 mb-1">
            움직임을 더 잘 이해하는 가이드
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            전문가를 고르는 기준부터 커리어를 기록하는 방법까지, 곧 준비됩니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border border-dashed border-slate-200 rounded-2xl p-5 text-center text-sm text-slate-400"
              >
                준비 중
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 전문가 등록 유도 배너 */}
      <section className="px-4 py-8 sm:px-6 pb-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-blue-50/80 via-white to-gray-50 border border-blue-100 rounded-2xl p-6 text-center">
          <p className="font-bold text-slate-900 mb-1">우리 동네 1호 전문가가 되어보세요.</p>
          <p className="text-sm text-slate-600 mb-4">
            초기 등록 전문가에게 프리미엄 배지와 상단 노출 혜택을 안내합니다.
          </p>
          <Link
            href={expertEntryHref}
            className="inline-block py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-[0_8px_18px_-12px_rgba(37,99,235,0.8)] active:scale-[0.97] transition-all"
          >
            내 경력 등록하기
          </Link>
        </div>
      </section>
    </main>
  );
}
