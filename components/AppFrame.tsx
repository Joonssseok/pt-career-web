'use client';

import { usePathname } from 'next/navigation';

// 사이드바(AccountSidebar)를 쓰는 화면과 관리자 화면은 좁은 프레임에 넣으면
// 내용이 찌그러지므로 제외한다. 그 외 소비자용 화면(랜딩/experts/약관 등)은
// 콘텐츠가 아직 적어 넓은 데스크톱 화면에서 휑해 보이므로, 앱처럼 폭을 좁혀
// 중앙에 고정하고 바깥은 옅은 배경으로 채운다.
const WIDE_PATH_PREFIXES = ['/admin', '/my', '/expert'];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 단순 startsWith는 '/expert'가 '/experts'까지 잘못 잡아먹으므로
  // 정확히 그 경로이거나 그 하위 경로('/expert/...')일 때만 매칭한다.
  const isWide = WIDE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)
  );

  if (isWide) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto min-h-screen w-full max-w-2xl bg-white sm:border-x sm:border-slate-200 sm:shadow-sm">
        {children}
      </div>
    </div>
  );
}
