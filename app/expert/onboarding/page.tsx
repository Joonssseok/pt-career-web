import { redirect } from 'next/navigation';

// 온보딩 마법사(6단계 페이지 이동)는 /expert/edit 연속 스크롤 페이지로
// 통합되었다. 북마크되었거나 외부에서 들어올 수 있는 옛 경로를 완전히
// 삭제하는 대신 리다이렉트로 남겨둔다.
export default function OnboardingRedirect() {
  redirect('/expert/edit');
}
