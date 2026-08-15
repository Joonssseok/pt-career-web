import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">
        <p className="text-[36px] font-bold text-gray-900">404</p>
        <p className="text-2xl font-bold text-gray-900">페이지를 찾을 수 없습니다</p>
        <p className="text-base text-gray-500">
          요청하신 페이지가 없거나 주소가 변경되었습니다.
        </p>
        <Link
          href="/"
          className="w-full min-h-[44px] flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          홈으로 돌아가기
        </Link>
        <Link
          href="/experts"
          className="w-full min-h-[44px] flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          전문가 찾기
        </Link>
      </div>
    </main>
  );
}
