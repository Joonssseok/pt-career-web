import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { personalGateOpen } from "@/lib/auth/personal-info-gate";
import { AccountSidebar } from "@/components/AccountSidebar";
import { getOwnResumePhone } from "@/app/actions/profile";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo-url";
import { PersonalPinGate } from "./PersonalPinGate";
import Link from "next/link";
import { AccountInfoForm } from "@/components/AccountInfoForm";
import { NaverAccountLink } from "@/components/auth/NaverAccountLink";
import { NAVER_PROVIDER } from "@/lib/auth/social-login";
import { DeletionBanner } from "../DeletionBanner";
import { SuspensionBanner } from "../SuspensionBanner";
export const dynamic = "force-dynamic";
export default async function PersonalInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ naver_link_error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my/personal");
  const verified = await personalGateOpen(supabase, user.id);
  const { naver_link_error } = await searchParams;
  let form: React.ReactNode = null;
  if (verified) {
    const [{ data: profile }, phone] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name,profile_image_path,deletion_requested_at,suspended_at,suspension_reason",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      getOwnResumePhone(),
    ]);
    const photo = getProfilePhotoUrl(profile?.profile_image_path);
    form = (
      <section className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">내정보 수정</h1>
        <p className="mt-3 text-sm text-slate-500">
          기본정보와 로그인 정보·연락처를 한곳에서 관리합니다.
        </p>
        <div className="mt-6 space-y-5">
          {photo && (
            <img
              src={photo}
              alt="내 사진"
              className="h-32 w-24 rounded-xl object-cover"
            />
          )}
          {[
            ["이름", profile?.display_name || ""],
            ["집주소", ""],
            ["상세주소", ""],
          ].map(([label, value]) => (
            <label
              key={label}
              className="block text-sm font-semibold text-slate-700"
            >
              {label}
              <input
                defaultValue={value}
                autoComplete="off"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal"
              />
            </label>
          ))}
        </div>
        <p className="mt-6 text-xs leading-6 text-slate-400">
          위 기본정보 영역은 항목 배치 미리보기입니다. 이 영역의 사진 변경·이름
          저장 및 주소 보관은 아직 연결되지 않았습니다.
        </p>
        <button
          disabled
          className="mt-4 min-h-12 rounded-xl bg-slate-100 px-5 text-sm text-slate-400"
        >
          기본정보 저장 · 준비 중
        </button>
        <section
          aria-labelledby="personal-login-heading"
          className="border-t border-slate-200 pt-6"
        >
          <h2
            id="personal-login-heading"
            className="mb-5 text-lg font-semibold"
          >
            로그인 정보·연락처
          </h2>
          <AccountInfoForm
            initialEmail={user.email ?? ""}
            initialPhone={phone.ok ? phone.phone : ""}
            hasProfile={!!profile}
          />
        </section>
        {naver_link_error && (
          <p role="alert" className="text-sm text-red-600">
            {naver_link_error === "identity_already_exists"
              ? "이 네이버 계정은 다른 로그인 기록에 연결되어 있어요. 기존 로그인 방법을 이용하고 고객 지원에 문의해주세요."
              : "네이버 연결을 완료하지 못했어요. 기존 로그인 상태를 확인하고 다시 시도해주세요."}
          </p>
        )}
        <NaverAccountLink
          enabled={process.env.NAVER_LOGIN_ENABLED === "true"}
          linked={
            user.identities?.some(
              (identity) => identity.provider === NAVER_PROVIDER,
            ) ?? false
          }
        />
        {profile ? (
          <a
            href="/api/resume"
            className="flex min-h-12 items-center justify-center rounded-lg bg-slate-100 text-sm font-medium text-slate-700"
          >
            이력서 다운로드 (Word)
          </a>
        ) : (
          <Link
            href="/expert/edit"
            className="flex min-h-12 items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white"
          >
            전문가 프로필 만들기
          </Link>
        )}
        {profile?.suspended_at && (
          <SuspensionBanner
            suspendedAt={profile.suspended_at}
            suspensionReason={profile.suspension_reason}
          />
        )}
        {profile?.deletion_requested_at && (
          <DeletionBanner deletionRequestedAt={profile.deletion_requested_at} />
        )}
        <form
          action={async () => {
            "use server";
            const client = await createClient();
            await client.auth.signOut();
            redirect("/login");
          }}
        >
          <button
            type="submit"
            className="min-h-12 w-full rounded-lg bg-slate-100 text-sm font-medium text-slate-700"
          >
            로그아웃
          </button>
        </form>
        <section
          aria-labelledby="personal-delete-heading"
          className="border-t border-slate-200 pt-6"
        >
          <h2
            id="personal-delete-heading"
            className="text-sm font-semibold text-slate-700"
          >
            회원탈퇴
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            탈퇴 전 보관 자료와 삭제 일정을 확인해주세요.
          </p>
          <Link
            href="/my/delete-account"
            className="mt-2 inline-flex min-h-11 items-center text-sm text-red-600"
          >
            회원탈퇴 안내 및 신청 →
          </Link>
        </section>
      </section>
    );
  }
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AccountSidebar />
      <main className="min-w-0 flex-1 px-4 py-10 sm:px-8">
        {verified ? form : <PersonalPinGate />}
      </main>
    </div>
  );
}
