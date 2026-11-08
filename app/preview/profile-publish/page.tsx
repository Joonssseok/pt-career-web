import { notFound } from "next/navigation";
import { ProfileVersionManager } from "@/app/my/profiles/ProfileVersionManager";
import type { ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
import type { Activity } from "@/lib/damoa/categories";
import {
  activityForProfile,
  type ProfileVersion,
} from "@/lib/profile-versions/types";
import type { EvidenceReview } from "@/lib/profile-versions/evidence";

export default function ProfilePublishPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const samples = [
    ["academic", "학력", "스포츠건강학 학사", "피티대학교", "2022년 ~ 2026년"],
    [
      "education",
      "교육·연수",
      "움직임 지도 기초 과정",
      "피티 교육원",
      "2026년 8월",
    ],
    ["education", "교육·연수", "응급처치 교육", "안전 교육센터", "2026년 7월"],
    [
      "volunteer",
      "봉사활동",
      "지역 운동 프로그램 보조",
      "지역 복지관",
      "2026년 3월 ~ 2026년 6월",
    ],
    ["project", "프로젝트", "대학 운동 동아리 운영", "피티대학교", "2026년"],
  ];
  const sources: Activity[] = samples.map(
    ([category, , title, organizer, period], i) => ({
      id: `activity-${i}`,
      owner: "preview-owner",
      category,
      title,
      period,
      description:
        "작은 경험을 차곡차곡 모아 나의 전문성을 만들어가고 있습니다.",
      learning: "",
      link: "",
      memo: "",
      details: { 주관: organizer },
      updated: "2026-11-08",
      files:
        i === 4
          ? []
          : [
              {
                id: `file-${i}`,
                name: `${title} 확인자료.png`,
                type: "image/png",
                size: 240000,
                path: `preview/file-${i}`,
              },
            ],
    }),
  );
  const activities = sources.map((row, i) =>
    activityForProfile(row, samples[i][1]),
  );
  const content = {
    headline: "배움과 경험을 모아, 건강한 움직임을 함께 만들어요.",
    introduction: "운동 지도자를 준비하며 쌓아온 학습과 활동을 소개합니다.",
    sections: [],
    activities,
    order: {
      sections: [
        "introduction",
        "activity:학력",
        "activity:교육·연수",
        "activity:봉사활동",
        "activity:프로젝트",
      ],
    },
  };
  const version: ProfileVersion = {
    id: "preview-version",
    title: "운동 지도 프로필",
    draft_content: content,
    published_content: null,
    is_representative: false,
    updated_at: "2026-11-08",
    published_at: null,
  };
  const expert: ExpertProfileViewProps["expert"] = {
    id: "preview-person",
    display_name: "김서연",
    headline: content.headline,
    introduction: content.introduction,
    professions: [{ slug: "trainer", name: "운동 지도자", is_primary: true }],
    specialties: [
      { slug: "fitness", name: "체력 향상", is_primary: true },
      { slug: "posture", name: "자세·움직임", is_primary: false },
    ],
    total_experience_years: 0,
    profile_image_path: null,
    cover_image_path: null,
    youtube_url: null,
    instagram_url: null,
    blog_url: null,
    threads_url: null,
    kakao_url: null,
    workplace_region: null,
    workplace_center_name: null,
    workplace_address: null,
    workplace_address_detail: null,
    workplace_phone: null,
    workplace_external_contact_url: null,
    workplace_website_url: null,
    academic_records: [],
    experiences: [],
    educations: [],
    licenses: [],
    extra_links: [],
  };
  const rows: EvidenceReview[] = [2, 3].map((i) => ({
    id: `review-${i}`,
    version_id: version.id,
    item_key: `damoa:activity-${i}`,
    item_snapshot: { ...activities[i] },
    title: activities[i].title,
    file_ids: [`file-${i}`],
    public_file_ids: [],
    status: i === 2 ? "verified" : "pending",
    reason: "",
    updated_at: "2026-11-08T00:00:00Z",
  }));
  return (
    <main className="mx-auto max-w-6xl px-8 py-8 sm:px-12">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-5">
        <div>
          <p className="text-xs font-semibold tracking-wider text-primary">
            PROFILE PREVIEW
          </p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">
            공개 전, 한 번만 확인하세요.
          </h1>
        </div>
        <p className="max-w-md rounded-lg bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
          예시 자료로 보는 미리보기입니다. 게시 버튼을 눌러도 실제 프로필 공개나
          심사 접수는 이루어지지 않습니다.
        </p>
      </div>
      <ProfileVersionManager
        owner="preview-owner"
        versions={[version]}
        selectedId={version.id}
        base={{
          id: expert.id,
          display_name: expert.display_name,
          headline: content.headline,
          introduction: content.introduction,
          verification_status: "approved",
          is_public: true,
          suspended_at: null,
          deletion_requested_at: null,
        }}
        expert={expert}
        previewData={{
          sources,
          licenses: [],
          evidence: {
            rows,
            files: Object.fromEntries(
              sources.flatMap((row) =>
                row.files.map((file) => [
                  file.id,
                  { ...file, href: "/preview/proof-sample.png" },
                ]),
              ),
            ),
          },
        }}
      />
    </main>
  );
}
