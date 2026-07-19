'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [showExpertsNotice, setShowExpertsNotice] = useState(false);

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">PT Career</h1>
        <Link
          href="/login"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          로그인
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        {/* Core Message */}
        <div className="max-w-md text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4">
            신뢰는 소개되고,
            <br />
            전문성은 기록됩니다.
          </h2>

          {/* Description */}
          <p className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed">
            내 주변 재활·운동 전문가를
            <br />
            경력과 자격으로 확인해보세요.
          </p>

          {/* CTAs */}
          <div className="space-y-3 sm:space-y-4">
            {/* Find Experts Button */}
            <button
              onClick={() => setShowExpertsNotice(true)}
              className="block w-full py-3 sm:py-4 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-center cursor-pointer"
            >
              내 주변 전문가 찾기
            </button>

            {/* Create Profile Button */}
            <Link
              href="/signup"
              className="block w-full py-3 sm:py-4 px-4 border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-slate-50 transition-colors text-center"
            >
              전문가 프로필 만들기
            </Link>
          </div>

          {/* Notice */}
          {showExpertsNotice && (
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-sm text-slate-700">
                전문가 목록은 다음 단계에서 준비됩니다.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-4 py-6 sm:px-6 sm:py-8 text-center">
        <p className="text-sm text-slate-500">
          © 2026 PT Career. 신뢰할 수 있는 전문가 찾기
        </p>
      </footer>
    </main>
  );
}
