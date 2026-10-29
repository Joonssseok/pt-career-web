import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileVisibilityToggle } from "@/components/ProfileVisibilityToggle";
import { ProfileEditSectionLinksDesktop } from "@/components/ProfileEditSectionLinks";
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
      <AccountMenuSection id="profile" title="프로필 관리">
        <Link href="/expert/edit" className={linkClass}>
          {profile ? "프로필 수정" : "프로필 생성"}
        </Link>
        {profile && (
          <>
            <div className="my-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-3">
              <span className="text-xs text-slate-500">프로필 전체 공개</span>
              <ProfileVisibilityToggle initialVisible={profile.owner_visible} />
            </div>
            <ProfileEditSectionLinksDesktop />
          </>
        )}
        {canPreview ? (
          <Link href={`/experts/${profile!.id}`} className={linkClass}>
            프로필 미리보기
          </Link>
        ) : (
          <p className="px-3 py-2 text-xs leading-relaxed text-slate-400">
            공개 승인·공개 설정 후 미리보기 가능
          </p>
        )}
        {profile && (
          <a href="/api/resume" className={linkClass}>
            이력서 다운로드
          </a>
        )}
      </AccountMenuSection>
      <Link
        href="/my#share"
        className="block px-3 py-2 text-sm font-bold text-slate-950 hover:text-primary"
      >
        공유하기
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
