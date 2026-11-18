import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReferralCampaigns } from "@/app/actions/referral";
import { ReferralCampaignManager } from "@/components/ReferralCampaignManager";

export default async function ReferralAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/admin/referrals");
  const admin = await supabase.rpc("is_admin");
  if (admin.error || admin.data !== true) redirect("/");
  const result = await getReferralCampaigns();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin" className="text-sm text-blue-600">
        ← 운영 관리
      </Link>
      <h1 className="mb-6 mt-5 text-page-title font-bold">
        추천인·행사 코드 관리
      </h1>
      <ReferralCampaignManager
        campaigns={result.ok ? result.campaigns : []}
        initialError={result.ok ? undefined : result.error}
      />
    </main>
  );
}
