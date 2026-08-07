'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 모바일(<md)에서만 보이는 햄버거 버튼 + 좌측 슬라이드 드로어. 데스크톱
// 사이드바(AccountSidebar)와 동일한 메뉴 콘텐츠를 children으로 받아 그대로
// 렌더링한다 — 항목 목록을 여기서 따로 유지하지 않는다.
export function AccountMobileDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, closeDrawer]);

  return (
    <div className="md:hidden">
      <div className="flex items-center border-b border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={open}
          className="flex items-center justify-center w-9 h-9 -ml-1.5 rounded-md text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <span className="text-2xl leading-none" aria-hidden="true">
            ≡
          </span>
        </button>
      </div>

      <button
        type="button"
        aria-label="메뉴 닫기"
        tabIndex={open ? 0 : -1}
        onClick={closeDrawer}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="계정 메뉴"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-xl overflow-y-auto transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="메뉴 닫기"
            className="flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <span className="text-lg leading-none" aria-hidden="true">
              ✕
            </span>
          </button>
        </div>
        <div className="p-4 space-y-6">{children}</div>
      </div>
    </div>
  );
}
