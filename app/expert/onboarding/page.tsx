'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { agreeToTerms, getOwnTermsAgreedAt } from '@/app/actions/terms';

export default function OnboardingHome() {
  const [checking, setChecking] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getOwnTermsAgreedAt().then((result) => {
      if (result.ok && result.agreedAt) {
        setAgreed(true);
      }
      setChecking(false);
    });
  }, []);

  const handleAgree = async () => {
    if (!checkboxChecked) return;
    setSubmitting(true);
    const result = await agreeToTerms();
    setSubmitting(false);
    if (result.ok) {
      setAgreed(true);
    } else {
      alert(result.error);
    }
  };

  const steps = [
    {
      id: 1,
      title: '프로필 기본정보',
      description: '이름, 직군, 소개글을 입력해주세요',
      href: '/expert/onboarding/profile',
      icon: '👤',
    },
    {
      id: 2,
      title: '경력 관리',
      description: '과거 경력을 추가해주세요',
      href: '/expert/onboarding/experience',
      icon: '📋',
    },
    {
      id: 3,
      title: '교육 이력',
      description: '교육 이력을 추가해주세요 (선택사항)',
      href: '/expert/onboarding/education',
      icon: '📚',
    },
    {
      id: 4,
      title: '자격·면허',
      description: '보유한 자격증과 면허를 추가해주세요',
      href: '/expert/onboarding/certification',
      icon: '📜',
    },
    {
      id: 5,
      title: '현재 근무기관',
      description: '근무 중인 센터 정보를 입력해주세요',
      href: '/expert/onboarding/workplace',
      icon: '🏢',
    },
    {
      id: 6,
      title: '전문분야',
      description: '전문 분야를 선택해주세요',
      href: '/expert/onboarding/specialties',
      icon: '⭐',
    },
  ];

  if (checking) {
    return null;
  }

  if (!agreed) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">시작하기 전에</h2>
          <p className="text-sm text-gray-600">
            전문가 프로필 작성을 시작하려면 이용약관과 개인정보처리방침에 동의해주세요.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checkboxChecked}
              onChange={(e) => setCheckboxChecked(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-700">
              <Link href="/terms" target="_blank" className="text-blue-600 underline">
                이용약관
              </Link>
              {' '}및{' '}
              <Link href="/privacy" target="_blank" className="text-blue-600 underline">
                개인정보처리방침
              </Link>
              에 동의합니다. (필수)
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleAgree}
          disabled={!checkboxChecked || submitting}
          className="w-full min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? '처리 중...' : '동의하고 시작하기'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">
          프로필 완성도: 0%
        </h2>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: '0%' }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <Link key={step.id} href={step.href}>
            <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{step.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {step.id}. {step.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-sm text-gray-700">
        <p>💡 <strong>팁:</strong> 모든 정보는 나중에 수정할 수 있습니다.</p>
      </div>
    </div>
  );
}
