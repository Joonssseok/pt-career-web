import Link from 'next/link';
import { PrivacyContent } from '@/components/legal/PrivacyContent';

export const metadata = {
  title: '개인정보처리방침 (초안) — PT Career',
};

// 게시 전 필수 확정 체크리스트 (원본 docx 기준, 대표/운영 확인 필요 — 본문에는 미노출):
// - 회사명·대표자·사업자등록번호·주소·고객문의 연락처 및 약관 시행일
// - 개인정보 보호책임자·담당부서·권리행사 접수처
// - 탈퇴 요청 후 실제 삭제 시점, 유예·복구 정책, 백업 순환삭제 주기
// - Google OAuth scope와 실제 반환·저장 필드
// - Supabase·Vercel·Google의 정확한 계약 법인명, 리전, 재위탁 및 국외 이전 구조
// - 국외 이전 시 국가·항목·시기·방법·수령자 연락처·목적·기간·법적 근거·거부방법
// - 자체 통계의 배포 설정 및 90일 정리 작업 실행 여부
// - 로그·IP·기기정보의 실제 수집 항목 및 보유기간
// - 자격 증빙 Storage/RLS 접근권한과 불필요한 주민등록번호 유입 방지 절차
// - 안전성 확보조치의 실제 구현 여부 및 법정 보존항목
// - 만 14세 미만 가입 차단 방식, 권익침해 구제기관 최신 연락처
// - 프로필 공개 설정의 UI 문구·기본값과 본 방침의 일치 여부
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
