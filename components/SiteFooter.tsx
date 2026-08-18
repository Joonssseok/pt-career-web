import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 px-4 py-6 sm:px-6 sm:py-8 text-center">
      <p className="text-sm text-slate-500">© 2026 PT Career. 신뢰할 수 있는 전문가 찾기</p>
      <p className="text-xs text-slate-400 mt-2">
        <Link href="/about" className="hover:text-slate-600 underline">
          서비스 소개
        </Link>
        {' · '}
        <Link href="/terms" className="hover:text-slate-600 underline">
          이용약관
        </Link>
        {' · '}
        <Link href="/privacy" className="hover:text-slate-600 underline">
          개인정보처리방침
        </Link>
      </p>
    </footer>
  );
}
