'use client';

import { usePathname } from 'next/navigation';

// 모든 경로에서 본문 폭은 1240px로 유지한다.
export function AppFrame({ children }: { children: React.ReactNode }) {
  const isLanding = usePathname() === '/';

  return (
    <div className={`min-h-screen ${isLanding ? 'bg-white' : 'bg-background'}`}>
      <div className={`mx-auto min-h-screen w-full max-w-page bg-white px-5 lg:px-8 ${isLanding ? '' : 'sm:border-x sm:border-slate-200 sm:shadow-sm'}`}>
        {children}
      </div>
    </div>
  );
}
