import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountSidebar } from '@/components/AccountSidebar';
import { TermsAgreementCard } from './TermsAgreementCard';

export default async function TermsAgreementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/my/terms');
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <AccountSidebar />
      <div className="flex-1 min-w-0 max-w-2xl mx-auto px-4 py-8 w-full">
        <div className="bg-white rounded-lg shadow p-8 space-y-6">
          <div>
            <h1 className="text-page-title font-bold text-gray-900">약관 동의</h1>
          </div>
          <TermsAgreementCard />
        </div>
      </div>
    </div>
  );
}
