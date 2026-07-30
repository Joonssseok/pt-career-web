export type StatusBadgeMeta = { label: string; className: string };

// 프로필(profiles.verification_status) 배지 색상 — components/AccountSidebar.tsx가 쓰던 값 그대로.
export const PROFILE_STATUS_META: Record<string, StatusBadgeMeta> = {
  draft: { label: '작성 중', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  pending: { label: '검토 중', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: '공개 중', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: '반려됨', className: 'bg-red-50 text-red-700 border-red-200' },
};

// 자격증(licenses.verification_status) 배지 색상. not_submitted/pending은 "아직 심사
// 전"이라는 점에서 사용자 입장에 의미 차이가 없어 회색 "검토 대기"로 통일한다 — 파랑은
// PROFILE_STATUS_META의 pending("검토 중")이 이미 쓰고 있어, 두 배지가 같이 보이는 화면
// (예: /admin/[id])에서 서로 다른 개념인데 같은 색으로 보이는 혼선을 막기 위함.
export const LICENSE_STATUS_META: Record<string, StatusBadgeMeta> = {
  not_submitted: { label: '검토 대기', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  pending: { label: '검토 대기', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  verified: { label: '인증됨', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: '반려됨', className: 'bg-red-50 text-red-700 border-red-200' },
};
