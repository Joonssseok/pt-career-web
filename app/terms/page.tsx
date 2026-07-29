import Link from 'next/link';
import { DraftLegalBanner } from '@/components/DraftLegalBanner';

export const metadata = {
  title: '이용약관 (초안) — PT Career',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← 홈
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">이용약관 (초안)</h1>

        <DraftLegalBanner />

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">제1조 (목적)</h2>
            <p>
              본 약관은 PT Career(이하 &quot;회사&quot;)가 제공하는 운동·재활 전문가 프로필 검색·공유
              서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을
              규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">제2조 (서비스의 내용)</h2>
            <p>
              서비스는 물리치료사, 퍼스널 트레이너, 건강운동관리사 등 운동·재활 전문가가 본인의
              경력·자격·근무기관 정보를 등록하고, 소비자가 이를 지역·전문분야별로 검색하여 신뢰할
              수 있는 전문가를 찾고 공유할 수 있도록 지원합니다. 전문가 프로필은 회사의 검토(자격
              증빙 확인) 절차를 거친 뒤에만 공개됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">제3조 (회원가입 및 계정)</h2>
            <p>
              서비스 이용을 위한 회원가입은 Google 계정을 통한 OAuth 인증(또는 이메일/비밀번호)으로
              이루어지며, 이용자는 본인의 실제 정보를 정확하게 제공해야 합니다. 허위 정보 등록으로
              발생하는 불이익에 대한 책임은 이용자 본인에게 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">제4조 (전문가 정보의 검토 및 게시)</h2>
            <p>
              전문가가 등록한 프로필과 자격 증빙은 회사(관리자)의 검토를 거쳐 승인된 경우에만
              공개됩니다. 회사는 증빙 서류의 진위를 합리적인 범위에서 확인하되, 전문가가 등록한
              정보(경력, 자격, 소개 등)의 정확성에 대한 최종 책임은 해당 전문가 본인에게 있으며,
              회사는 이를 보증하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">제5조 (회사의 역할과 한계)</h2>
            <p>
              회사는 전문가와 소비자를 연결하는 중립적인 정보 플랫폼을 제공할 뿐, 전문가가 제공하는
              시술·훈련·상담 등 실제 서비스의 당사자가 아닙니다. 전문가와 이용자 간의 거래, 상담,
              시술 등에서 발생하는 분쟁 및 손해에 대해 회사는 책임을 지지 않습니다. 본 조항은 법률
              검토를 거쳐 구체화될 예정입니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">제6조 (약관의 변경)</h2>
            <p>
              회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며,
              변경 시 서비스 내 공지를 통해 안내합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">문의</h2>
            <p>약관 관련 문의는 (연락처/이메일 — 확정 전) 로 연락해주세요.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
