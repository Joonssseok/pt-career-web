import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { personalGateOpen } from "@/lib/auth/personal-info-gate";
import { AccountSidebar } from "@/components/AccountSidebar";
import { getOwnResumePhone } from "@/app/actions/profile";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo-url";
import { PersonalPasswordGate } from "./PersonalPasswordGate";
export const dynamic = "force-dynamic";
export default async function PersonalInfoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my/personal");
  const verified = await personalGateOpen(supabase, user.id);
  let form: React.ReactNode = null;
  if (verified) {
    const [{ data: profile }, phone] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name,profile_image_path")
        .eq("user_id", user.id)
        .maybeSingle(),
      getOwnResumePhone(),
    ]);
    const photo = getProfilePhotoUrl(profile?.profile_image_path);
    form = (
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">내정보 수정</h1>
        <p className="mt-3 text-sm text-slate-500">
          사진·이름·연락처·집주소를 관리하는 별도 공간입니다.
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
            ["전화번호", phone.ok ? phone.phone : ""],
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
          항목 배치 미리보기입니다. 이 화면의 사진 변경·정보 저장 및 주소 보관은
          아직 연결되지 않았습니다.
        </p>
        <button
          disabled
          className="mt-4 min-h-12 rounded-xl bg-slate-100 px-5 text-sm text-slate-400"
        >
          내정보 저장 · 준비 중
        </button>
      </section>
    );
  }
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AccountSidebar />
      <main className="min-w-0 flex-1 px-4 py-10 sm:px-8">
        {verified ? form : <PersonalPasswordGate />}
      </main>
    </div>
  );
}
