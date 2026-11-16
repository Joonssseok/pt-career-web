import Link from 'next/link';
import { TermsContent } from '@/components/legal/TermsContent';

export const metadata = {
  title: '이용약관 (초안) — PT Career',
};

// 2026-11-16 operational revision; keep draft until unresolved publication items are confirmed.
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← 홈
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">PT Career 이용약관</h1>

        <TermsContent />
      </div>
    </main>
  );
}
