import Link from 'next/link';

// 연락처 mailto 주소는 아직 확정 전 -- 실제 주소가 정해지기 전까지는
// 링크를 걸지 않고 텍스트만 둔다(하드코딩 금지 지시).
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 px-4 py-10 sm:px-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
        <div>
          <p className="font-bold text-slate-900">PT Career</p>
          <p className="text-slate-500 mt-2 leading-relaxed">
            경력과 자격을 투명하게 연결해 더 나은 움직임을 만드는 재활·운동 전문가
            플랫폼.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide mb-2">찾아보기</p>
          <ul className="space-y-1.5">
            <li>
              <Link href="/experts" className="text-slate-600 hover:text-slate-900">
                전문가 찾기
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-slate-600 hover:text-slate-900">
                서비스 소개
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-slate-600 hover:text-slate-900">
                이용약관
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-slate-600 hover:text-slate-900">
                개인정보처리방침
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide mb-2">전문가라면</p>
          <ul className="space-y-1.5 text-slate-400">
            <li>프로필 등록 문의</li>
            <li>제휴 문의</li>
            <li>인증 정책 안내</li>
          </ul>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-8 text-center">
        © 2026 PT Career. 신뢰할 수 있는 전문가 찾기
      </p>
    </footer>
  );
}
