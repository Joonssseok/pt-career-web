// 헤더(SiteHeader)는 이 프레임 밖에서 항상 전체 화면 폭으로 렌더링된다
// (app/layout.tsx). 이 프레임은 헤더를 제외한 나머지(페이지 콘텐츠 +
// SiteFooter)를 모든 경로 예외 없이 동일한 폭으로 가운데 고정한다.
// path 예외(WIDE_PATH_PREFIXES)는 2026-08-13 지시서로 제거됐고 다시
// 들여오지 않는다(2026-08-19 "Verified Motion" 지시서, 1300px -> 1240px
// 재조정 시에도 동일 원칙 유지).
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto min-h-screen w-full max-w-[1240px] bg-white px-5 sm:border-x sm:border-slate-200 sm:shadow-sm lg:px-8">
        {children}
      </div>
    </div>
  );
}
