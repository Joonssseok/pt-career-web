import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountSidebar } from "@/components/AccountSidebar";
import { getReferralStatus } from "@/app/actions/referral";
import { ReferralCodePanel } from "@/components/ReferralCodePanel";

export default async function ReferralPage({
  searchParams,
}: {
  searchParams: Promise<{ referral_notice?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my/referrals");
  const [referral, query] = await Promise.all([
    getReferralStatus(),
    searchParams,
  ]);
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <AccountSidebar />
      <main className="mx-auto w-full min-w-0 max-w-2xl flex-1 px-4 py-8">
        <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
          <ReferralCodePanel
            headingLevel="h1"
            initial={referral.ok ? referral.status : null}
            initialError={referral.ok ? undefined : referral.error}
            notice={query.referral_notice === "failed"}
          />
        </div>
      </main>
    </div>
  );
}
