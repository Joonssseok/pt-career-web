'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOwnProfile } from '@/app/actions/profile';
import EducationSection from '@/components/profile-sections/EducationSection';

export default function EducationStep() {
  const router = useRouter();
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    getOwnProfile().then((result) => {
      if (result.ok && result.profile) {
        setIsApproved(result.profile.verification_status === 'approved');
      }
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <p className="text-sm text-gray-500">3 / 6 · 교육 이력</p>
        <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
          선택 항목
        </span>
      </div>
      {isApproved && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-900 font-medium">확인 필요</p>
          <p className="text-sm text-yellow-800 mt-1">
            수정 후 저장하면 프로필이 다시 관리자 검토 상태로 전환됩니다.
          </p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <span className="text-4xl">📚</span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">교육 이력을 추가할 수 있어요</h2>
          <p className="text-sm text-gray-600">
            이 단계는 선택입니다. 지금 건너뛰고 나중에 수정할 수 있습니다.
          </p>
        </div>
      </div>

      <EducationSection
        submitLabel="다음: 자격·면허"
        onSaved={() => {
          setTimeout(() => {
            router.push('/expert/onboarding/certification');
          }, 1000);
        }}
        onSkip={() => {
          router.push('/expert/onboarding/certification');
        }}
        leftNav={
          <Link
            href="/expert/onboarding/experience"
            className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            이전
          </Link>
        }
      />
    </div>
  );
}
