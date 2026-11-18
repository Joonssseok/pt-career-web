import { notFound } from "next/navigation";
import { ReferralCodePanel } from "@/components/ReferralCodePanel";
import { ReferralCampaignManager } from "@/components/ReferralCampaignManager";
import SignUpForm from "@/app/signup/signup-form";
import { AuthPreviewGuard } from "@/app/preview/auth/preview";

export default async function ReferralPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view } = await searchParams;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <nav className="mb-5 flex flex-wrap gap-4 text-sm text-blue-600">
        <a href="?view=signup">가입 시 입력</a>
        <a href="?view=account">가입 후 입력</a>
        <a href="?view=registered">등록 완료</a>
        <a href="?view=admin">운영자 발급</a>
      </nav>
      <p className="mb-5 text-xs text-slate-500">
        개발용 미리보기 · 실제 가입·코드 발급·등록은 진행되지 않습니다.
      </p>
      {view === "signup" ? (
        <AuthPreviewGuard>
          <SignUpForm naverEnabled />
        </AuthPreviewGuard>
      ) : view === "admin" ? (
        <ReferralCampaignManager campaigns={[]} preview />
      ) : (
        <ReferralCodePanel
          initial={{
            registeredCode: view === "registered" ? "PREVIEW2026" : null,
            registeredAt: null,
          }}
          preview
        />
      )}
    </main>
  );
}
