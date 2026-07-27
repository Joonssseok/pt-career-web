'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewExpertProfile } from '@/app/actions/admin';

type ReviewState = 'default' | 'loading' | 'error' | 'done';

export function ReviewActions({ targetUserId }: { targetUserId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [state, setState] = useState<ReviewState>('default');
  const [error, setError] = useState('');

  const submit = async (decision: 'approved' | 'rejected') => {
    setState('loading');
    const result = await reviewExpertProfile(targetUserId, decision, reason);

    if (result.ok) {
      setState('done');
      setTimeout(() => {
        router.push('/admin');
      }, 1000);
    } else {
      setError(result.error);
      setState('error');
    }
  };

  const handleRejectClick = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    submit('rejected');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      {state === 'error' && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          처리에 실패했습니다: {error}
        </p>
      )}
      {state === 'done' && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          처리되었습니다.
        </p>
      )}

      {showRejectInput && state !== 'done' && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="반려 사유를 입력해주세요"
          rows={3}
          disabled={state === 'loading'}
          className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleRejectClick}
          disabled={
            state === 'loading' ||
            state === 'done' ||
            (showRejectInput && !reason.trim())
          }
          className="flex-1 min-h-[44px] px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {showRejectInput ? '반려 확정' : '반려'}
        </button>
        <button
          type="button"
          onClick={() => submit('approved')}
          disabled={state === 'loading' || state === 'done'}
          className="flex-1 min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === 'loading' ? '처리 중...' : '승인'}
        </button>
      </div>
    </div>
  );
}
