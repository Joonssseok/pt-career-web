import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export async function SiteHeader({
  left,
  className,
}: {
  left: React.ReactNode;
  className: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className={className}>
      {left}
      {user ? (
        <Link
          href="/my"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          마이페이지
        </Link>
      ) : (
        <Link
          href="/login"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          로그인
        </Link>
      )}
    </nav>
  );
}
