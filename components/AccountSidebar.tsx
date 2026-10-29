import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileVersionLinks } from "@/components/ProfileVersionLinks";

import { AccountMenu, AccountMenuSection } from "@/components/AccountMenu";
import { AccountMobileDrawer } from "@/components/AccountMobileDrawer";

export async function AccountSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, verification_status, owner_visible, is_public, suspended_at, deletion_requested_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: versions } = await supabase
    .from("profile_versions")
    .select("id,title,is_representative")
    .eq("owner_id", user.id)
    .order("created_at");
  const canPreview =
    profile?.verification_status === "approved" &&
    profile.owner_visible &&
    profile.is_public &&
    !profile.suspended_at &&
    !profile.deletion_requested_at;
  const linkClass =
    "flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-blue-50 hover:text-primary";
  const menu = (
    <AccountMenu>
      <Link href="/my" className="block px-3 text-lg font-bold text-slate-950">
        마이페이지
      </Link>
      <Link
        href="/my/personal"
        className="flex min-h-12 items-center rounded-xl px-3 text-sm font-bold text-slate-950 hover:bg-blue-50 hover:text-primary"
      >
        내정보 수정
      </Link>
      <AccountMenuSection id="damoa" title="내활동 다모아">
        <a href="/my/damoa#records" className={linkClass}>
          활동 기록
        </a>
        <a href="/my/damoa#files" className={linkClass}>
          보관 자료
        </a>
        <a href="/my/damoa#summary" className={linkClass}>
          AI 묶음 요약
        </a>
      </AccountMenuSection>
      <AccountMenuSection id="profile" title="프로필 관리" href="/my/profiles">
        <ProfileVersionLinks
          versions={(versions || []).map((v) => ({
            ...v,
            is_representative: v.is_representative && !!canPreview,
          }))}
        />
      </AccountMenuSection>
      <Link
        href="/my#share"
        className="block px-3 py-2 text-sm font-bold text-slate-950 hover:text-primary"
      >
        공유 설정
      </Link>
      <Link
        href="/my#card"
        className="block px-3 py-2 text-sm font-bold text-slate-950 hover:text-primary"
      >
        명함 생성
      </Link>
      <AccountMenuSection id="account" title="계정 설정">
        <Link href="/my/account" className={linkClass}>
          로그인 정보·연락처
        </Link>
        <Link href="/my/terms" className={linkClass}>
          약관 동의
        </Link>
        <Link href="/my/delete-account" className={linkClass}>
          회원 탈퇴
        </Link>
      </AccountMenuSection>
    </AccountMenu>
  );
  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-slate-100 bg-white md:block">
        <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto px-3 py-8">
          {menu}
        </div>
      </aside>
      <AccountMobileDrawer>{menu}</AccountMobileDrawer>
    </>
  );
}
