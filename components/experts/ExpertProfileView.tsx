import Image from "next/image";
import { formatActivityPeriod } from "@/lib/activity-period";
import { ProfileSectionCard as SectionCard } from "./ProfileSectionCard";
import {
  ProfileOrderLayout,
  type ProfileOrder,
} from "@/components/ProfileOrderLayout";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo-url";
import { getGalleryImageUrl } from "@/lib/storage/gallery-image-url";
import { GalleryFullScroll } from "@/components/GalleryFullScroll";
import { ProfileDetailImages } from "@/components/ProfileDetailImages";
import type { DetailImage } from "@/lib/profile-versions/detail-images";
import styles from "./ExpertProfileView.module.css";
import { profileItemKey } from "@/lib/profile-versions/types";
import {
  ProfileEvidencePublic,
  ProfileVerificationMark,
  type PublicItemReview,
} from "@/components/ProfileEvidencePublic";
import {
  YoutubeIcon,
  InstagramIcon,
  ThreadsIcon,
  KakaoIcon,
  BlogIcon,
} from "@/components/icons/SocialIcons";

const ACADEMIC_LEVEL_LABELS: Record<string, string> = {
  graduate: "대학원",
  university: "대학교",
  high_school: "고등학교",
  middle_school: "중학교",
};

type GalleryImage = {
  id: string;
  imagePath: string;
  caption: string;
};

export type ExpertProfileViewProps = {
  expert: {
    id: string;
    display_name: string | null;
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
  galleryImages: GalleryImage[];
  detailImages?: DetailImage[];
  order?: ProfileOrder;
  onOrderChange?: (order: ProfileOrder) => void;
  activitySections?: React.ReactNode;
  profileActions?: React.ReactNode;
  stickySummary?: boolean;
  itemReviews?: ReadonlyMap<string, PublicItemReview>;
  verifiedCareerCount?: number | null;
  renderItemActions?: (
    section:
      | "experiences"
      | "academic_records"
      | "educations"
      | "licenses"
      | "specialties"
      | "introduction"
      | "workplace",
    index: number,
  ) => React.ReactNode;
};

// 고정 5종 브랜드가 없는 자유 라벨 링크용 일반 체인링크 아이콘.
function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-3.5 h-3.5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"
      />
    </svg>
  );
}

