"use client";

import { useRef, type ReactNode } from "react";

export function ComingSoonButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => dialog.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-label="기능 준비 안내"
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-xl backdrop:bg-slate-900/25"
      >
        <p className="text-base font-semibold text-slate-900">
          준비중인 기능입니다
        </p>
        <form method="dialog" className="mt-5">
          <button
            autoFocus
            className="min-h-11 rounded-xl bg-primary px-8 text-sm font-semibold text-white hover:bg-blue-700"
          >
            확인
          </button>
        </form>
      </dialog>
    </>
  );
}
