'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestAccountDeletion } from '@/app/actions/account-deletion';
import { GRACE_PERIOD_DAYS } from '@/lib/constants/account-deletion';

const CONFIRM_TEXT = '탈퇴';

export default function DeleteAccountPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [formState, setFormState] = useState<'default' | 'loading' | 'error'>('default');
  const [error, setError] = useState('');

  const canSubmit = agreed && confirmInput === CONFIRM_TEXT && formState !== 'loading';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setFormState('loading');
    setError('');

    const result = await requestAccountDeletion();

    if (result.ok) {
      router.push('/my');
    } else {
      setError(result.error);
      setFormState('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <p className="text-sm font-medium text-red-600">회원 탈퇴</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">
            정말 탈퇴하시겠어요?
          </h1>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-900 font-medium">확인 필요</p>
          <p className="text-sm text-yellow-800 mt-1">
            탈퇴를 신청하면 프로필이 즉시 비공개로 전환됩니다. 이후 {GRACE_PERIOD_DAYS}일 동안은
            언제든 로그인해서 탈퇴를 취소할 수 있습니다. {GRACE_PERIOD_DAYS}일이 지나면 아래
            정보가 전부 영구히 삭제되며, 이후에는 되돌릴 수 없습니다.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">
              {GRACE_PERIOD_DAYS}일 후 영구히 삭제되는 정보
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
              <li>프로필 기본정보(이름, 직군, 소개, 프로필 사진)</li>
              <li>경력 정보</li>
              <li>교육 이력</li>
              <li>자격·면허 정보 및 증빙 파일</li>
              <li>근무기관 정보</li>
              <li>계정 자체(로그인 정보)</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900 font-medium">⚠️ {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-700">
                위 내용을 확인했으며, {GRACE_PERIOD_DAYS}일 후 정보가 영구히 삭제되는 것에
                동의합니다.
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                계속하려면 아래 입력창에 <strong>{CONFIRM_TEXT}</strong>를 입력해주세요
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={CONFIRM_TEXT}
                className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Link
                href="/my"
                className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 min-h-[44px] px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {formState === 'loading' ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
