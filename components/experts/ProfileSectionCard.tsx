"use client";

// Keep section keys and titles intact across the public page's server/client boundary.
import type { ReactNode } from "react";

export function ProfileSectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-3 text-base font-bold tracking-tight text-slate-900">
        <span aria-hidden className="h-4 w-0.5 rounded-full bg-primary" />
        {title}
        {action && <span className="ml-auto">{action}</span>}
      </h2>
      {children}
    </section>
  );
}
