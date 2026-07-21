'use client';

import Link from 'next/link';

export default function OnboardingHome() {
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
      title: '현재 근무기관',
      description: '근무 중인 센터 정보를 입력해주세요',
      href: '/expert/onboarding/workplace',
      icon: '🏢',
    },
    {
      id: 3,
      title: '경력 관리',
      description: '과거 경력을 추가해주세요',
      href: '/expert/onboarding/experience',
      icon: '📋',
    },
    {
      id: 4,
      title: '교육 이력',
      description: '보유한 자격증과 교육을 추가해주세요',
      href: '/expert/onboarding/education',
      icon: '🎓',
    },
    {
      id: 5,
      title: '전문분야',
      description: '전문 분야를 선택해주세요',
      href: '/expert/onboarding/specialties',
      icon: '⭐',
    },
  ];

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
