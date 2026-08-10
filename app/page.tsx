import Link from 'next/link';
import { getNextOnboardingStep } from '@/lib/auth/get-next-onboarding-step';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const expertEntryHref = await getNextOnboardingStep();

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        {/* Core Message */}
        <div className="max-w-md text-center">
          <h1 className="text-hero sm:text-4xl font-bold text-slate-900 leading-tight mb-4">
            신뢰는 소개되고,
            <br />
            전문성은 기록됩니다.
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed">
            재활·운동 전문가를
            <br />
            경력과 자격으로 확인해보세요.
          </p>

          {/* CTAs -- 공급(전문가 프로필) 우선 단계라 프로필 만들기가 Primary.
              공개 전문가 수가 launch gate 목표치에 도달하면 전문가 찾기를
              Primary로 원복한다. */}
          <div className="space-y-3 sm:space-y-4">
            {/* Create Profile Button */}
            <Link
              href={expertEntryHref}
              className="block w-full py-3 sm:py-4 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
            >
              전문가 프로필 만들기
            </Link>

            {/* Find Experts Button */}
            <Link
              href="/experts"
              className="block w-full py-3 sm:py-4 px-4 border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-slate-50 transition-colors text-center"
            >
              전문가 찾기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
