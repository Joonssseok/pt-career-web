"use client";

// Keep section keys and titles intact across the public page's server/client boundary.
import type { ReactNode } from "react";

export function ProfileSectionCard({
  title,
  action,
  count,
  children,
}: {
  title: string;
  action?: ReactNode;
  count?: { total: number; verified: number };
  children: ReactNode;
}) {
  return (
    <section data-profile-section className="bg-white py-3">
      <h2
        aria-label={title}
        className="mb-2.5 flex items-center gap-2 border-b border-slate-300 pb-2 text-sm font-medium tracking-[0.06em] text-slate-500"
      >
        <span
          aria-hidden
          className="h-3 w-0.5 shrink-0 rounded-full bg-motion"
        />
        {title}
        {(count || action) && (
          <span className="ml-auto">
            {count
              ? `${count.total}건${count.verified ? (count.verified === count.total ? " 모두 인증" : ` 중 ${count.verified}건 인증`) : ""}`
              : action}
          </span>
        )}
      </h2>
      <div className="pl-3 sm:pl-4">{children}</div>
    </section>
  );
}
