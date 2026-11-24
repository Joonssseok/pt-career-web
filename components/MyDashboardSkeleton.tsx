export function MyDashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="마이페이지를 불러오는 중이에요"
      className="space-y-5"
    >
      <span className="sr-only">마이페이지를 불러오는 중이에요.</span>
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
        <div className="h-8 w-40 rounded bg-slate-100" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-52 rounded-xl bg-slate-100" />
        <div className="h-40 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export function AccountSidebarSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="hidden w-52 shrink-0 border-r border-slate-100 bg-white md:block"
    />
  );
}
