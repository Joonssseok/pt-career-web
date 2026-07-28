'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ShareButtonProps = {
  profileId: string;
  displayName: string | null;
  headline: string | null;
};

export function ShareButton({ profileId, displayName, headline }: ShareButtonProps) {
  const [message, setMessage] = useState<string | null>(null);

  const recordShareEvent = async (shareType: 'native_share' | 'copy_link') => {
    const supabase = createClient();
    await supabase
      .from('share_events')
      .insert({ profile_id: profileId, share_type: shareType, referrer_domain: null });
  };

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  };

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: displayName ?? undefined,
          text: headline ?? undefined,
          url,
        });
        await recordShareEvent('native_share');
      } catch {
        // 사용자가 공유 시트를 취소한 경우 — 이벤트 기록하지 않음
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      await recordShareEvent('copy_link');
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
        className="block w-full min-h-[44px] px-4 py-3 border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-slate-50 transition-colors text-center"
      >
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
