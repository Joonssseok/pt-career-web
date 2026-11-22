import { ExternalLinkButtons } from "@/components/profile-editor/ExternalLinksPreview";
import { DetailContent } from "@/components/profile-editor/DetailContent";
import { validateDetailDocument } from "@/lib/profile-versions/detail-document";
import { IntroductionContent } from "@/components/profile-editor/IntroductionContent";
import { validateIntroductionDocument } from "@/lib/profile-versions/introduction-format";
import { Gowun_Dodum } from "next/font/google";
import { ProfileTemplate } from "./ProfileTemplate";
import { ProfileContentChapter } from "./ProfileContentChapter";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import { WorkplaceMap } from "./WorkplaceMap";
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
  ProfileEvidenceGallery,
  type PublicItemReview,
} from "@/components/ProfileEvidencePublic";

const displayFont = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--profile-gowun",
});

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
    introduction_document?: unknown;
    detail_document?: unknown;
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
    extra_links: {
      label: string;
      url: string;
      kind?: string;
      is_primary?: boolean;
    }[];
  };
  galleryImages: GalleryImage[];
  detailImages?: DetailImage[];
  order?: ProfileOrder;
  onOrderChange?: (order: ProfileOrder) => void;
  activitySections?: React.ReactNode;
  activityReviewCounts?: { label: string; count: number; titles?: string[] }[];
  profileActions?: React.ReactNode;
  stickySummary?: boolean;
  ownerPreview?: boolean;
  videoLibrary?: React.ReactNode;
  homeVideoLibrary?: React.ReactNode;
  postBoard?: React.ReactNode;
  homePostBoard?: React.ReactNode;
  workplaceMapAutoLoad?: boolean;
  itemReviews?: ReadonlyMap<string, PublicItemReview>;
  activityEvidenceTitles?: Record<string, string>;
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