export function ExpertProfileView({
  expert,
  galleryImages,
  detailImages = [],
  renderItemActions,
  order,
  onOrderChange,
  activitySections,
  profileActions,
  stickySummary = false,
  itemReviews,
  verifiedCareerCount,
}: ExpertProfileViewProps) {
  const coverImageUrl = getProfilePhotoUrl(expert.cover_image_path);
  const certifiedCount =
    verifiedCareerCount !== undefined
      ? verifiedCareerCount
      : (itemReviews?.size ?? null);

  // 값이 있는 소셜 링크만 렌더링, 전부 비어 있으면 로고 줄 자체를 숨긴다.
  const socialLinks = [
    { label: "유튜브", Icon: YoutubeIcon, url: expert.youtube_url },
    { label: "인스타그램", Icon: InstagramIcon, url: expert.instagram_url },
    { label: "블로그", Icon: BlogIcon, url: expert.blog_url },
    { label: "스레드", Icon: ThreadsIcon, url: expert.threads_url },
    { label: "카카오톡", Icon: KakaoIcon, url: expert.kakao_url },
  ].filter(
    (l): l is { label: string; Icon: typeof YoutubeIcon; url: string } =>
      !!l.url,
  );

  // 정렬: ① 현재 재직중(is_current)이 항상 최상단 → ② 그 다음 시작일 내림차순
  // (최근이 위). 프로필 소유자가 "경력 기간 비공개"를 켜면 뷰가 모든 경력의
  // start_date/end_date를 NULL로 내려주므로(is_current는 유지) start_date만
  // 보고 정렬하면 무력화된다 -- is_current를 1순위 기준으로 둬야 이 경우에도
  // 현재 직장이 위로 온다. start_date가 없는 항목은 그룹 내에서 뒤로 보낸다.
  const sortedExperiences = [...expert.experiences].sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  return (
    <div>
      {coverImageUrl && (
        <div
          aria-label="프로필 커버"
          className="relative mb-3 aspect-[4/1] overflow-hidden rounded-2xl border border-blue-100 bg-slate-50 sm:mb-4"
        >
          <Image
            src={coverImageUrl}
            alt={`${expert.display_name ?? "전문가"}의 커버 이미지`}
            fill
            priority
            sizes="(min-width: 1024px) 896px, 100vw"
            className="object-cover object-center"
          />
        </div>
      )}

      <div>
        <div
          className={stickySummary ? styles.stickySummary : undefined}
          data-profile-summary
        >
          <div
            className={`${styles.identity} relative isolate min-h-[180px] overflow-hidden rounded-3xl border border-blue-100 bg-white p-5 sm:px-8 sm:py-6`}
          >
            <svg
              aria-hidden
              viewBox="0 0 900 320"
              preserveAspectRatio="xMaxYMid slice"
              fill="none"
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
            >
              <path
                d="M0 310C200 300 380 220 520 170S760 50 900 30"
                stroke="var(--color-primary)"
                strokeOpacity="0.1"
                strokeWidth="2"
              />
              <path
                d="M0 340C240 335 430 260 600 210S800 100 900 90"
                stroke="var(--color-motion)"
                strokeOpacity="0.35"
                strokeWidth="1.5"
              />
              <circle
                cx="600"
                cy="210"
                r="5"
                fill="white"
                stroke="var(--color-motion)"
                strokeOpacity="0.5"
                strokeWidth="2"
              />
            </svg>
            <div className="relative flex items-start gap-4 sm:items-center sm:gap-6">
              <div
                className={`${styles.photo} flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-blue-50 text-motion sm:size-32`}
              >
                {expert.profile_image_path ? (
                  <Image
                    src={getProfilePhotoUrl(expert.profile_image_path) ?? ""}
                    alt={expert.display_name ?? "전문가"}
                    width={128}
                    height={128}
                    priority
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg
                    aria-hidden
                    width="44"
                    height="44"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  >
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                  </svg>
                )}
              </div>
              <div className={`min-w-0 flex-1 ${profileActions ? "sm:pr-28" : ""}`}>
                <h1
                  className={`${styles.name} text-hero font-extrabold tracking-tight text-slate-900 sm:text-4xl`}
                >
                  {expert.display_name ?? "이름 미공개"}
                </h1>
                {expert.professions.length > 0 && (
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {expert.professions.map((p) => p.name).join(" · ")}
                  </p>
                )}
                {expert.headline && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                    {expert.headline}
                  </p>
                )}
              </div>
            </div>
            {profileActions && (
              <div className="relative z-10 mt-3 flex justify-end sm:absolute sm:bottom-4 sm:right-4 sm:mt-0">
                {profileActions}
              </div>
            )}
          </div>

          {(expert.total_experience_years != null ||
            certifiedCount !== null ||
            expert.workplace_region) && (
            <dl
              aria-label="프로필 요약"
              className={`${styles.summaryCounts} mt-3 grid min-h-20 grid-cols-3 overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/40`}
            >
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 py-4">
                <dt className="text-xs font-medium text-slate-500">경력</dt>
                <dd className="text-base font-bold tracking-tight text-primary sm:text-lg">
                  {expert.total_experience_years != null
                    ? `${expert.total_experience_years}년`
                    : "-"}
                </dd>
              </div>
              <div
                title="현재 공개 중인 항목 중 관리자 점검을 통과한 내역 수"
                className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 border-l border-blue-100 px-2 py-4"
              >
                <dt className="text-xs font-medium text-slate-500">
                  인증 경력
                </dt>
                <dd className="text-base font-bold tracking-tight text-primary sm:text-lg">
                  {certifiedCount === null
                    ? "확인 필요"
                    : `${certifiedCount}건`}
                </dd>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 border-l border-blue-100 px-2 py-4">
                <dt className="text-xs font-medium text-slate-500">지역</dt>
                <dd className="min-w-0 break-words text-base font-bold tracking-tight text-primary sm:text-lg">
                  {expert.workplace_region ?? "미등록"}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {socialLinks.length > 0 && (
          <div className="relative mt-4 flex flex-wrap items-center gap-3">
            {socialLinks.map(({ label, Icon, url }) => (
              <a
                key={label}
                data-profile-contact
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-xl border border-slate-100 bg-white transition-colors hover:border-blue-200 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <Icon />
              </a>
            ))}
          </div>
        )}

        {expert.extra_links.length > 0 && (
          <div className="relative mt-3 flex flex-wrap gap-2">
            {expert.extra_links.map((link, i) => (
              <a
                key={`${link.label}-${i}`}
                data-profile-contact
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:text-primary focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <LinkIcon />
                {link.label}
              </a>
            ))}
          </div>
        )}
        {(expert.workplace_external_contact_url || expert.workplace_phone) && (
          <div className="mt-3 flex gap-3">
            {expert.workplace_external_contact_url && (
              <a
                data-profile-contact
                href={expert.workplace_external_contact_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                상담 문의
              </a>
            )}
            {expert.workplace_phone && (
              <a
                data-profile-contact
                href={`tel:${expert.workplace_phone}`}
                className="flex min-h-14 flex-1 items-center justify-center rounded-xl border border-blue-100 bg-white px-4 text-center text-sm font-semibold text-primary transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                전화 걸기
              </a>
            )}
          </div>
        )}

        <ProfileOrderLayout
          className={styles.document}
          order={order}
          onChange={onOrderChange}
          combineSimilarSections
        >
          {expert.specialties.length > 0 && (
            <SectionCard data-order-key="specialties" title="전문 분야">
              <div className="flex flex-wrap gap-2">
                {expert.specialties.map((s) => (
                  <span
                    key={s.slug}
                    data-order-key={s.slug}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {expert.introduction && (
            <SectionCard data-order-key="introduction" title="소개">
              {renderItemActions?.("introduction", 0)}
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 sm:text-base">
                {expert.introduction}
                <ProfileEvidencePublic
                  review={itemReviews?.get("introduction:0")}
                />
              </p>
            </SectionCard>
          )}

          {sortedExperiences.length > 0 && (
            <SectionCard data-order-key="experiences" title="경력">
              <ul className="divide-y divide-slate-100">
                {sortedExperiences.map((e, i) => (
                  <li
                    key={i}
                    data-order-key={JSON.stringify(e)}
                    className="py-2 first:pt-0 last:pb-0"
                  >
                    {renderItemActions?.(
                      "experiences",
                      expert.experiences.indexOf(e),
                    )}
                    <div className="text-base font-semibold text-slate-900">
                      {e.organization_name}
                      <ProfileEvidencePublic
                        review={itemReviews?.get(
                          profileItemKey("experiences", e),
                        )}
                      />
                      {/* (전)/(현)은 is_current 기준 -- 항목별 기간 비공개로 날짜가
                          NULL이어도 그대로 표시한다(PR #54/#57과 동일 근거). */}
                      <span
                        className={`ml-1.5 inline-block text-micro font-bold px-1.5 py-0.5 rounded ${
                          e.is_current
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        {e.is_current ? "현" : "전"}
                      </span>
                    </div>
                    {(e.position || e.start_date) && (
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-slate-500">
                        {e.position && <span>{e.position}</span>}
                        {e.start_date && (
                          <span className="text-xs">
                            {formatActivityPeriod(
                              [e.start_date, e.is_current ? "현재" : e.end_date]
                                .filter(Boolean)
                                .join(" ~ "),
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {expert.academic_records.length > 0 && (
            <SectionCard data-order-key="academic_records" title="학력">
              <ul className="divide-y divide-gray-100">
                {expert.academic_records.map((a, i) => (
                  <li
                    key={i}
                    data-order-key={JSON.stringify(a)}
                    className="py-2 first:pt-0 last:pb-0"
                  >
                    {renderItemActions?.("academic_records", i)}
                    <div className="text-base font-semibold text-slate-900">
                      {a.school_name}
                      {a.major ? ` · ${a.major}` : ""}
                      <ProfileEvidencePublic
                        review={itemReviews?.get(
                          profileItemKey("academic_records", a),
                        )}
                      />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-slate-500">
                      <span>
                        {ACADEMIC_LEVEL_LABELS[a.level] ?? a.level}
                        {a.degree ? `(${a.degree})` : ""}
                      </span>
                      {(a.start_date || a.end_date) && (
                        <span className="text-xs">
                          {formatActivityPeriod(
                            [a.start_date, a.end_date]
                              .filter(Boolean)
                              .join(" ~ "),
                          )}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {expert.educations.length > 0 && (
            <SectionCard data-order-key="educations" title="교육 이수">
              <ul className="divide-y divide-gray-100">
                {expert.educations.map((e, i) => (
                  <li
                    key={i}
                    data-order-key={JSON.stringify(e)}
                    className="py-2 first:pt-0 last:pb-0"
                  >
                    {renderItemActions?.("educations", i)}
                    <div className="text-base font-semibold text-slate-900">
                      {e.education_name}
                      <ProfileEvidencePublic
                        review={itemReviews?.get(
                          profileItemKey("educations", e),
                        )}
                      />
                    </div>
                    {e.organization_name && (
                      <div className="mt-0.5 text-sm text-slate-500">
                        {e.organization_name}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {expert.licenses.length > 0 && (
            <SectionCard data-order-key="licenses" title="자격/면허">
              <ul className="divide-y divide-gray-100">
                {expert.licenses.map((l, i) => (
                  <li
                    key={i}
                    data-order-key={l.id || JSON.stringify(l)}
                    className="flex items-start gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex max-w-full items-center gap-1.5 text-base font-semibold text-slate-900">
                        <span className="min-w-0 break-words">
                          {l.license_name}
                        </span>
                        {itemReviews?.has(profileItemKey("licenses", l)) ? (
                          <ProfileEvidencePublic
                            review={itemReviews.get(
                              profileItemKey("licenses", l),
                            )}
                          />
                        ) : (
                          <ProfileVerificationMark />
                        )}
                      </div>
                      {l.issuing_organization && (
                        <div className="mt-0.5 break-words text-sm text-slate-500">
                          {l.issuing_organization}
                        </div>
                      )}
                      {l.document_public && l.id && (
                        <a
                          href={`/api/license-document/${l.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-blue-600 hover:underline"
                        >
                          증빙파일 보기 ↗
                        </a>
                      )}
                    </div>
                    {renderItemActions && (
                      <span className="w-11 shrink-0">
                        {renderItemActions("licenses", i)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {galleryImages.length > 0 && (
            <GalleryCard data-order-key="gallery" images={galleryImages} />
          )}

          {(expert.workplace_address ||
            expert.workplace_phone ||
            expert.workplace_external_contact_url ||
            expert.workplace_website_url) && (
            <SectionCard data-order-key="workplace" title="근무 기관">
              {renderItemActions?.("workplace", 0)}
              {expert.workplace_center_name && (
                <div className="text-base font-semibold text-slate-900">
                  {expert.workplace_center_name}
                  <ProfileEvidencePublic
                    review={itemReviews?.get("workplace:0")}
                  />
                </div>
              )}
              {expert.workplace_address && (
                <p className="text-xs text-gray-500 mt-1">
                  {expert.workplace_address}
                  {expert.workplace_address_detail
                    ? ` ${expert.workplace_address_detail}`
                    : ""}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                {expert.workplace_phone && (
                  <a
                    data-profile-contact
                    href={`tel:${expert.workplace_phone}`}
                    className="flex min-h-tap flex-1 items-center justify-center rounded-xl bg-blue-50 px-3 py-2.5 text-center text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    📞 전화
                  </a>
                )}
                {expert.workplace_external_contact_url && (
                  <a
                    data-profile-contact
                    href={expert.workplace_external_contact_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-tap flex-1 items-center justify-center rounded-xl bg-blue-50 px-3 py-2.5 text-center text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    ✉ 문의
                  </a>
                )}
                {expert.workplace_website_url && (
                  <a
                    href={expert.workplace_website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-tap flex-1 items-center justify-center rounded-xl bg-blue-50 px-3 py-2.5 text-center text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    🌐 웹사이트
                  </a>
                )}
              </div>
            </SectionCard>
          )}
          {activitySections}
        </ProfileOrderLayout>
        {detailImages.length > 0 && (
          <div className="mt-3 sm:mt-4">
            <ProfileDetailImages images={detailImages} />
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryCard({ images }: { images: GalleryImage[] }) {
  const preview = images.slice(0, 6);

  return (
    <SectionCard
      data-order-key="gallery"
      title="활동 갤러리"
      action={
        <a href="#gallery-full" className="text-xs font-semibold text-blue-600">
          전체 보기
        </a>
      }
    >
      <div className="grid grid-cols-3 gap-1.5">
        {preview.map((img) => (
          <div
            key={img.id}
            className="aspect-square rounded-lg overflow-hidden bg-gray-100"
          >
            <Image
              src={getGalleryImageUrl(img.imagePath) ?? ""}
              alt={img.caption || ""}
              width={200}
              height={200}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      <div
        id="gallery-full"
        className="mt-4 pt-4 border-t border-gray-100 scroll-mt-32"
      >
        <GalleryFullScroll images={images} />
      </div>
    </SectionCard>
  );
}
