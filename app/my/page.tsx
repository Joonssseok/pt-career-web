import { LIVE_PROFILE_PUBLISH_ENABLED } from "@/lib/profile-versions/types";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo-url";
import { CATEGORIES } from "@/lib/damoa/categories";
import { AccountSidebar } from "@/components/AccountSidebar";
import { ProfileVisibilityToggle } from "@/components/ProfileVisibilityToggle";
import { ProfileSharingTools } from "@/components/ProfileSharingTools";
import { MyDashboard, type MyDashboardData } from "./MyDashboard";
import { DeletionBanner } from "./DeletionBanner";
import { SuspensionBanner } from "./SuspensionBanner";

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my");

  const [
    profileResult,
    versionsResult,
    activitiesResult,
    filesResult,
    pendingResult,
    reviewsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id,display_name,headline,profile_image_path,verification_status,owner_visible,is_public,deletion_requested_at,suspended_at,suspension_reason",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_versions")
      .select("id,title,is_representative,updated_at", { count: "exact" })
      .eq("owner_id", user.id)
      .order("is_representative", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("damoa_activities")
      .select(
        "id,title:content->>title,category:content->>category,updated_at",
        { count: "exact" },
      )
      .eq("owner", user.id)
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("damoa_files")
      .select("id", { count: "exact", head: true })
      .eq("owner", user.id)
      .eq("ready", true)
      .eq("deleting", false),
    supabase
      .from("profile_item_reviews")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("profile_item_reviews")
      .select("id,title,status,version_id")
      .eq("owner_id", user.id)
      .in("status", ["pending", "verified", "rejected"])
      .order("updated_at", { ascending: false })
      .limit(3),
  ]);
  if (profileResult.error)
    throw new Error("프로필을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  const profile = profileResult.data;
  const canShare =
    !!profile &&
    profile.verification_status === "approved" &&
    profile.owner_visible &&
    profile.is_public &&
    !profile.suspended_at &&
    !profile.deletion_requested_at;

  const [
    { data: representativeRows, error: representativeError },
    { data: publishedVersion, error: publishedError },
  ] = await Promise.all([
    profile && LIVE_PROFILE_PUBLISH_ENABLED
      ? supabase.rpc("get_representative_profiles", {
          p_profile_ids: [profile.id],
        })
      : Promise.resolve({ data: null, error: null }),
    profile
      ? supabase
          .from("profile_versions")
          .select("published_at")
          .eq("owner_id", user.id)
          .eq("profile_id", profile.id)
          .not("published_at", "is", null)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const representative = representativeRows?.[0];
  const name = profile?.display_name || "회원";
  const headline = representative?.content.headline ?? profile?.headline ?? "";
  const published = !!publishedVersion?.published_at;
  const availabilityError = !!publishedError || !!representativeError;
  const data: MyDashboardData = {
    name,
    headline,
    photoUrl: getProfilePhotoUrl(profile?.profile_image_path ?? null),
    profileId: profile?.id ?? null,
    canShare: !!canShare && !availabilityError,
    published,
    availabilityError,
    versions: (versionsResult.error ? [] : (versionsResult.data ?? [])).map(
      (version) => ({
        id: version.id,
        title: version.title,
        representative: version.is_representative,
        updatedAt: version.updated_at,
      }),
    ),
    versionCount: versionsResult.error ? null : versionsResult.count,
    activities: (activitiesResult.error
      ? []
      : (activitiesResult.data ?? [])
    ).map((activity) => ({
      id: activity.id,
      title: activity.title || "활동 기록",
      updatedAt: activity.updated_at,
      category:
        CATEGORIES.find((category) => category.id === activity.category)?.name ||
        "기타 활동",
    })),
    activityCount: activitiesResult.error ? null : activitiesResult.count,
    fileCount: filesResult.error ? null : filesResult.count,
    pendingCount: pendingResult.error ? null : pendingResult.count,
    reviews: (reviewsResult.error ? [] : (reviewsResult.data ?? [])).map(
      (review) => ({
        id: review.id,
        title: review.title,
        status: review.status,
        versionId: review.version_id,
      }),
    ),
    activityError: !!activitiesResult.error,
    reviewError: !!reviewsResult.error,
  };
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <AccountSidebar compact />
      <main className="min-w-0 flex-1 px-0 py-6 md:px-5 lg:py-8">
        {profile?.suspended_at && (
          <SuspensionBanner
            suspendedAt={profile.suspended_at}
            suspensionReason={profile.suspension_reason}
          />
        )}
        {profile?.deletion_requested_at && (
          <DeletionBanner deletionRequestedAt={profile.deletion_requested_at} />
        )}
        <MyDashboard
          data={data}
          visibility={
            profile ? (
              <ProfileVisibilityToggle initialVisible={profile.owner_visible} />
            ) : null
          }
          sharing={
            <ProfileSharingTools
              compact
              profileId={canShare ? profile!.id : null}
              published={published}
              availabilityError={availabilityError}
              displayName={
                representative?.expert.display_name ??
                profile?.display_name ??
                ""
              }
              headline={headline}
            />
          }
        />
      </main>
    </div>
  );
}
