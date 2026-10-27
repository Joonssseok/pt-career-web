// 모든 페이지의 본문은 같은 폭과 흰 배경을 사용한다.
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto min-h-screen w-full max-w-page bg-white px-5 lg:px-8">
        {children}
      </div>
    </div>
  );
}
