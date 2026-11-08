"use client";
import {
  loadEvidenceReviews,
  storeEvidenceFile,
  type EvidenceReview,
} from "@/lib/profile-versions/evidence";
import { profileReviewItems } from "@/lib/profile-versions/review-items";
import {
  reviewSubmissionPlan,
  type ReviewAttachment,
} from "@/lib/profile-versions/review-submission";
import { ProfileVisualReview } from "./ProfileVisualReview";
import { getOwnCertifications } from "@/app/actions/certification";
import { getEvidenceFileUrl } from "@/lib/storage/evidence-file-url";
import {
  type ReviewItem,
  type ReviewChoice,
  type ReviewFile,
} from "@/lib/profile-versions/review-preview";
import { ProfileTitleCard } from "@/components/ProfileTitleCard";
import {
  CommonProfileSaveContext,
  type CommonProfileSave,
} from "@/components/CommonProfileSaveContext";
import { useRef, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  saveProfileVersion,
  publishProfileVersion,
} from "@/app/actions/profile-versions";
import {
  activityForProfile,
  activityOrganizer,
  LIVE_PROFILE_PUBLISH_ENABLED,
  BASE_SECTIONS,
  applyVersion,
  sameProfileContent,
  type ProfileVersion,
  type VersionContent,
} from "@/lib/profile-versions/types";
import { editProfileItem } from "@/lib/profile-versions/item-edit";
import { PROFILE_PRESENTATION_STORAGE_ENABLED } from "@/lib/profile-versions/presentation";
import { type ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
import { loadActivities } from "@/lib/damoa/server-store";
import { CATEGORIES, type Activity } from "@/lib/damoa/categories";
import { ProfileDetailImageEditor } from "@/components/ProfileDetailImageEditor";
import {
  type EditableDetailImage,
  type DetailImagesState,
} from "@/lib/profile-versions/detail-images";
import { uploadDetailImage } from "@/lib/profile-versions/upload-detail-image";
import { getOwnProfileDetailImages } from "@/app/actions/profile-detail-images";
const field =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const primary =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50";
type Base = {
  id: string;
  display_name: string | null;
  headline: string | null;
  introduction: string | null;
  verification_status: string;
  is_public: boolean;
  suspended_at: string | null;
  deletion_requested_at: string | null;
} | null;
export function ProfileVersionManager({
  owner,
  versions,
  selectedId,
  startNew = false,
  base,
  expert,
  commonEditor,
  galleryImages = [],
  detailImagesState = { ok: true, images: [], revision: null },
  previewData,
}: {
  previewData?: {
    sources: Activity[];
    licenses: Awaited<
      ReturnType<typeof getOwnCertifications>
    >["certifications"];
    evidence: Awaited<ReturnType<typeof loadEvidenceReviews>>;
  };
  detailImagesState?: DetailImagesState;
  commonEditor?: React.ReactNode;
  galleryImages?: ExpertProfileViewProps["galleryImages"];
  owner: string;
  versions: ProfileVersion[];
  selectedId?: string;
  startNew?: boolean;
  base: Base;
  expert: ExpertProfileViewProps["expert"] | null;
}) {
  const router = useRouter();
  const commonSave = useRef<CommonProfileSave | null>(null);
  const commonSaveRegistry = useMemo(
    () => ({
      register: (save: CommonProfileSave | null) => {
        commonSave.current = save;
      },
    }),
    [],
  );
  const selected = versions.find((v) => v.id === selectedId);
  const [editing, setEditing] = useState(!!selected || startNew);
  const [id, setId] = useState<string | null>(selected?.id || null);
  const [title, setTitle] = useState(selected?.title || "");
  const [content, setContent] = useState<VersionContent>(
    selected?.draft_content || {
      headline: base?.headline || "",
      introduction: base?.introduction || "",
      sections: BASE_SECTIONS.map((s) => s.id),
      activities: [],
    },
  );
  const [commonDirty, setCommonDirty] = useState(false);
  const [detailImages, setDetailImages] = useState<EditableDetailImage[]>(
    detailImagesState.images,
  );
  const [savedDetailIds, setSavedDetailIds] = useState(
    detailImagesState.images.map((row) => row.id),
  );
  const [detailRevision, setDetailRevision] = useState(
    detailImagesState.revision,
  );
  const [detailReady, setDetailReady] = useState(detailImagesState.ok);
  const detailGroup = useRef(crypto.randomUUID());
  const detailChanged =
    JSON.stringify(detailImages.map((row) => row.id)) !==
    JSON.stringify(savedDetailIds);
  const [uploadMessage, setUploadMessage] = useState("");
  // The editor unmounts on preview; keep blob URLs alive until the whole manager
  // unmounts or the image is removed, rather than revoking them on step changes.
  const imageUrls = useRef(new Set<string>());
  useEffect(() => {
    const used = new Set(detailImages.map((image) => image.src));
    for (const image of detailImages)
      if (image.src.startsWith("blob:")) imageUrls.current.add(image.src);
    for (const url of imageUrls.current)
      if (!used.has(url)) {
        URL.revokeObjectURL(url);
        imageUrls.current.delete(url);
      }
  }, [detailImages]);
  useEffect(
    () => () => {
      for (const url of imageUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  const [saved, setSaved] = useState({
    title: selected?.title || "",
    content: selected?.draft_content,
  });
  const [evidence, setEvidence] = useState<
    Awaited<ReturnType<typeof loadEvidenceReviews>>
  >(previewData?.evidence ?? { rows: [], files: {} });
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const publishDialog = useRef<HTMLDialogElement>(null);
  const [publishAgreed, setPublishAgreed] = useState(false);
  const [step, setStep] = useState<"write" | "preview">(
    previewData ? "preview" : "write",
  );
  const [attachments, setAttachments] = useState<
    Record<string, ReviewAttachment>
  >({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [imports, setImports] = useState<Activity[] | null>(null);
  const [reviewChoices, setReviewChoices] = useState<
    Record<string, ReviewChoice>
  >(() =>
    Object.fromEntries(
      (selected?.draft_content.excluded ?? []).map((key) => [
        key,
        { visible: false, requested: false, files: {} },
      ]),
    ),
  );
  const [reviewSources, setReviewSources] = useState<Activity[]>(
    previewData?.sources ?? [],
  );
  const [reviewLicenses, setReviewLicenses] = useState<
    Awaited<ReturnType<typeof getOwnCertifications>>["certifications"]
  >(previewData?.licenses ?? []);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewReady, setReviewReady] = useState(!!previewData);
  const [reviewError, setReviewError] = useState("");
  const [reviewReload, setReviewReload] = useState(0);
  useEffect(() => {
    if (step !== "preview") return;
    if (previewData) {
      setReviewSources(
        previewData.sources.filter((row) => row.owner === owner),
      );
      setReviewLicenses(previewData.licenses);
      setEvidence(previewData.evidence);
      return;
    }
    let current = true;
    setReviewReady(false);
    setReviewLoading(true);
    setReviewError("");
    Promise.allSettled([
      loadActivities(owner),
      getOwnCertifications(),
      id ? loadEvidenceReviews(id) : Promise.resolve({ rows: [], files: {} }),
    ]).then(([records, licenses, reviews]) => {
      if (!current) return;
      if (reviews.status === "fulfilled") setEvidence(reviews.value);
      setReviewSources(records.status === "fulfilled" ? records.value : []);
      setReviewLicenses(
        licenses.status === "fulfilled" && licenses.value.ok
          ? licenses.value.certifications
          : [],
      );
      if (
        reviews.status === "rejected" ||
        records.status === "rejected" ||
        licenses.status === "rejected" ||
        !licenses.value.ok
      ) {
        setReviewError(
          "일부 자료를 불러오지 못했습니다. 다시 불러온 뒤 게시해주세요.",
        );
      } else {
        setReviewReady(true);
      }
      setReviewLoading(false);
    });
    return () => {
      current = false;
    };
  }, [step, owner, id, reviewReload, previewData]);
  const damoaFiles = useMemo<ReviewFile[]>(
    () => [
      ...new Map(
        reviewSources
          .filter((row) => row.owner === owner)
          .flatMap((row) =>
            row.files
              .filter((file) => !!file.path)
              .map((file) => ({
                id: file.id,
                name: file.name,
                href: previewData
                  ? "/preview/proof-sample.png"
                  : "/api/damoa/files/" + encodeURIComponent(file.id),
                type: file.type,
                size: file.size,
                activityTitle: row.title || "자료만 보관",
              })),
          )
          .map((file) => [file.id, file]),
      ).values(),
    ],
    [reviewSources, owner, previewData],
  );
  const reviewItems = useMemo<ReviewItem[]>(
    () => [
      ...content.activities.map((activity) => {
        const source = reviewSources.find(
          (row) => row.owner === owner && row.id === activity.id,
        );
        return {
          key: "damoa:" + activity.id,
          title: activity.title,
          category: activity.category,
          period: activity.period,
          source: "damoa" as const,
          files: (source?.files ?? [])
            .filter((file) => !!file.path)
            .map((file) => ({
              id: file.id,
              name: file.name,
              href: previewData
                ? "/preview/proof-sample.png"
                : "/api/damoa/files/" + encodeURIComponent(file.id),
            })),
        };
      }),
      ...(content.sections.includes("licenses")
        ? reviewLicenses.map((license) => ({
            key: "license:" + license.id,
            title: license.name,
            category: "자격·면허",
            period: license.issueDate,
            source: "license" as const,
            verified: license.verificationStatus === "verified",
            reviewStatus: ["pending", "verified", "rejected"].includes(
              license.verificationStatus ?? "",
            )
              ? (license.verificationStatus as
                  "pending" | "verified" | "rejected")
              : undefined,
            files: license.documentPath
              ? [
                  {
                    id: license.id,
                    name: license.name + " 증빙파일",
                    href: getEvidenceFileUrl(license.documentPath)!,
                  },
                ]
              : [],
          }))
        : []),
    ],
    [
      content.activities,
      content.sections,
      reviewSources,
      reviewLicenses,
      owner,
      previewData,
    ],
  );
  const previewActivities = content.activities.map((activity) => {
    const source = reviewSources.find(
      (row) => row.id === activity.id && row.owner === owner,
    );
    return activity.organizer === undefined && source
      ? { ...activity, organizer: activityOrganizer(source.details) }
      : activity;
  });
  const previewExpert = expert
    ? applyVersion(expert, { ...content, excluded: [] })
    : null;
  const reviewRecords = profileReviewItems(
    previewExpert,
    previewActivities,
    reviewItems,
    evidence,
  );
  const reviewPlan = reviewSubmissionPlan(
    reviewRecords,
    reviewChoices,
    evidence.rows,
    attachments,
  );
  const reviewCount = reviewPlan.filter((row) => row.request).length;
  const canPublish =
    base?.verification_status === "approved" &&
    base.is_public &&
    !base.suspended_at &&
    !base.deletion_requested_at;
  const changed =
    detailChanged ||
    commonDirty ||
    !sameProfileContent(content, {
      ...content,
      activities: previewActivities,
    }) ||
    !saved.content ||
    title !== saved.title ||
    !sameProfileContent(content, saved.content);
  const publishBlocked =
    pending ||
    !id ||
    !canPublish ||
    changed ||
    !detailReady ||
    !reviewReady ||
    reviewLoading ||
    !!reviewError;
  async function save() {
    if (previewData) {
      setSaved({ title, content });
      setMessage(
        "미리보기의 프로필을 저장했습니다. 서버에는 반영되지 않습니다.",
      );
      return true;
    }
    if (
      !PROFILE_PRESENTATION_STORAGE_ENABLED &&
      content.activities.some((a) => a.presentation)
    ) {
      setError(
        "표시 설정은 현재 미리보기입니다. 서버 저장 연결이 완료된 뒤 저장할 수 있습니다.",
      );
      return false;
    }
    setPending(true);
    setError("");
    try {
      if (commonSave.current && !(await commonSave.current())) {
        setError("기본정보를 저장하지 못했습니다. 입력 내용을 확인해주세요.");
        return false;
      }
      let imageSave: { ids: string[]; revision: string | null } | undefined;
      if (detailChanged) {
        if (!detailReady) {
          setError("첨부파일을 다시 불러온 뒤 저장해주세요.");
          return false;
        }
        const ids: string[] = [];
        for (const [index, image] of detailImages.entries()) {
          if (image.file)
            setUploadMessage(
              `이미지 업로드 중 · ${index + 1}/${detailImages.length}`,
            );
          ids.push(await uploadDetailImage(owner, detailGroup.current, image));
        }
        imageSave = { ids, revision: detailRevision };
      }
      const nextContent = { ...content, activities: previewActivities };
      const r = imageSave
        ? await saveProfileVersion(id, title, nextContent, imageSave)
        : await saveProfileVersion(id, title, nextContent);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      setId(r.id);
      if (imageSave) {
        setSavedDetailIds(imageSave.ids);
        setDetailRevision(r.detailRevision ?? null);
        setDetailImages((current) =>
          current.map(({ file, ...image }) => image),
        );
      }
      setContent(nextContent);
      setSaved({ title, content: nextContent });
      setCommonDirty(false);
      setMessage("프로필을 저장했습니다.");
      router.replace(`/my/profiles?profile=${r.id}`);
      router.refresh();
      return true;
    } catch {
      setError("저장하지 못했습니다. 다시 시도해주세요.");
      return false;
    } finally {
      setUploadMessage("");
      setPending(false);
    }
  }
  function confirmPublish() {
    if (publishBlocked) return;
    setPublishAgreed(false);
    setError("");
    publishDialog.current?.showModal();
  }
  async function publish() {
    if (!publishAgreed || !publishDialog.current?.open || publishBlocked)
      return;
    if (!LIVE_PROFILE_PUBLISH_ENABLED) {
      setMessage(
        "대표 선택 미리보기입니다. 실제 공개 변경은 아직 연결하지 않았습니다.",
      );
      return;
    }
    if (!id || pending) return;
    if (!detailReady || !reviewReady || reviewLoading || reviewError) {
      setError("자료를 모두 불러온 뒤 게시해주세요.");
      return;
    }
    if (changed) {
      setError("먼저 변경 내용을 저장해주세요.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const submissions = [];
      for (const row of reviewPlan.filter(
        (row) =>
          !row.legacyVerified &&
          (row.files.length > 0 || row.expected !== null),
      )) {
        const fileIds: string[] = [];
        for (const file of row.files)
          fileIds.push(
            previewData ? file.id : await storeEvidenceFile(owner, id, file),
          );
        submissions.push({
          key: row.key,
          fileIds,
          publicIds: row.files.flatMap((file, index) =>
            row.publicIds.includes(file.id) ? [fileIds[index]] : [],
          ),
          expected: row.expected,
        });
      }
      if (previewData) {
        setEvidence((previous) => ({
          files: {
            ...previous.files,
            ...Object.fromEntries(
              reviewPlan.flatMap((row) =>
                row.files.map((file) => [file.id, file]),
              ),
            ),
          },
          rows: [
            ...previous.rows.filter(
              (row) =>
                !reviewPlan.some(
                  (next) => next.key === row.item_key && next.request,
                ),
            ),
            ...reviewPlan
              .filter((row) => row.request)
              .map((row) => ({
                id: "preview:" + row.key,
                version_id: id,
                item_key: row.key,
                item_snapshot: previewActivities.find(
                  (a) => "damoa:" + a.id === row.key,
                ),
                title: row.title,
                file_ids: row.files.map((file) => file.id),
                public_file_ids: row.publicIds,
                status: "pending" as const,
                reason: "",
                updated_at: "preview-submitted",
              })),
          ],
        }));
        setMessage(
          `미리보기 완료 · 프로필 게시와 증빙 ${reviewCount}건의 심사 요청 흐름을 확인했습니다. 실제 공개·접수되지 않았습니다.`,
        );
        publishDialog.current?.close();
        return;
      }
      const r = await publishProfileVersion(id, content, submissions);
      if (!r.ok) setError(r.error);
      else {
        setMessage(
          `프로필을 게시했습니다. 증빙 ${reviewCount}건을 함께 심사 요청했습니다.`,
        );
        setAttachments({});
        setReviewReady(false);
        setReviewReload((count) => count + 1);
        publishDialog.current?.close();
        router.refresh();
      }
    } catch {
      setError("공개하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }
  function openPreview() {
    if (!previewData) setReviewReady(false);
    if (step === "write" && changed) leaveDialog.current?.showModal();
    else setStep("preview");
  }
  async function bringActivities() {
    setError("");
    try {
      setImports(
        previewData ? previewData.sources : await loadActivities(owner),
      );
    } catch {
      setError("서버의 다모아 기록을 불러오지 못했습니다.");
    }
  }
  function addActivity(row: Activity) {
    setContent({
      ...content,
      activities: [
        ...content.activities,
        activityForProfile(
          row,
          CATEGORIES.find((c) => c.id === row.category)?.name || "기타 활동",
        ),
      ],
    });
  }
  return (
    <div className={`mx-auto ${editing ? "max-w-none" : "max-w-3xl"}`}>
      <header hidden={editing && step === "preview"} className="mb-7">
        <p className="text-xs font-semibold tracking-wider text-primary">
          MY PROFILES
        </p>
        <h1 className="mt-2 text-page-title font-bold text-slate-950">
          {editing ? "프로필 작성" : "프로필 관리"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {editing ? (
            "나를 소개할 정보를 채우고, 공개 전 화면을 확인해보세요."
          ) : (
            <>
              여러 프로필을 만들 수 있어요!
              <br />
              프로필을 생성하고, 대표 프로필을 선택하고 홍보하세요!
            </>
          )}
        </p>
      </header>
      {!editing ? (
        <>
          <div className="mb-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!base}
              onClick={() => {
                setEditing(true);
                setId(null);
                setTitle("");
                setError("");
              }}
              className={primary}
            >
              ＋ 새 프로필 만들기
            </button>
            <Link
              href="/expert/edit"
              className="inline-flex min-h-12 items-center text-sm text-slate-500"
            >
              공통 이력/사진관리 →
            </Link>
          </div>
          {!base && (
            <p className="mb-5 text-sm text-slate-500">
              처음이라면 공통 기본 정보부터 작성해주세요.
            </p>
          )}
          <div className="space-y-3">
            {versions.map((v) => (
              <Link
                key={v.id}
                href={`/my/profiles?profile=${v.id}`}
                className="block rounded-2xl border border-slate-200 p-6 transition hover:border-blue-300"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold text-slate-900">{v.title}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${v.is_representative ? "bg-blue-50 text-primary" : "bg-slate-50 text-slate-500"}`}
                  >
                    {v.is_representative ? "대표 프로필" : "비공개"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {v.draft_content.headline || "소개를 작성해보세요."}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  활동 {v.draft_content.activities.length}개 · 수정하기 →
                </p>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <div
            className={
              step === "write"
                ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_200px]"
                : ""
            }
          >
            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <Link
                  href="/my/profiles"
                  className="min-h-11 py-3 text-sm text-slate-500"
                >
                  ← 내 프로필 목록
                </Link>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("write")}
                    aria-current={step === "write" ? "step" : undefined}
                    className={`min-h-11 rounded-lg px-3 text-sm ${step === "write" ? "bg-blue-50 text-primary" : "text-slate-500"}`}
                  >
                    1. 작성
                  </button>
                  <button
                    type="button"
                    onClick={openPreview}
                    aria-current={step === "preview" ? "step" : undefined}
                    className={`min-h-11 rounded-lg px-3 text-sm ${step === "preview" ? "bg-blue-50 text-primary" : "text-slate-500"}`}
                  >
                    2. 공개 전 확인
                  </button>
                </div>
              </div>
              {step === "write" && (
                <ProfileTitleCard value={title} onChange={setTitle} />
              )}
              <div hidden={step !== "write"} className="mb-5">
                {commonEditor && (
                  <section
                    id="profile-basics"
                    aria-labelledby="profile-basics-title"
                    className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <div className="mb-5 flex items-start gap-3">
                      <span
                        aria-hidden
                        className="pt-0.5 text-sm font-medium tabular-nums text-primary"
                      >
                        01
                      </span>
                      <div>
                        <h2
                          id="profile-basics-title"
                          className="text-lg font-semibold text-slate-900"
                        >
                          기본정보
                        </h2>
                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          사진과 이름, 나를 찾는 기준이 될 직군과 분야를
                          정해주세요.
                        </p>
                      </div>
                    </div>
                    <CommonProfileSaveContext.Provider
                      value={commonSaveRegistry}
                    >
                      <div
                        onChangeCapture={() => setCommonDirty(true)}
                        onClickCapture={(event) => {
                          const button = (event.target as HTMLElement).closest(
                            "button",
                          );
                          if (
                            button &&
                            !button.disabled &&
                            (button.hasAttribute(
                              "data-profile-dirty-control",
                            ) ||
                              /삭제|제거|링크 추가/.test(
                                button.textContent || "",
                              ))
                          )
                            setCommonDirty(true);
                        }}
                      >
                        {commonEditor}
                      </div>
                    </CommonProfileSaveContext.Provider>
                  </section>
                )}
              </div>
              {step === "write" ? (
                <div className="space-y-5">
                  <section
                    id="profile-introduction"
                    aria-labelledby="profile-introduction-title"
                    className="scroll-mt-28 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="pt-0.5 text-sm font-medium tabular-nums text-primary"
                      >
                        02
                      </span>
                      <div>
                        <h2
                          id="profile-introduction-title"
                          className="text-lg font-semibold text-slate-900"
                        >
                          나를 소개해요
                        </h2>
                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          어떤 일을 하고, 어떤 도움을 줄 수 있는지 알려주세요.
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="profile-headline"
                          className="text-sm font-medium text-slate-800"
                        >
                          한 줄 소개
                        </label>
                        <span
                          aria-hidden
                          className="text-xs tabular-nums text-slate-400"
                        >
                          {content.headline.length}/100
                        </span>
                      </div>
                      <input
                        id="profile-headline"
                        maxLength={100}
                        placeholder="예: 꾸준히 움직이는 일상을 돕는 운동 전문가입니다."
                        value={content.headline}
                        onChange={(e) =>
                          setContent({ ...content, headline: e.target.value })
                        }
                        className={field}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="profile-introduction-input"
                          className="text-sm font-medium text-slate-800"
                        >
                          상세 소개
                        </label>
                        <span
                          aria-hidden
                          className="text-xs tabular-nums text-slate-400"
                        >
                          {content.introduction.length.toLocaleString()}/5,000
                        </span>
                      </div>
                      <textarea
                        id="profile-introduction-input"
                        rows={5}
                        maxLength={5000}
                        placeholder="주로 하는 일, 나만의 강점, 함께하고 싶은 대상을 자유롭게 적어보세요."
                        value={content.introduction}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            introduction: e.target.value,
                          })
                        }
                        className={field}
                      />
                    </div>
                  </section>
                  <section
                    id="profile-images"
                    aria-labelledby="profile-images-title"
                    className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <div className="mb-5 flex items-start gap-3">
                      <span
                        aria-hidden
                        className="pt-0.5 text-sm font-medium tabular-nums text-primary"
                      >
                        03
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            id="profile-images-title"
                            className="text-lg font-semibold text-slate-900"
                          >
                            이미지로 더 보여주세요
                          </h2>
                          <span className="text-xs font-normal text-slate-400">
                            선택
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          활동 사진이나 직접 만든 소개 이미지를 첨부할 수
                          있어요.
                        </p>
                      </div>
                    </div>
                    <ProfileDetailImageEditor
                      images={detailImages}
                      onChange={setDetailImages}
                      disabled={pending || !detailReady}
                    />
                    {!detailReady && (
                      <p role="alert" className="text-sm text-red-600">
                        첨부파일을 불러오지 못했습니다. 기존 이미지는 변경되지
                        않습니다.
                        <button
                          type="button"
                          className="ml-2 underline"
                          onClick={async () => {
                            if (!id) return;
                            const result = await getOwnProfileDetailImages(id);
                            if (result.ok) {
                              setDetailImages(result.images);
                              setSavedDetailIds(
                                result.images.map((row) => row.id),
                              );
                              setDetailRevision(result.revision);
                              setDetailReady(true);
                            }
                          }}
                        >
                          다시 불러오기
                        </button>
                      </p>
                    )}
                  </section>
                  <section
                    id="profile-activities"
                    aria-labelledby="profile-activities-title"
                    className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="pt-0.5 text-sm font-medium tabular-nums text-primary"
                      >
                        04
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2
                            id="profile-activities-title"
                            className="text-lg font-semibold text-slate-900"
                          >
                            프로필에 담을 활동
                          </h2>
                          <span className="text-xs text-primary">
                            {content.activities.length}개 선택
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          다모아에 모아둔 학력·경력·활동 중 이 프로필에 보여줄
                          내용을 골라주세요.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={bringActivities}
                      aria-expanded={imports !== null}
                      className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 text-sm font-medium text-primary transition hover:bg-blue-50"
                    >
                      ＋ 다모아에서 골라 담기
                    </button>
                    {imports && (
                      <div className="mt-2 rounded-xl bg-slate-50 p-4">
                        <p className="mb-2 text-xs text-slate-500">
                          내 다모아에 보관된 기록
                        </p>
                        {imports.length ? (
                          imports.map((row) => (
                            <label
                              key={row.id}
                              className="flex min-h-11 items-center gap-3 text-sm text-slate-600"
                            >
                              <input
                                type="checkbox"
                                checked={content.activities.some(
                                  (a) => a.id === row.id,
                                )}
                                onChange={(e) => {
                                  if (e.target.checked) addActivity(row);
                                  else
                                    setContent({
                                      ...content,
                                      activities: content.activities.filter(
                                        (a) => a.id !== row.id,
                                      ),
                                    });
                                }}
                                className="accent-blue-600"
                              />
                              {row.title || "보관한 자료"}
                            </label>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">
                            기록이 없습니다.{" "}
                            <Link href="/my/damoa" className="text-primary">
                              다모아에 기록하기
                            </Link>
                          </p>
                        )}
                      </div>
                    )}
                    {content.activities.map((a) => (
                      <div
                        key={a.id}
                        className="mt-3 rounded-xl border border-slate-100 p-4"
                      >
                        <span className="text-xs text-primary">
                          {a.category}
                        </span>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {a.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {a.description}
                        </p>
                      </div>
                    ))}
                    {content.activities.length === 0 && !imports && (
                      <p className="mt-4 text-xs leading-6 text-slate-400">
                        아직 담은 활동이 없어요. 작은 경험부터 하나씩
                        추가해보세요.
                      </p>
                    )}
                    <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
                      활동의 자료도 자동으로 연결돼요. 공개 전 확인에서 살펴보고
                      게시할 때 함께 심사 요청할 수 있습니다.
                    </p>
                  </section>
                </div>
              ) : (
                <ProfileVisualReview
                  damoaFiles={damoaFiles}
                  publishAction={
                    <div className="space-y-3">
                      {changed && (
                        <button
                          type="button"
                          onClick={save}
                          disabled={pending || !title.trim()}
                          className="min-h-10 w-full rounded-xl border border-blue-200 text-sm font-semibold text-primary disabled:opacity-40"
                        >
                          프로필 저장
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={confirmPublish}
                        disabled={publishBlocked}
                        className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        {pending ? "게시하고 있습니다…" : "프로필 게시"}
                      </button>
                      <p className="text-xs leading-5 text-slate-500">
                        {reviewLoading
                          ? "자료를 확인하고 있어요."
                          : reviewCount
                            ? `새 증빙 ${reviewCount}건도 함께 심사 요청됩니다.`
                            : "새로 심사 요청할 자료가 없습니다."}
                      </p>
                      <p className="text-micro leading-5 text-slate-400">
                        자료 선택은 게시할 때 적용됩니다. 서류는 기본
                        비공개입니다.
                      </p>
                      {error && (
                        <p
                          role="alert"
                          className="text-xs leading-5 text-red-600"
                        >
                          {error}
                        </p>
                      )}
                      {message && (
                        <p
                          role="status"
                          className="text-xs leading-5 text-primary"
                        >
                          {message}
                        </p>
                      )}
                    </div>
                  }
                  detailImages={detailImages}
                  evidence={evidence}
                  attachments={attachments}
                  onAttachmentChange={(attachment) =>
                    setAttachments((previous) => ({
                      ...previous,
                      [attachment.key]: attachment,
                    }))
                  }
                  order={content.order}
                  onOrderChange={(order) =>
                    setContent((previous) => ({ ...previous, order }))
                  }
                  expert={previewExpert}
                  activities={previewActivities}
                  onEdit={(key, values) => {
                    const next = editProfileItem(
                      { ...content, activities: previewActivities },
                      previewExpert,
                      key,
                      values,
                      crypto.randomUUID(),
                    );
                    setContent(next);
                    if (!key.startsWith("damoa:") && key !== "introduction:0")
                      setReviewChoices((previous) => ({
                        ...previous,
                        [key]: { visible: false, requested: false, files: {} },
                      }));
                    setEvidence((previous) => ({
                      ...previous,
                      rows: previous.rows.filter((row) => row.item_key !== key),
                    }));
                    setMessage(
                      "수정 내용을 반영했습니다. 프로필 저장을 눌러주세요.",
                    );
                  }}
                  items={reviewItems}
                  choices={reviewChoices}
                  onChange={(key, choice) => {
                    setReviewChoices((previous) => ({
                      ...previous,
                      [key]: choice,
                    }));
                    setContent((previous) => {
                      const hidden = previous.excluded?.includes(key) ?? false;
                      if (hidden === !choice.visible) return previous;
                      return {
                        ...previous,
                        excluded: choice.visible
                          ? (previous.excluded ?? []).filter(
                              (item) => item !== key,
                            )
                          : [...new Set([...(previous.excluded ?? []), key])],
                      };
                    });
                  }}
                  galleryImages={
                    content.sections.includes("gallery") ? galleryImages : []
                  }
                  loading={reviewLoading}
                  error={reviewError}
                  retry={() => setReviewReload((count) => count + 1)}
                />
              )}
              {step === "write" && error && (
                <p role="alert" className="mt-4 text-sm text-red-600">
                  {error}
                </p>
              )}
              {step === "write" && message && (
                <p role="status" className="mt-4 text-sm text-primary">
                  {message}
                </p>
              )}
              {uploadMessage && (
                <p role="status" className="mt-4 text-sm text-primary">
                  {uploadMessage}
                </p>
              )}
              {!canPublish && (
                <p className="text-xs leading-6 text-slate-400">
                  비공개 저장은 가능하며 공개는 기본 프로필 승인 후 가능합니다.
                </p>
              )}
              {changed && id && (
                <p className="mt-3 text-xs text-slate-400">
                  저장하지 않은 변경사항이 있습니다.
                </p>
              )}
            </div>
            {step === "write" && (
              <aside
                aria-label="작성 작업"
                className="order-first rounded-2xl border border-slate-200 bg-white p-4 xl:order-last xl:sticky xl:top-28 xl:self-start"
              >
                <div className="hidden xl:block">
                  <h2 className="px-2 text-sm font-semibold text-slate-800">
                    작성 항목
                  </h2>
                  <nav
                    aria-label="작성 항목 바로가기"
                    className="mb-5 mt-3 space-y-1"
                  >
                    {[
                      ["profile-basics", "기본정보"],
                      ["profile-introduction", "소개"],
                      ["profile-images", "첨부 이미지"],
                      ["profile-activities", "활동 선택"],
                    ].map(([target, label], index) => (
                      <a
                        key={target}
                        href={`#${target}`}
                        className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-500 transition hover:bg-blue-50 hover:text-primary"
                      >
                        <span className="text-xs tabular-nums text-slate-400">
                          0{index + 1}
                        </span>
                        {label}
                      </a>
                    ))}
                  </nav>
                </div>
                <p
                  className="mb-3 flex items-center gap-2 text-xs text-slate-500"
                  role="status"
                >
                  <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${changed ? "bg-amber-400" : "bg-blue-400"}`}
                  />
                  {pending
                    ? "저장하고 있습니다"
                    : changed
                      ? "변경사항 저장 필요"
                      : "저장된 프로필"}
                </p>
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                  <button
                    type="button"
                    disabled={pending || !title.trim()}
                    onClick={save}
                    className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {pending ? "저장 중…" : "저장"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={openPreview}
                    className="min-h-12 w-full rounded-xl border border-blue-200 px-4 text-sm font-semibold text-primary disabled:opacity-40"
                  >
                    공개 전 확인
                  </button>
                </div>
                <p className="mt-3 hidden text-xs leading-5 text-slate-400 xl:block">
                  저장한 뒤 공개 전 확인에서 최종 화면을 살펴보세요.
                </p>
              </aside>
            )}
          </div>
          <dialog
            ref={leaveDialog}
            aria-labelledby="unsaved-profile-title"
            className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/25"
          >
            <h2 id="unsaved-profile-title" className="font-bold">
              완료하지 않은 작업이 있습니다. 이동하시겠습니까?
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              변경사항은 저장 버튼을 눌러야 저장됩니다.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                autoFocus
                type="button"
                onClick={() => leaveDialog.current?.close()}
                className="min-h-11 rounded-xl px-4 text-sm"
              >
                계속 작성
              </button>
              <button
                type="button"
                onClick={() => {
                  leaveDialog.current?.close();
                  setStep("preview");
                }}
                className="min-h-11 rounded-xl bg-blue-50 px-4 text-sm text-primary"
              >
                이동
              </button>
            </div>
          </dialog>
          <dialog
            ref={publishDialog}
            aria-labelledby="profile-publish-title"
            aria-describedby="profile-publish-description"
            onClose={() => setPublishAgreed(false)}
            onCancel={(event) => {
              if (pending) event.preventDefault();
            }}
            className="m-auto max-h-[85svh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/25"
          >
            <h2
              id="profile-publish-title"
              className="text-lg font-bold text-slate-900"
            >
              프로필 게시 전 확인해주세요
            </h2>
            <p
              id="profile-publish-description"
              className="mt-4 text-sm leading-6 text-slate-600"
            >
              {reviewCount
                ? `프로필이 공개되고, 연결된 증빙자료 중 새로 확인이 필요한 ${reviewCount}건이 관리자에게 심사 제출됩니다.`
                : "새로 심사 제출할 증빙자료가 없습니다. 프로필만 게시됩니다."}
            </p>
            <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
              <p>
                관리자는 자료에 개인정보가 포함되어 있는지와 해당 항목에 맞는
                자료인지 확인합니다.
              </p>
              <p>
                파일은 기본 비공개이며, 공개를 선택한 파일도 관리자 승인 후에만
                공개됩니다.
              </p>
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                checked={publishAgreed}
                disabled={pending}
                onChange={(event) => setPublishAgreed(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-blue-600"
              />
              <span>
                위 안내를 확인했으며, 프로필 게시 및 필요한 증빙자료 심사 제출에
                동의합니다.
              </span>
            </label>
            {error && (
              <p role="alert" className="mt-4 text-sm leading-6 text-red-600">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                disabled={pending}
                onClick={() => publishDialog.current?.close()}
                className="min-h-11 rounded-xl px-4 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!publishAgreed || publishBlocked}
                onClick={publish}
                className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {pending ? "게시하고 있습니다…" : "동의하고 게시"}
              </button>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
