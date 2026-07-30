'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewLicense } from '@/app/actions/admin';

type ReviewState = 'default' | 'loading' | 'error';

// not_submitted/pending 모두 "아직 심사 전"이라는 점에서 동일하게 취급 —
// 본인 화면(CertificationSection)의 "검토 대기" 표기와 의미를 맞춘다.
const STATUS_META: Record<string, { label: string; className: string }> = {
  not_submitted: { label: '미검토', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  pending: { label: '미검토', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  verified: { label: '인증됨', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: '반려됨', className: 'bg-red-50 text-red-700 border-red-200' },
};

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