export function ExpertProfileView({
  expert,
  galleryImages,
  detailImages = [],
  renderItemActions,
  order,
  onOrderChange,
  activitySections,
  activityReviewCounts = [],
  profileActions,
  ownerPreview = false,
  videoLibrary,
  homeVideoLibrary,
  postBoard,
  homePostBoard,
  workplaceMapAutoLoad = false,
  itemReviews,
  activityEvidenceTitles = {},
  verifiedCareerCount,
}: ExpertProfileViewProps) {
  const certifiedCount =
    verifiedCareerCount !== undefined
      ? verifiedCareerCount
      : (itemReviews?.size ?? null);

  // 값이 있는 소셜 링크만 렌더링, 전부 비어 있으면 로고 줄 자체를 숨긴다.
  const socialLinks = [
    { label: "유튜브", kind: "youtube", url: expert.youtube_url },
    { label: "인스타그램", kind: "instagram", url: expert.instagram_url },
    { label: "블로그", kind: "blog", url: expert.blog_url },
    { label: "스레드", kind: "threads", url: expert.threads_url },
    { label: "카카오톡", kind: "kakao", url: expert.kakao_url },
  ].filter((l): l is { label: string; kind: string; url: string } => !!l.url);

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

  const groupCount = (section: string, rows: readonly object[]) => {
    const verified = rows.filter((row) =>
      itemReviews?.has(profileItemKey(section, row)),
    ).length;
    return { total: rows.length, verified };
  };
  const evidenceTitles = new Map(Object.entries(activityEvidenceTitles));
  for (const row of expert.experiences)
    evidenceTitles.set(
      profileItemKey("experiences", row),
      row.organization_name,
    );
  for (const row of expert.academic_records)
    evidenceTitles.set(
      profileItemKey("academic_records", row),
      [row.school_name, row.major].filter(Boolean).join(" · "),
    );
  for (const row of expert.educations)
    evidenceTitles.set(profileItemKey("educations", row), row.education_name);
  for (const row of expert.licenses)
    evidenceTitles.set(profileItemKey("licenses", row), row.license_name);
  const publicEvidenceGroups = [...evidenceTitles].flatMap(([key, title]) => {
    const review = itemReviews?.get(key);
    return review?.files.length ? [{ title, review }] : [];
  });
  const highlightGroups = new Map<string, string[]>([
    ["자격·면허", expert.licenses.map((row) => row.license_name)],
    ["교육·연수", expert.educations.map((row) => row.education_name)],
    [
      "학력",
      expert.academic_records.map((row) =>
        [row.school_name, row.major].filter(Boolean).join(" · "),
      ),
    ],
  ]);
  for (const { label, titles = [] } of activityReviewCounts) {
    const category = /자격|면허/.test(label)
      ? "자격·면허"
      : /교육|연수/.test(label)
        ? "교육·연수"
        : label;
    highlightGroups.set(category, [
      ...(highlightGroups.get(category) ?? []),
      ...titles,
    ]);
  }
  highlightGroups.set("경력", [
    ...(highlightGroups.get("경력") ?? []),
    ...sortedExperiences.map((row) => row.organization_name),
  ]);
  const highlights = Array.from(highlightGroups, ([label, titles]) => ({
    label,
    titles,
  }))
    .filter((group) => group.titles.length > 0)
    .slice(0, 3);
  const formattedIntroduction = validateIntroductionDocument(
    expert.introduction_document,
  );
  const showFormattedIntroduction =
    formattedIntroduction.ok &&
    formattedIntroduction.text === expert.introduction;
  const introductionLines = expert.introduction?.split(/\r?\n/) ?? [];
  const careerCount =
    expert.experiences.length +
    expert.academic_records.length +
    expert.educations.length +
    expert.licenses.length;
  const identity = (
    <div key="identity" className={styles.person}>
      <div className={styles.personHead}>
        <div className={styles.photo}>
          {getProfilePhotoUrl(expert.profile_image_path) ? (
            <Image
              src={getProfilePhotoUrl(expert.profile_image_path)!}
              alt={`${expert.display_name ?? "전문가"}의 프로필 사진`}
              width={112}
              height={112}
              priority
              className="h-full w-full object-cover"
            />
          ) : (
            <svg
              aria-hidden="true"
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
        <div>
          <h1 className={styles.name}>
            {expert.display_name ?? "이름 미공개"}
          </h1>
          {expert.professions.length > 0 && (
            <p className={styles.role}>
              {expert.professions.map((p) => p.name).join(" · ")}
            </p>
          )}
        </div>
      </div>
      {expert.headline && <p className={styles.headline}>{expert.headline}</p>}
      <dl aria-label="프로필 요약" className={styles.facts}>
        <dt>지역</dt>
        <dd>{expert.workplace_region ?? "미등록"}</dd>
        <dt>경력</dt>
        <dd>
          {expert.total_experience_years != null
            ? `${expert.total_experience_years}년`
            : "-"}
        </dd>
        <dt>인증 경력</dt>
        <dd>{certifiedCount === null ? "확인 필요" : `${certifiedCount}건`}</dd>
      </dl>
      <ExternalLinkButtons links={[...socialLinks, ...expert.extra_links]} />
      {expert.specialties.length > 0 && (
        <div className={styles.specialties} aria-label="전문 분야">
          {expert.specialties.map((s) => (
            <span key={s.slug}>{s.name}</span>
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

      <div className={styles.actions}>
        {profileActions ?? (
          <ComingSoonButton className={styles.favorite}>
            프로필 즐겨찾기
          </ComingSoonButton>
        )}
      </div>
    </div>
  );
  const checkedDetail = validateDetailDocument(expert.detail_document);
  const detailNodes = checkedDetail.ok ? checkedDetail.document.content : [];
  const videoNodes = detailNodes.filter(
    (node) =>
      node.type === "youtubeVideo" ||
      (node.type === "profileMedia" &&
        String(node.attrs?.mime).startsWith("video/")),
  );
  const homeVideoDocument = { type: "doc", content: videoNodes };
  const hasHomeVideo =
    !!expert.youtube_url ||
    videoNodes.some(
      (node) =>
        node.type === "youtubeVideo" ||
        detailImages.some((image) => image.id === node.attrs?.fileId),
    );
  const chapterOwner = ownerPreview || !!renderItemActions;
  const videoChapterContent = hasHomeVideo ? (
    <>
      {videoNodes.length > 0 && (
        <DetailContent document={homeVideoDocument} images={detailImages} />
      )}
      {expert.youtube_url && (
        <a
          href={expert.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.channel}
        >
          유튜브 채널 보기 ↗
        </a>
      )}
    </>
  ) : undefined;
  const home = (
    <div key="home" className={styles.home}>
      {expert.introduction && (
        <section
          data-home-section="introduction"
          data-profile-search-item
          data-profile-search-title="소개"
          className={
            showFormattedIntroduction
              ? styles.formattedIntroduction
              : styles.introduction
          }
        >
          {showFormattedIntroduction ? (
            <IntroductionContent
              document={expert.introduction_document}
              fallback={expert.introduction}
            />
          ) : (
            <>
              <h2>
                <span>{introductionLines[0]}</span>
              </h2>
              {introductionLines.length > 1 && (
                <p>{introductionLines.slice(1).join("\n")}</p>
              )}
            </>
          )}
          <ProfileEvidencePublic review={itemReviews?.get("introduction:0")} />
        </section>
      )}
      {highlights.length > 0 && (
        <section data-home-section="career" className={styles.homeSection}>
          <h2>주요 이력</h2>
          <div className={styles.careerHighlights}>
            {highlights.map(({ label, titles }) => (
              <a
                key={label}
                href="?tab=career"
                data-profile-career-link
                className={styles.highlightCard}
                aria-label={`${label} 이력으로 이동`}
              >
                <h3>{label}</h3>
                <ul>
                  {titles.slice(0, 3).map((title, index) => (
                    <li key={index}>{title}</li>
                  ))}
                </ul>
              </a>
            ))}
          </div>
          <ProfileEvidenceGallery groups={publicEvidenceGroups} />
        </section>
      )}
      <ProfileContentChapter kind="board" home>
        {homePostBoard}
      </ProfileContentChapter>
      <ProfileContentChapter kind="video" home ownerPreview={chapterOwner}>
        {(videoChapterContent || homeVideoLibrary) && (
          <>
            {videoChapterContent}
            {homeVideoLibrary}
          </>
        )}
      </ProfileContentChapter>
      {(sortedExperiences.some((e) => e.is_current) ||
        expert.workplace_center_name ||
        expert.workplace_address) && (
        <section data-home-section="workplace" className={styles.homeSection}>
          <h2>지금 일하는 곳</h2>
          {expert.workplace_center_name ? (
            <article
              data-profile-search-item
              data-profile-search-title={expert.workplace_center_name}
            >
              <strong>{expert.workplace_center_name}</strong>
              <ProfileEvidencePublic review={itemReviews?.get("workplace:0")} />
              {sortedExperiences.find(
                (e) => e.organization_name === expert.workplace_center_name,
              )?.position && (
                <p>
                  {
                    sortedExperiences.find(
                      (e) =>
                        e.organization_name === expert.workplace_center_name,
                    )?.position
                  }
                </p>
              )}
            </article>
          ) : (
            sortedExperiences
              .filter((e) => e.is_current)
              .map((e, i) => (
                <article
                  key={i}
                  data-profile-search-item
                  data-profile-search-title={e.organization_name}
                >
                  <strong>{e.organization_name}</strong>
                  <ProfileEvidencePublic
                    review={itemReviews?.get(profileItemKey("experiences", e))}
                  />
                  {e.position && <p>{e.position}</p>}
                </article>
              ))
          )}
          {expert.workplace_address && (
            <div className={styles.homeMap}>
              <WorkplaceMap
                address={expert.workplace_address}
                autoLoad={workplaceMapAutoLoad}
              />
              <p>
                {expert.workplace_address}
                {expert.workplace_address_detail
                  ? ` ${expert.workplace_address_detail}`
                  : ""}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
  const career = (
    <div key="career">
      <ProfileOrderLayout
        className={styles.document}
        order={order}
        onChange={onOrderChange}
        combineSimilarSections
      >
        {sortedExperiences.length > 0 && (
          <SectionCard
            data-order-key="experiences"
            title="경력"
            count={groupCount("experiences", expert.experiences)}
          >
            <ul>
              {sortedExperiences.map((e, i) => (
                <li
                  key={i}
                  data-profile-search-item
                  data-profile-search-title={e.organization_name}
                  data-order-key={JSON.stringify(e)}
                  className="py-2 first:pt-0 last:pb-0"
                >
                  {renderItemActions?.(
                    "experiences",
                    expert.experiences.indexOf(e),
                  )}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <div className="text-base font-semibold text-slate-900">
                      <ProfileEvidencePublic
                        title={e.organization_name}
                        review={itemReviews?.get(
                          profileItemKey("experiences", e),
                        )}
                      />
                      {/* (전)/(현)은 is_current 기준 -- 항목별 기간 비공개로 날짜가
                          NULL이어도 그대로 표시한다(PR #54/#57과 동일 근거). */}
                      <span
                        className={`ml-1.5 inline-block text-micro font-bold px-1.5 py-0.5 rounded ${
                          e.is_current
                            ? styles.currentBadge
                            : styles.previousBadge
                        }`}
                      >
                        {e.is_current ? "현 근무지" : "이전"}
                      </span>
                    </div>
                    {(e.position || e.start_date) && (
                      <div
                        className={`${styles.itemDetails} flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-slate-500`}
                      >
                        {e.position && <span>{e.position}</span>}
                        {e.start_date && (
                          <span className={styles.itemDate}>
                            {formatActivityPeriod(
                              [e.start_date, e.is_current ? "현재" : e.end_date]
                                .filter(Boolean)
                                .join(" ~ "),
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {expert.academic_records.length > 0 && (
          <SectionCard
            data-order-key="academic_records"
            title="학력"
            count={groupCount("academic_records", expert.academic_records)}
          >
            <ul>
              {expert.academic_records.map((a, i) => (
                <li
                  key={i}
                  data-profile-search-item
                  data-profile-search-title={a.school_name}
                  data-order-key={JSON.stringify(a)}
                  className="py-2 first:pt-0 last:pb-0"
                >
                  {renderItemActions?.("academic_records", i)}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <div className="text-base font-semibold text-slate-900">
                      <ProfileEvidencePublic
                        title={a.school_name + (a.major ? ` · ${a.major}` : "")}
                        review={itemReviews?.get(
                          profileItemKey("academic_records", a),
                        )}
                      />
                    </div>
                    <div
                      className={`${styles.itemDetails} flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-slate-500`}
                    >
                      <span>
                        {ACADEMIC_LEVEL_LABELS[a.level] ?? a.level}
                        {a.degree ? `(${a.degree})` : ""}
                      </span>
                      {(a.start_date || a.end_date) && (
                        <span className={styles.itemDate}>
                          {formatActivityPeriod(
                            [a.start_date, a.end_date]
                              .filter(Boolean)
                              .join(" ~ "),
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {expert.educations.length > 0 && (
          <SectionCard
            data-order-key="educations"
            title="교육 이수"
            count={groupCount("educations", expert.educations)}
          >
            <ul>
              {expert.educations.map((e, i) => (
                <li
                  key={i}
                  data-profile-search-item
                  data-profile-search-title={e.education_name}
                  data-order-key={JSON.stringify(e)}
                  className="py-2 first:pt-0 last:pb-0"
                >
                  {renderItemActions?.("educations", i)}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <div className="text-base font-semibold text-slate-900">
                      <ProfileEvidencePublic
                        title={e.education_name}
                        review={itemReviews?.get(
                          profileItemKey("educations", e),
                        )}
                      />
                    </div>
                    {e.organization_name && (
                      <div className={`${styles.itemDetails} text-slate-500`}>
                        {e.organization_name}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {expert.licenses.length > 0 && (
          <SectionCard
            data-order-key="licenses"
            title="자격/면허"
            count={groupCount("licenses", expert.licenses)}
          >
            <ul>
              {expert.licenses.map((l, i) => (
                <li
                  key={i}
                  data-profile-search-item
                  data-profile-search-title={l.license_name}
                  data-order-key={l.id || JSON.stringify(l)}
                  className="flex items-start gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <div className="inline-flex max-w-full items-center gap-1.5 text-base font-semibold text-slate-900">
                        {itemReviews?.has(profileItemKey("licenses", l)) ? (
                          <ProfileEvidencePublic
                            title={l.license_name}
                            review={itemReviews.get(
                              profileItemKey("licenses", l),
                            )}
                          />
                        ) : l.document_public && l.id ? (
                          <ProfileEvidencePublic
                            title={l.license_name}
                            licenseDocumentId={l.id}
                          />
                        ) : (
                          <>
                            <span className="min-w-0 break-words">
                              {l.license_name}
                            </span>
                            <ProfileVerificationMark />
                          </>
                        )}
                      </div>
                      {l.issuing_organization && (
                        <div
                          className={`${styles.itemDetails} break-words text-slate-500`}
                        >
                          {l.issuing_organization}
                        </div>
                      )}
                    </div>
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

        {activitySections}
      </ProfileOrderLayout>
      <p className={styles.legend}>
        <span aria-hidden="true">✓</span> 서류로 확인된 이력에 표시됩니다.
      </p>
    </div>
  );
  const detail = (
    <div key="detail" className={styles.detail}>
      {galleryImages.length > 0 && (
        <div data-profile-search-item data-profile-search-title="활동 갤러리">
          <GalleryCard images={galleryImages} />
        </div>
      )}
      {validateDetailDocument(expert.detail_document).ok ? (
        <div data-profile-search-item data-profile-search-title="상세소개">
          <DetailContent
            document={expert.detail_document}
            images={detailImages}
          />
        </div>
      ) : (
        detailImages.length > 0 && (
          <div data-profile-search-item data-profile-search-title="상세 이미지">
            <ProfileDetailImages images={detailImages} />
          </div>
        )
      )}
      {(expert.workplace_phone ||
        expert.workplace_external_contact_url ||
        expert.workplace_website_url) && (
        <section
          data-profile-search-item
          data-profile-search-title={
            expert.workplace_center_name || "근무 기관"
          }
          className={styles.workplace}
        >
          {renderItemActions?.("workplace", 0)}
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
        </section>
      )}
    </div>
  );
  return (
    <div
      className={`${displayFont.variable} ${styles.root}`}
      data-profile-template
      data-profile-editing={renderItemActions ? true : undefined}
    >
      <ProfileTemplate
        identity={identity}
        home={home}
        career={career}
        detail={detail}
        video={undefined}
        board={
          <ProfileContentChapter
            kind="board"
            ownerPreview={chapterOwner && !postBoard}
          >
            {postBoard}
          </ProfileContentChapter>
        }
        videoChapter={
          <ProfileContentChapter
            kind="video"
            ownerPreview={chapterOwner && !videoLibrary}
          >
            {(videoChapterContent || videoLibrary) && (
              <>
                {videoChapterContent}
                {videoLibrary}
              </>
            )}
          </ProfileContentChapter>
        }
        ownerPreview={ownerPreview || !!renderItemActions}
        careerCount={careerCount}
      />
    </div>
  );
}

function GalleryCard({
  images,
  fullId = "gallery-full",
}: {
  images: GalleryImage[];
  fullId?: string;
}) {
  const preview = images.slice(0, 6);

  return (
    <SectionCard
      data-order-key="gallery"
      title="활동 갤러리"
      action={
        <a href={`#${fullId}`} className="text-xs font-semibold text-blue-600">
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
        id={fullId}
        className="mt-4 pt-4 border-t border-gray-100 scroll-mt-32"
      >
        <GalleryFullScroll images={images} />
      </div>
    </SectionCard>
  );
}
