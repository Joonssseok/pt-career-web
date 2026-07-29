'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelAccountDeletion } from '@/app/actions/account-deletion';
import { GRACE_PERIOD_DAYS } from '@/lib/constants/account-deletion';

export function DeletionBanner({ deletionRequestedAt }: { deletionRequestedAt: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestedAt = new Date(deletionRequestedAt);
  const purgeAt = new Date(requestedAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const daysLeft = Math.max(
    0,
    Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    const result = await cancelAccountDeletion();
    setLoading(false);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
      <p className="text-sm text-red-900 font-medium">
        {daysLeft}일 후 영구 삭제 예정입니다
      </p>
      <p className="text-xs text-red-800">
        그 사이 언제든 탈퇴를 취소할 수 있습니다. 취소하지 않으면 계정과 모든 정보가 영구히
        삭제됩니다.
      </p>
      {error && <p className="text-xs text-red-700">⚠️ {error}</p>}
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="w-full min-h-[44px] px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 transition"
      >
        {loading ? '처리 중...' : '탈퇴 취소'}
      </button>
    </div>
  );
}
