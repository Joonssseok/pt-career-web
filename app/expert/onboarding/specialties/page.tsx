'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOwnProfile } from '@/app/actions/profile';
import SpecialtySection from '@/components/profile-sections/SpecialtySection';

export default function SpecialtiesStep() {
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
      <p className="text-sm text-gray-500">6 / 6 · 전문분야</p>
      {isApproved && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-900 font-medium">확인 필요</p>
          <p className="text-sm text-yellow-800 mt-1">
            수정 후 저장하면 프로필이 다시 관리자 검토 상태로 전환됩니다.
          </p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <span className="text-4xl">⭐</span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            전문분야 선택
          </h2>
          <p className="text-sm text-gray-600">
            당신의 전문 분야를 선택해주세요 (1~3개)
          </p>
        </div>
      </div>

      <SpecialtySection
        submitLabel="다음: 미리보기"
        onSaved={() => {
          setTimeout(() => {
            router.push('/expert/onboarding/preview');
          }, 1000);
        }}
        leftNav={
          <Link
            href="/expert/onboarding/workplace"
            className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            이전
          </Link>
        }
      />
    </div>
  );
}
