import Link from 'next/link';
import { MotionPath } from '@/components/MotionPath';

const VALUES = [
  { title: '투명한 검증', desc: '자격증은 본인이 아니라 관리자가 직접 확인한 뒤에만 인증 배지를 붙입니다.' },
  { title: '있는 그대로', desc: '없는 데이터를 꾸미지 않습니다. 확인되지 않은 통계나 후기는 만들지 않습니다.' },
  { title: '직접 연결', desc: '중개 수수료나 예약 시스템 없이, 전문가와 이용자가 직접 연락합니다.' },
];

const FAQS = [
  { q: '이 서비스는 무엇을 하나요?', a: 'PT·재활운동 등 운동 전문가의 경력과 자격증을 검증해 소개하는 서비스입니다. 예약이나 결제 기능은 없습니다.' },
  { q: '자격증은 어떻게 검증되나요?', a: '전문가가 자격증 정보와 증빙 파일을 등록하면 관리자가 직접 확인 후 인증 배지를 부여합니다.' },
  { q: '경력 정보도 검증되나요?', a: '경력 기간은 자동으로 합산되어 총 경력으로 표시되지만, 소개글 등 서술 내용은 본인이 직접 작성한 내용입니다.' },
  { q: '전문가로 등록하려면 어떻게 하나요?', a: '회원가입 후 프로필 만들기에서 기본 정보, 경력, 자격증을 입력하면 됩니다. 약 5분 정도 걸립니다.' },
  { q: '이용자와 전문가는 어떻게 연결되나요?', a: '전화, 이메일, SNS 등 전문가가 공개한 연락처로 직접 연결됩니다. 서비스 내 채팅이나 예약 기능은 없습니다.' },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-b from-blue-50/80 via-white to-gray-50 px-4 py-12 sm:px-6 text-center">
        <h1 className="text-page-title font-bold text-slate-900 mb-3">
          경력을 더 투명하게, 움직임을 더 가깝게
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          PT Career는 운동·재활 전문가의 경력과 자격을 검증해 소개하는 서비스입니다.
        </p>
      </section>

      <MotionPath />

      <section className="px-4 py-8 sm:px-6 max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
        {VALUES.map((v) => (
          <div key={v.title} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-bold text-emerald-600 mb-1">{v.title}</p>
            <p className="text-sm text-slate-600">{v.desc}</p>
          </div>
        ))}
      </section>

      <section className="px-4 py-8 sm:px-6 max-w-3xl mx-auto text-center">
        <p className="font-bold text-slate-900 mb-1">전문가이신가요?</p>
        <p className="text-sm text-slate-600 mb-4">경력과 자격으로 신뢰를 보여주세요.</p>
        <Link
          href="/signup"
          className="inline-block py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-[0_8px_18px_-12px_rgba(37,99,235,0.8)] active:scale-[0.97] transition-all"
        >
          전문가로 등록하기
        </Link>
      </section>

      <MotionPath />

      <section className="px-4 py-8 sm:px-6 pb-16 max-w-2xl mx-auto">
        <h2 className="text-page-title font-bold text-slate-900 mb-4">자주 묻는 질문</h2>
        <div className="space-y-2">
          {FAQS.map((f) => (
            <details key={f.q} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 group">
              <summary className="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center">
                {f.q}
                <span className="text-slate-400 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-sm text-slate-600 mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
