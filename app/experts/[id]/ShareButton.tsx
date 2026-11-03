'use client';

import { trackEvent } from "@/lib/analytics";
import { useState } from 'react';

type ShareButtonProps = {
  shareUrl?: string;
  profileId: string;
  displayName: string | null;
  headline: string | null;
};

export function ShareButton({ displayName, headline, shareUrl }: ShareButtonProps) {
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  };

  const handleShare = async () => {
    const url = shareUrl ?? window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: displayName ?? undefined,
          text: headline ?? undefined,
          url,
        });
        trackEvent("share");
      } catch {
        // 사용자가 공유 시트를 취소한 경우 — 이벤트 기록하지 않음
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      trackEvent("share");
      showMessage('링크가 복사되었습니다');
    } catch {
      showMessage('링크 복사에 실패했습니다');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleShare}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-blue-200 bg-white px-5 py-3 text-center text-sm font-semibold text-primary transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m-4 4 4-4 4 4M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></svg>
        프로필 공유하기
      </button>
      {message && (
        <p className="absolute left-1/2 -translate-x-1/2 -bottom-8 text-xs text-white bg-gray-900 px-3 py-1.5 rounded-full whitespace-nowrap">
          {message}
        </p>
      )}
    </div>
  );
}
