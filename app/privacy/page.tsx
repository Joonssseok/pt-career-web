import Link from 'next/link';
import { DraftLegalBanner } from '@/components/DraftLegalBanner';

export const metadata = {
  title: '개인정보처리방침 (초안) — PT Career',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← 홈
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">개인정보처리방침 (초안)</h1>

        <DraftLegalBanner />

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">1. 수집하는 개인정보 항목</h2>
            <p className="mb-2">PT Career는 다음과 같은 개인정보를 수집합니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>회원가입 시(필수)</strong>: 이메일 주소(Google 계정 인증 정보)
              </li>
              <li>
                <strong>전문가 프로필 작성 시</strong>: 이름/활동명, 프로필 사진, 직군, 한 줄 소개 및
                상세 소개, 총 경력년수
              </li>
              <li>
                <strong>경력 정보</strong>: 조직명, 직책, 근무 기간, 설명
              </li>
              <li>
                <strong>근무기관 정보</strong>: 센터명, 주소, 활동 지역, 전화번호, 홈페이지, 외부
                연락처
              </li>
              <li>
                <strong>자격 정보</strong>: 자격증명, 자격 카테고리(국가면허/국가자격/민간자격/교육수료
                등), 발급기관, 취득일, 자격증 번호(암호화 저장), 자격 증빙 파일(이미지/PDF)
              </li>
              <li>
                <strong>전문분야</strong>: 선택한 전문 분야(최대 3개)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">2. 공개 범위 (중요)</h2>
            <p className="mb-2">
              관리자 검토를 거쳐 <strong>승인 및 공개 상태</strong>가 된 프로필에 한해, 다음 정보만
              전문가 목록/상세 페이지(<code>/experts</code>)에서 누구나 열람할 수 있도록 공개됩니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>이름/활동명, 프로필 사진, 직군, 소개, 총 경력년수</li>
              <li>경력 사항(조직명, 직책, 기간)</li>
              <li>근무기관 정보(센터명, 지역 등 — 위치 공개 여부는 전문가 본인이 선택)</li>
              <li>전문분야</li>
              <li>자격증명, 발급기관, 취득일, 자격 카테고리</li>
            </ul>
            <p className="mb-2">
              다음 정보는 <strong>어떤 경우에도 공개되지 않으며</strong>, 본인과 관리자만 열람할 수
              있습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>이메일 주소</li>
              <li>자격증 번호(암호화 저장)</li>
              <li>자격 증빙 파일 원본(비공개 저장소에 저장, 서명된 접근으로만 열람)</li>
              <li>검토 대기 중이거나 반려된 프로필 전체, 반려 사유 및 관리자 검토 메모</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">3. 이용 목적</h2>
            <p>
              회원 식별 및 로그인, 전문가 프로필의 등록·검토·공개, 소비자의 전문가 검색·공유 기능
              제공, 서비스 운영 및 개선을 위해 개인정보를 이용합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">4. 보유 및 파기</h2>
            <p>
              회원 탈퇴 시 계정 및 이에 연결된 프로필·경력·자격·근무기관·증빙 파일 등 모든 개인정보는
              지체 없이 삭제됩니다(관련 법령에 따라 별도 보관 의무가 있는 경우는 예외).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">5. 제3자 제공</h2>
            <p>
              PT Career는 원칙적으로 개인정보를 제3자에게 제공하지 않습니다. 다만 Google OAuth를 통한
              로그인 인증 과정에서 Google에 필요한 최소한의 인증 정보가 전달됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">6. 이용자의 권리</h2>
            <p>
              이용자는 언제든지 본인의 개인정보 열람·정정·삭제를 요청할 수 있습니다. 요청 방법 및
              절차는 법률 검토 후 구체화될 예정입니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">문의</h2>
            <p>개인정보 관련 문의는 (연락처/이메일 — 확정 전) 로 연락해주세요.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
