import { publicItemReviews } from "@/lib/profile-evidence/public-reviews";
import { publicReviewCount } from "@/lib/profile-evidence/public-review-count";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo-url";
import { ProfileHeaderActions } from "./ShareButton";
import {
  LIVE_PROFILE_PUBLISH_ENABLED,
  applyVersion,
  publicActivities,
  profileItemKey,
  type Representative,
} from "@/lib/profile-versions/types";
import { profileActivityCards } from "@/components/ProfileActivitySections";
import { ExpertProfileView } from "@/components/experts/ExpertProfileView";
import { detailImageSrc } from "@/lib/profile-versions/detail-images";
import { ProfileUnavailable } from "@/components/ProfileUnavailable";
import {
  getUnavailableProfileState,
  isProfileId,
} from "@/lib/profile-sharing/access";

export const dynamic = "force-dynamic";

type ExpertDetail = {
  representative?: Representative;
  id: string;
  display_name: string | null;
  // display_order 순(첫 번째 = 대표 직군). custom 슬롯은 name에 자유입력
  // 라벨이 이미 치환돼 내려온다(뷰의 CASE 처리).
  professions: { slug: string; name: string; is_primary: boolean }[];
  headline: string | null;
  introduction: string | null;
  total_experience_years: number | null;
  profile_image_path: string | null;
  cover_image_path: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  blog_url: string | null;
  threads_url: string | null;
  kakao_url: string | null;
  workplace_region: string | null;
  workplace_center_name: string | null;
  workplace_website_url: string | null;
  workplace_address: string | null;
  workplace_address_detail: string | null;
  workplace_phone: string | null;
  workplace_external_contact_url: string | null;
  workplace_latitude: number | null;
  workplace_longitude: number | null;
  specialties: { slug: string; name: string; is_primary: boolean }[];
  academic_records: {
    level: "graduate" | "university" | "high_school" | "middle_school";
    degree: string | null;
    school_name: string;
    major: string | null;
    start_date: string | null;
    end_date: string | null;
  }[];
  experiences: {
    organization_name: string;
    position: string | null;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    description: string | null;
  }[];
  educations: {
    education_name: string;
    organization_name: string | null;
    completion_date: string | null;
    description: string | null;
  }[];
  licenses: {
    id?: string;
    document_public?: boolean;
    license_name: string;
    issuing_organization: string | null;
    acquired_date: string | null;
  }[];
  extra_links: { label: string; url: string }[];
};

const fetchExpert = cache(async (id: string): Promise<ExpertDetail | null> => {
  if (!isProfileId(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_expert_detail")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error)
    throw new Error("프로필을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  if (!data) return null;

  const { data: licenses, error: licenseError } = await supabase.rpc(
    "get_public_license_details",
    { p_profile_id: id },
  );
  if (licenseError && licenseError.code !== "PGRST202")
    throw new Error("자격·면허를 불러오지 못했습니다.");
  if (!licenseError) data.licenses = licenses || [];
  if (!LIVE_PROFILE_PUBLISH_ENABLED) return data as ExpertDetail;
  const { data: versions, error: versionError } = await supabase.rpc(
    "get_representative_profiles",
    { p_profile_ids: [id] },
  );
  if (versionError) throw new Error("공개 프로필을 불러오지 못했습니다.");
  const representative = (versions as Representative[] | null)?.[0];
  return representative
    ? ({
        ...applyVersion(representative.expert, representative.content),
        representative,
      } as ExpertDetail)
    : (data as ExpertDetail);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const expert = await fetchExpert(id);

  if (!expert) {
    return { title: "프로필 안내", robots: { index: false, follow: false } };
  }

  const professionNames = expert.professions.map((p) => p.name).join(" · ");
  const title =
    [expert.display_name, professionNames].filter(Boolean).join(" · ") ||
    "PT Career 전문가";
  const description =
    expert.headline ??
    "경력과 자격으로 검증된 물리치료사, 트레이너, 재활 전문가를 찾아보세요.";
  const imageUrl = getProfilePhotoUrl(expert.profile_image_path);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
  };
}

export default async function ExpertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isProfileId(id)) notFound();
  const expert = await fetchExpert(id);

  if (!expert) {
    const state = await getUnavailableProfileState(id);
    if (!state) notFound();
    return <ProfileUnavailable state={state} />;
  }

  // public_expert_detail 뷰를 건드리지 않고 별도 쿼리로 가져온다(지시서 2-5) --
  // anon_select_public/authenticated_select_public RLS 정책이 이미 공개+승인
  // 프로필의 갤러리만 걸러주므로 추가 SECURITY DEFINER 함수는 필요 없다.
  const supabase = await createClient();
  const { data: galleryRows } = await supabase
    .from("profile_gallery_images")
    .select("id, image_path, caption")
    .eq("profile_id", id)
    .order("display_order");

  const galleryImages = (galleryRows ?? []).map((g) => ({
    id: g.id,
    imagePath: g.image_path,
    caption: g.caption ?? "",
  }));
  const detailResult = await supabase.rpc("public_profile_detail_images", {
    p_profile: id,
  });
  if (detailResult.error && detailResult.error.code !== "PGRST202")
    throw new Error("상세 이미지를 불러오지 못했습니다.");
  const detailImages = (detailResult.data ?? []).map(
    (row: { id: string; bytes: number }) => ({
      id: row.id,
      name: "",
      size: Number(row.bytes),
      src: detailImageSrc(row.id),
    }),
  );
  const activities = expert.representative
    ? publicActivities(expert.representative.content)
    : [];
  const visibleKeys = new Set([
    ...(expert.introduction ? ["introduction:0"] : []),
    ...(expert.workplace_center_name ? ["workplace:0"] : []),
    ...(
      ["experiences", "academic_records", "educations", "licenses"] as const
    ).flatMap((section) =>
      expert[section].map((row) => profileItemKey(section, row)),
    ),
    ...activities.map((row) => "damoa:" + row.id),
  ]);
  const [itemReviews, verifiedCareerCount] = await Promise.all([
    publicItemReviews(id, visibleKeys),
    publicReviewCount(supabase, id),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-white pb-10 pt-4 sm:pb-14 sm:pt-5">
      <div id="profile-details" className="scroll-mt-32">
        <ExpertProfileView
          stickySummary
          profileActions={
            <ProfileHeaderActions
              profileId={expert.id}
              displayName={expert.display_name}
              headline={expert.headline}
            />
          }
          detailImages={detailImages}
          expert={expert}
          itemReviews={itemReviews}
          verifiedCareerCount={verifiedCareerCount}
          order={expert.representative?.content.order}
          activitySections={
            expert.representative
              ? profileActivityCards({
                  activities,
                  itemReviews,
                })
              : null
          }
          galleryImages={
            expert.representative
              ? expert.representative.content.sections.includes("gallery")
                ? expert.representative.gallery
                : []
              : galleryImages
          }
        />
      </div>

    </main>
  );
}
