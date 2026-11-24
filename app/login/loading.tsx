export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-8">
      <div
        role="status"
        aria-label="로그인 화면을 불러오는 중이에요"
        className="w-full max-w-sm"
      >
        <h1 className="mb-16 text-center text-page-title font-bold">로그인</h1>
        <span className="sr-only">로그인 화면을 불러오는 중이에요.</span>
        <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
