import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 py-8 text-center sm:py-10">
      <p className="text-lg font-extrabold tracking-tight text-slate-950">
        PT <span className="text-primary">Career</span>
      </p>
      <dl className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs leading-relaxed text-slate-600">
        <div className="flex gap-2"><dt className="text-slate-500">상호</dt><dd>피티커리어</dd></div>
        <div className="flex gap-2"><dt className="text-slate-500">대표자</dt><dd>김준석</dd></div>
        <div className="flex gap-2"><dt className="text-slate-500">사업자등록번호</dt><dd>179-24-02294</dd></div>
        <div className="flex w-full justify-center gap-2"><dt className="shrink-0 text-slate-500">소재지</dt><dd>경기도 성남시 중원구 산성대로 106, 3층 C342호</dd></div>
        <div className="flex gap-2"><dt className="text-slate-500">호스팅 서비스</dt><dd>Vercel Inc.</dd></div>
      </dl>
      <nav aria-label="서비스 안내" className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
        <Link href="/about" className="hover:text-primary">서비스 소개</Link>
        <Link href="/terms" className="hover:text-primary">이용약관</Link>
        <Link href="/privacy" className="font-semibold text-slate-800 hover:text-primary">개인정보처리방침</Link>
      </nav>
      <p className="mt-5 text-xs text-slate-500">© 2026 PT Career. 신뢰할 수 있는 전문가 찾기</p>
    </footer>
  );
}
