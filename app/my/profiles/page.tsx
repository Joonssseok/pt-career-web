import EditForm from "@/app/expert/edit/EditForm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountSidebar } from "@/components/AccountSidebar";
import type { ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
import type { ProfileVersion } from "@/lib/profile-versions/types";
import { ProfileVersionManager } from "./ProfileVersionManager";
export default async function ProfileVersionsPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string; new?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my/profiles");
  const query = await searchParams;
  const [{ data: versions, error }, { data: base }] = await Promise.all([
    supabase
      .from("profile_versions")
      .select(
        "id,title,draft_content,published_content,is_representative,updated_at,published_at",
      )
      .eq("owner_id", user.id)
      .order("created_at"),
    supabase
      .from("profiles")
      .select(
        "id,display_name,headline,introduction,verification_status,is_public,suspended_at,deletion_requested_at",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (error)
    throw new Error(
      "프로필 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  let expert: ExpertProfileViewProps["expert"] | null = null;
  if (base) {
    const { data } = await supabase
      .from("public_expert_detail")
      .select("*")
      .eq("id", base.id)
      .maybeSingle();
    expert = data as ExpertProfileViewProps["expert"] | null;
  }
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AccountSidebar />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
        <ProfileVersionManager
          key={query.new === "1" ? "new" : query.profile || "list"}
          owner={user.id}
          versions={(versions || []) as ProfileVersion[]}
          selectedId={query.profile}
          startNew={query.new === "1"}
          base={base}
          expert={expert}
          commonEditor={<EditForm embedded commonOnly />}
        />
      </main>
    </div>
  );
}
