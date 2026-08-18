'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { suspendExpertProfile, unsuspendExpertProfile } from '@/app/actions/admin';

type State = 'default' | 'loading' | 'error' | 'done';

export function SuspendActions({
  profileId,
  suspendedAt,
  suspensionReason,
}: {
  profileId: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [state, setState] = useState<State>('default');
  const [error, setError] = useState('');

  const handleSuspend = async () => {
    if (!showReasonInput) {
      setShowReasonInput(true);
      return;
    }
    setState('loading');
    const result = await suspendExpertProfile(profileId, reason);
    if (result.ok) {
      setState('done');
      router.refresh();
    } else {
      setError(result.error);
      setState('error');
    }
  };

  const handleUnsuspend = async () => {
    if (!window.confirm('임시조치를 해제하시겠습니까? 프로필이 다시 공개됩니다.')) return;
    setState('loading');
    const result = await unsuspendExpertProfile(profileId);
    if (result.ok) {
      setState('done');
      router.refresh();
    } else {
      setError(result.error);
      setState('error');
    }
  };

  if (suspendedAt) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-red-900">🚫 임시조치 중</p>
        <p className="text-sm text-red-800">사유: {suspensionReason}</p>
        <p className="text-xs text-red-600">
          조치일: {new Date(suspendedAt).toLocaleString('ko-KR')}
        </p>
        {state === 'error' && (
          <p className="text-sm text-red-700 bg-white border border-red-200 rounded p-2">
            처리에 실패했습니다: {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleUnsuspend}
          disabled={state === 'loading'}
          className="w-full min-h-[44px] px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === 'loading' ? '처리 중...' : '임시조치 해제'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      {state === 'error' && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          처리에 실패했습니다: {error}
        </p>
      )}
      {showReasonInput && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="임시조치 사유를 입력해주세요 (필수)"
          rows={3}
          disabled={state === 'loading'}
          className="bg-white text-gray-900 placeholder:text-gray-400 w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      )}
      <button
        type="button"
        onClick={handleSuspend}
        disabled={state === 'loading' || (showReasonInput && !reason.trim())}
        className="w-full min-h-[44px] px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {showReasonInput ? '임시조치 확정' : '임시조치 (프로필 내리기)'}
      </button>
    </div>
  );
}
