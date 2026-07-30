'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewLicense } from '@/app/actions/admin';
import { LICENSE_STATUS_META as STATUS_META } from '@/lib/constants/status-badges';

type ReviewState = 'default' | 'loading' | 'error';

export function LicenseReviewActions({
  licenseId,
  verificationStatus,
}: {
  licenseId: string;
  verificationStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(verificationStatus);
  const [state, setState] = useState<ReviewState>('default');
  const [error, setError] = useState('');

  const submit = async (decision: 'verified' | 'rejected') => {
    setState('loading');
    setError('');

    const result = await reviewLicense(licenseId, decision);

    if (result.ok) {
      setStatus(decision);
      setState('default');
      router.refresh();
    } else {
      setError(result.error);
      setState('error');
    }
  };

  const meta = STATUS_META[status] ?? STATUS_META.not_submitted;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}>
          {meta.label}
        </span>
        {error && <span className="text-xs text-red-600">처리 실패: {error}</span>}
      </div>
      {/* 이미 결정된 항목도 재조정 가능하도록 버튼은 항상 활성 상태로 둔다. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit('rejected')}
          disabled={state === 'loading'}
          className="min-h-[36px] px-3 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          반려
        </button>
        <button
          type="button"
          onClick={() => submit('verified')}
          disabled={state === 'loading'}
          className="min-h-[36px] px-3 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
        >
          {state === 'loading' ? '처리 중...' : '인증'}
        </button>
      </div>
    </div>
  );
}
