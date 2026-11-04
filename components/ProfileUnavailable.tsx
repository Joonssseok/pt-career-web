import Link from "next/link";

export function ProfileUnavailable({ state }: { state: "private" | "unavailable" }) {
  const withdrawn = state === "unavailable";
  return (
    <main className="relative isolate flex min-h-[calc(100svh-21rem)] items-center justify-center overflow-hidden px-5 py-20 sm:min-h-[calc(100svh-19rem)]">
      <section className="max-w-xl text-center" aria-labelledby="profile-unavailable-title">
        <div aria-hidden="true" className={`mx-auto mb-7 flex size-20 items-center justify-center rounded-3xl border ${withdrawn ? "border-slate-200 bg-slate-50 text-slate-500" : "border-blue-100 bg-blue-50/50 text-primary"}`}>
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {withdrawn ? <><path d="M24 11H11a3 3 0 0 0-3 3v15a3 3 0 0 0 3 3h13" /><path d="M21 21h14m-5-5 5 5-5 5" /></> : <><rect x="10" y="18" width="20" height="16" rx="4" /><path d="M14 18v-5a6 6 0 0 1 12 0v5M20 25v3" /></>}
          </svg>
        </div>
        <h1 id="profile-unavailable-title" className="text-page-title font-semibold tracking-tight text-slate-950">{withdrawn ? "더 이상 제공되지 않는 프로필입니다." : "현재 비공개인 프로필입니다."}</h1>
        {!withdrawn && <><p className="mt-4 text-sm text-slate-500">프로필 정보를 확인할 수 없습니다.</p><p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-500"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-primary"><path d="M3 10a7 7 0 0 1 12-5m2 5a7 7 0 0 1-12 5M15 1v4h-4M5 19v-4h4" /></svg>다시 공개되면 같은 QR코드로 확인할 수 있어요.</p></>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/experts" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-blue-700">다른 전문가 둘러보기 <span aria-hidden="true">→</span></Link>
          <Link href="/home" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm text-slate-500 hover:bg-slate-50">홈으로</Link>
        </div>
      </section>
    </main>
  );
}
