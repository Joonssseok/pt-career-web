import { LIVE_PROFILE_PUBLISH_ENABLED } from "@/lib/profile-versions/types";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUser,
  getCurrentProfile,
  getCurrentProfileVersions,
} from "@/lib/account/current-account";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo-url";
import { CATEGORIES } from "@/lib/damoa/categories";
import { ProfileSharingTools } from "@/components/ProfileSharingTools";
import { MyDashboard, type MyDashboardData } from "./MyDashboard";
import { DeletionBanner } from "./DeletionBanner";
import { SuspensionBanner } from "./SuspensionBanner";

export async function MyDashboardContent() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/my");

  const [
    profileResult,
    versionsResult,
    activitiesResult,
    filesResult,
    pendingResult,
    reviewsResult,
  ] = await Promise.all([
    getCurrentProfile(),
    getCurrentProfileVersions(),
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

  const versions = versionsResult.error ? [] : (versionsResult.data ?? []);
  const representative =
    canShare && LIVE_PROFILE_PUBLISH_ENABLED
      ? versions.find(
          (version) =>
            version.profile_id === profile?.id &&
            version.is_representative &&
            version.published_at,
        )
      : undefined;
  const name = profile?.display_name || "회원";
  const headline =
    representative?.published_headline ?? profile?.headline ?? "";
  const published = versions.some(
    (version) => version.profile_id === profile?.id && !!version.published_at,
  );
  const availabilityError = !!versionsResult.error;
  const data: MyDashboardData = {
    name,
    headline,
    photoUrl: getProfilePhotoUrl(profile?.profile_image_path ?? null),
    profileId: profile?.id ?? null,
    canShare: !!canShare && !availabilityError,
    published,
    availabilityError,
    versions: versions.slice(0, 3).map((version) => ({
      id: version.id,
      title: version.title,
      representative: version.is_representative,
      updatedAt: version.updated_at,
    })),
    versionCount: versionsResult.error ? null : versionsResult.count,
    activities: (activitiesResult.error
      ? []
      : (activitiesResult.data ?? [])
    ).map((activity) => ({
      id: activity.id,
      title: activity.title || "활동 기록",
      updatedAt: activity.updated_at,
      category:
        CATEGORIES.find((category) => category.id === activity.category)
          ?.name || "기타 활동",
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
    <>
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
        sharing={
          <ProfileSharingTools
            compact
            profileId={canShare ? profile!.id : null}
            published={published}
            availabilityError={availabilityError}
            displayName={
              representative?.published_display_name ??
              profile?.display_name ??
              ""
            }
            headline={headline}
          />
        }
      />
    </>
  );
}
