'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitProfile } from '@/app/actions/profile';

type SubmitState = 'default' | 'loading' | 'error' | 'done';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>('default');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setState('loading');
    const result = await submitProfile();

    if (result.ok) {
      setState('done');
      setTimeout(() => {
        router.push('/my');
      }, 1500);
    } else {
      setError(result.error);
      setState('error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">🎉</span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">제출하기</h2>
          <p className="text-sm text-gray-600">
            입력한 내용을 검토 후 제출해주세요
          </p>
        </div>
      </div>

      {state === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-900 font-medium mb-2">
            ⚠️ 제출에 실패했습니다
          </p>
          <p className="text-sm text-red-800">{error}</p>
          <Link
            href="/expert/onboarding/profile"
            className="inline-block mt-3 text-sm text-blue-600 underline"
          >
            1단계로 돌아가기
          </Link>
        </div>
      )}

      {state === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-900 font-medium">
            ✓ 제출되었습니다! 관리자 검토 후 공개됩니다.
          </p>
        </div>
      )}

      {state !== 'done' && state !== 'error' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
          제출하면 관리자 검토를 거쳐 프로필이 공개됩니다. 검토 중에는 정보를
          수정할 수 없습니다.
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Link
          href="/expert/onboarding/specialties"
          className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
        >
          이전
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={state === 'loading' || state === 'done'}
          className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {state === 'loading' ? '제출 중...' : '제출하기'}
        </button>
      </div>
    </div>
  );
}
