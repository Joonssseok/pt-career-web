import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type PendingProfile = {
  id: string;
  display_name: string | null;
  profession: string | null;
  submitted_at: string | null;
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/admin');
  }

  const { data: isAdmin } = await supabase.rpc('is_admin');

  if (!isAdmin) {
    redirect('/');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, profession, submitted_at')
    .eq('verification_status', 'pending')
    .order('submitted_at', { ascending: true });

  const pending = (data ?? []) as PendingProfile[];

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between px-4 py-4 sm:px-6 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">관리자 — 승인 대기</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          홈으로
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 space-y-3">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
            목록을 불러오지 못했습니다: {error.message}
          </div>
        )}

        {!error && pending.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            검토 대기 중인 프로필이 없습니다.
          </div>
        )}

        {pending.map((p) => (
          <Link
            key={p.id}
            href={`/admin/${p.id}`}
            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 transition-colors min-h-[44px]"
          >
            <div>
              <p className="font-medium text-gray-900">{p.display_name ?? '이름 미입력'}</p>
              <p className="text-sm text-gray-500">{p.profession ?? '직군 미입력'}</p>
            </div>
            <div className="text-xs text-gray-400">
              {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString('ko-KR') : ''}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
