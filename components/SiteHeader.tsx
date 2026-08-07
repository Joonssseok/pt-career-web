import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 환영 문구 이름: 전문가 프로필 활동명 > 소셜 로그인 이름 > 이메일 앞부분
  let welcomeName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();
    welcomeName =
      profile?.display_name ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      null;
  }

  return (
    <nav className="sticky top-0 z-40 flex h-16 items-center justify-between px-4 sm:px-6 border-b border-gray-100 bg-white">
      {/* 왼쪽: 로고 + 전역 내비게이션(로그인 여부와 무관하게 항상 표시) */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href="/" className="text-lg font-bold text-slate-900 sm:text-xl">
          PT Career
        </Link>
        <Link
          href="/experts"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          전문가 찾기
        </Link>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        {user ? (
          <>
            {welcomeName && (
              <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-[12rem]">
                <span className="font-semibold text-gray-900">{welcomeName}</span>님 환영합니다
              </span>
            )}
            <Link
              href="/my"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              마이페이지
            </Link>
          </>
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
