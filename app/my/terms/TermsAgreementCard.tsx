'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { agreeToTerms, getOwnTermsAgreedAt } from '@/app/actions/terms';

export function TermsAgreementCard() {
  const [checking, setChecking] = useState(true);
  const [agreedAt, setAgreedAt] = useState<string | null>(null);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    getOwnTermsAgreedAt().then((result) => {
      setAgreedAt(result.ok ? result.agreedAt : null);
      setChecking(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleAgree = async () => {
    if (!checkboxChecked) return;
    setSubmitting(true);
    const result = await agreeToTerms();
    setSubmitting(false);
    if (result.ok) {
      load();
    } else {
      alert(result.error);
    }
  };

  if (checking) return null;

  if (agreedAt) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-900 font-medium">✓ 동의 완료</p>
        <p className="text-xs text-green-700 mt-1">
          {new Date(agreedAt).toLocaleString('ko-KR')}에 동의했습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checkboxChecked}
            onChange={(e) => setCheckboxChecked(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-gray-700">
            <Link href="/terms" target="_blank" className="text-blue-600 underline">
              이용약관
            </Link>
            {' '}및{' '}
            <Link href="/privacy" target="_blank" className="text-blue-600 underline">
              개인정보처리방침
            </Link>
            에 동의합니다. (필수)
          </span>
        </label>
      </div>
      <button
        type="button"
        onClick={handleAgree}
        disabled={!checkboxChecked || submitting}
        className="w-full min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {submitting ? '처리 중...' : '동의하기'}
      </button>
    </div>
  );
}
