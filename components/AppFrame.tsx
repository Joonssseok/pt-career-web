// 헤더(SiteHeader)는 이 프레임 밖에서 항상 전체 화면 폭으로 렌더링된다
// (app/layout.tsx). 이 프레임은 헤더를 제외한 나머지(페이지 콘텐츠 +
// SiteFooter)를 모든 경로 예외 없이 동일한 폭으로 가운데 고정한다.
// 예전에는 사이드바(AccountSidebar)를 쓰는 /my, /expert/*와 관리자 화면
// /admin을 이 프레임에서 제외했지만, 폭이 672px -> 1300px로 넓어지면서
// 그 화면들의 내부 최대폭(사이드바 256px + 콘텐츠 최대 672px, 관리자
// 콘텐츠 최대 896px)이 전부 1300px 안에 여유롭게 들어가 찌그러지지
// 않는 걸 직접 확인했으므로 예외를 없앴다(2026-08-13 지시서).
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto min-h-screen w-full max-w-[1300px] bg-white sm:border-x sm:border-slate-200 sm:shadow-sm">
        {children}
      </div>
    </div>
  );
}
