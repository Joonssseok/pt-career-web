import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountSidebar } from '@/components/AccountSidebar';

export const dynamic = 'force-dynamic';

export default async function EditLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/expert/edit');
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <AccountSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
