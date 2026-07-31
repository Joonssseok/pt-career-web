import { redirect } from 'next/navigation';

// 옛 온보딩 스텝 경로(/expert/onboarding/profile 등)를 전부 흡수해
// /expert/edit로 리다이렉트한다.
export default function OnboardingSubpathRedirect() {
  redirect('/expert/edit');
}
