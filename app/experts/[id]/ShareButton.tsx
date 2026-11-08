"use client";

import { trackEvent } from "@/lib/analytics";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import { useState } from "react";

type ShareButtonProps = {
  shareUrl?: string;
  profileId: string;
  displayName: string | null;
  headline: string | null;
  iconOnly?: boolean;
  preview?: boolean;
};

const iconButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function ProfileHeaderActions(
  props: Omit<ShareButtonProps, "iconOnly">,
) {
  return (
    <div className="flex items-center gap-2">
      <ComingSoonButton className={iconButtonClass}>
        <svg
          aria-hidden
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 3 2.8 5.7 6.3.9-4.55 4.44 1.07 6.26L12 17.35l-5.62 2.95 1.07-6.26L2.9 9.6l6.3-.9L12 3Z" />
        </svg>
        <span className="sr-only">프로필 즐겨찾기</span>
      </ComingSoonButton>
      <ShareButton {...props} iconOnly />
    </div>
  );
}

export function ShareButton({
  displayName,
  headline,
  shareUrl,
  iconOnly = false,
  preview = false,
}: ShareButtonProps) {
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  };

  const handleShare = async () => {
    if (preview) {
      showMessage("게시 전 미리보기에서는 공유되지 않습니다");
      return;
    }
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
      showMessage("링크가 복사되었습니다");
    } catch {
      showMessage("링크 복사에 실패했습니다");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="프로필 공유하기"
        onClick={handleShare}
        className={
          iconOnly
            ? iconButtonClass
            : "flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-blue-200 bg-white px-5 py-3 text-center text-sm font-semibold text-primary transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        }
      >
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V3m-4 4 4-4 4 4M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
        </svg>
        {!iconOnly && "프로필 공유하기"}
      </button>
      {message && (
        <p
          role="status"
          className={`absolute ${iconOnly ? "right-0 bottom-full mb-2" : "left-1/2 -translate-x-1/2 -bottom-8"} text-xs text-white bg-gray-900 px-3 py-1.5 rounded-full whitespace-nowrap`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
