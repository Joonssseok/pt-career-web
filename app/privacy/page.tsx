import Link from 'next/link';
import { PrivacyContent } from '@/components/legal/PrivacyContent';

export const metadata = {
  title: '개인정보처리방침 (초안) — PT Career',
};

// 2026-11-16 operational revision; keep draft until unresolved publication items are confirmed.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← 홈
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">PT Career 개인정보처리방침</h1>

        <PrivacyContent />
      </div>
    </main>
  );
}
