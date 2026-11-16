"use client";

import { forwardRef, type ReactNode } from "react";

export const SelectionDisclosure = forwardRef<
  HTMLDetailsElement,
  { label: string; selected: string[]; max: number; children: ReactNode }
>(function SelectionDisclosure({ label, selected, max, children }, ref) {
  return (
    <details ref={ref} className="group border-b border-slate-100">
      <summary
        aria-label={`${label} 선택 목록`}
        className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden"
      >
        <span className="min-w-0 flex-1 break-words leading-6 text-slate-700">
          {selected.length ? selected.join(" · ") : "선택해주세요"}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          {selected.length}/{max}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          className="h-4 w-4 shrink-0 text-slate-400 group-open:rotate-180"
        >
          <path d="m5 7.5 5 5 5-5" strokeWidth="1.5" />
        </svg>
      </summary>
      <div
        role="group"
        aria-label={`${label} 선택`}
        tabIndex={0}
        className="max-h-60 overflow-y-auto overscroll-contain border-t border-slate-100 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        {children}
      </div>
    </details>
  );
});
