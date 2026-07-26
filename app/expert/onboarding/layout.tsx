import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/expert/onboarding');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingHeader />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}

function OnboardingHeader() {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">
          전문가 프로필 설정
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          PT Career에서 당신의 전문가 프로필을 완성해보세요
        </p>
      </div>
    </div>
  );
}
