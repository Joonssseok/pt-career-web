import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="sticky top-0 z-40 flex h-16 items-center justify-between px-4 sm:px-6 border-b border-gray-100 bg-white">
      <Link href="/" className="text-lg font-bold text-slate-900 sm:text-xl">
        PT Career
      </Link>
      <div className="flex items-center gap-4 sm:gap-6">
        <Link
          href="/experts"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          전문가 찾기
        </Link>
        {user ? (
          <Link
            href="/my"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            마이페이지
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              회원가입
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
