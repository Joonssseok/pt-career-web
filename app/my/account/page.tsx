import { redirect } from "next/navigation";

// Preserve existing bookmarks and authentication callbacks after the menu merge.
export default async function AccountRedirect({
  searchParams,
}: {
  searchParams: Promise<{
    naver_link_error?: string;
    referral_notice?: string;
  }>;
}) {
  const query = await searchParams;
  if (query.referral_notice) redirect("/my/referrals?referral_notice=failed");
  const suffix = query.naver_link_error
    ? `?${new URLSearchParams({ naver_link_error: query.naver_link_error.slice(0, 100) })}`
    : "";
  redirect(`/my/personal${suffix}`);
}
