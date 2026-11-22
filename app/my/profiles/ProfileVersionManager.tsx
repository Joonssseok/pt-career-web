"use client";
import Image from "next/image";
import { IntroductionEditor } from "@/components/profile-editor/IntroductionEditor";
import {
  introductionFromText,
  introductionText,
} from "@/lib/profile-versions/introduction-format";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo-url";
import { ProfileEditorShell } from "./ProfileEditorShell";
import contentStyles from "./ProfileEditorContent.module.css";
import { CurrentWorkplaceSelector } from "@/components/profile-sections/CurrentWorkplaceSelector";
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
  type CommonProfilePreview,
} from "@/components/CommonProfileSaveContext";
import {
  useRef,
  useMemo,
  useState,
  useEffect,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  saveProfileVersion,
  publishProfileVersion,
  deleteProfileVersion,
} from "@/app/actions/profile-versions";
import {
  activityForProfile,
  activityOrganizer,
  LIVE_PROFILE_PUBLISH_ENABLED,
  INTRODUCTION_FORMATTING_STORAGE_ENABLED,
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
import { REGIONS } from "@/lib/constants/regions";
import {
  detailDocumentFromImages,
  detailImagesForDocument,
} from "@/lib/profile-versions/detail-document";
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
  publishedVerifiedCount = null,
}: {
  publishedVerifiedCount?: number | null;
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
  const [liveCommon, setLiveCommon] = useState<CommonProfilePreview>({});
  const [commonBusy, setCommonBusy] = useState(false);
  const [commonRevision, setCommonRevision] = useState(0);
  const [hasUserEdits, setHasUserEdits] = useState(false);
  const saving = useRef(false);
  const [failedFingerprint, setFailedFingerprint] = useState<string | null>(
    null,
  );
  const [savedAt, setSavedAt] = useState(false);
  const pendingLeave = useRef<string | null>(null);
  const latestCommonRevision = useRef(commonRevision);
  latestCommonRevision.current = commonRevision;
  const commonSaveRegistry = useMemo(
    () => ({
      preview: (patch: CommonProfilePreview) =>
        setLiveCommon((previous) => {
          const next = { ...previous, ...patch };
          return JSON.stringify(next) === JSON.stringify(previous)
            ? previous
            : next;
        }),
      busy: setCommonBusy,
      dirty: () => markCommonDirty(),
      register: (save: CommonProfileSave | null) => {
        commonSave.current = save;
      },
    }),
    [],
  );
  const selected = versions.find((v) => v.id === selectedId);
  const [editing, setEditing] = useState(!!selected || startNew);
  const [id, setId] = useState<string | null>(selected?.id || null);
  const [title, setTitleState] = useState(selected?.title || "");
  const [content, setContentState] = useState<VersionContent>(
    selected?.draft_content || {
      headline: base?.headline || "",
      introduction: base?.introduction || "",
      sections: BASE_SECTIONS.map((s) => s.id),
      activities: [],
    },
  );
  function setTitle(value: string) {
    setHasUserEdits(true);
    setTitleState(value);
  }
  function setContent(value: SetStateAction<VersionContent>) {
    setHasUserEdits(true);
    setContentState(value);
  }
  function markCommonDirty() {
    setHasUserEdits(true);
    setCommonDirty(true);
    setCommonRevision((value) => value + 1);
  }
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
  // Keep the media catalog alive for undo; only referenced files enter a saved snapshot.
  const activeDetailImages = detailImagesForDocument(
    detailImages,
    content.detailDocument,
  );
  const detailChanged =
    JSON.stringify(activeDetailImages.map((row) => row.id)) !==
    JSON.stringify(savedDetailIds);
  const [uploadMessage, setUploadMessage] = useState("");
  // Keep local image URLs alive across hidden stages until removal or unmount.
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
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [deleteError, setDeleteError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishAgreed, setPublishAgreed] = useState(false);
  const [editorStep, setEditorStep] = useState(previewData ? 4 : 0);
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
    if (step !== "preview" && !previewOpen && editorStep !== 3) return;
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
      if (editorStep === 3 && records.status === "fulfilled")
        setImports(records.value.filter((row) => row.owner === owner));
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
  }, [step, editorStep, previewOpen, owner, id, reviewReload, previewData]);
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
                  ? "/preview/masking-sample.png"
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
                ? "/preview/masking-sample.png"
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
  const liveExpert: ExpertProfileViewProps["expert"] = {
    id: base?.id ?? "draft",
    display_name: base?.display_name ?? null,
    headline: null,
    introduction: null,
    total_experience_years: null,
    profile_image_path: null,
    cover_image_path: null,
    youtube_url: null,
    instagram_url: null,
    blog_url: null,
    threads_url: null,
    kakao_url: null,
    workplace_region: null,
    workplace_center_name: null,
    workplace_website_url: null,
    workplace_address: null,
    workplace_address_detail: null,
    workplace_phone: null,
    workplace_external_contact_url: null,
    professions: [],
    specialties: [],
    academic_records: [],
    experiences: [],
    educations: [],
    licenses: [],
    extra_links: [],
    ...expert,
    ...liveCommon,
  };
  const previewExpert = applyVersion(liveExpert, { ...content, excluded: [] });
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
  const fingerprint = JSON.stringify({
    title,
    content,
    detailIds: activeDetailImages.map((row) => row.id),
    commonRevision,
  });
  const latestFingerprint = useRef(fingerprint);
  latestFingerprint.current = fingerprint;
  const latestSave = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => {
    if (
      !editing ||
      !changed ||
      !hasUserEdits ||
      pending ||
      commonBusy ||
      !title.trim() ||
      failedFingerprint === fingerprint
    )
      return;
    const timer = window.setTimeout(() => {
      void latestSave.current();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    editing,
    changed,
    hasUserEdits,
    pending,
    commonBusy,
    title,
    fingerprint,
    failedFingerprint,
  ]);
  useEffect(() => {
    if (!editing || !changed || !hasUserEdits) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing, changed, hasUserEdits]);
  useEffect(() => {
    if (!editing || !changed || !hasUserEdits) return;
    const guard = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as HTMLElement).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const target = new URL(link.href, window.location.href);
      if (
        target.origin === window.location.origin &&
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      pendingLeave.current = target.href;
      leaveDialog.current?.showModal();
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [editing, changed, hasUserEdits]);
  async function save(automatic = false) {
    if (saving.current || commonBusy) return false;
    const attemptFingerprint = fingerprint;
    const attemptCommonRevision = commonRevision;
    if (previewData) {
      setSaved({ title, content });
      setHasUserEdits(false);
      setSavedAt(true);
      setFailedFingerprint(null);
      setMessage(
        "미리보기의 프로필을 저장했습니다. 서버에는 반영되지 않습니다.",
      );
      return true;
    }
    if (
      !PROFILE_PRESENTATION_STORAGE_ENABLED &&
      content.activities.some((a) => a.presentation)
    ) {
      setFailedFingerprint(attemptFingerprint);
      setError(
        "표시 설정은 현재 미리보기입니다. 서버 저장 연결이 완료된 뒤 저장할 수 있습니다.",
      );
      return false;
    }
    saving.current = true;
    setPending(true);
    setFailedFingerprint(null);
    setError("");
    let succeeded = false;
    try {
      if (commonDirty && commonSave.current && !(await commonSave.current())) {
        setError("기본정보를 저장하지 못했습니다. 입력 내용을 확인해주세요.");
        return false;
      }
      let imageSave: { ids: string[]; revision: string | null } | undefined;
      if (detailChanged || content.detailDocument) {
        if (!detailReady) {
          setError("첨부파일을 다시 불러온 뒤 저장해주세요.");
          return false;
        }
        const ids: string[] = [];
        for (const [index, image] of activeDetailImages.entries()) {
          if (image.file)
            setUploadMessage(
              `이미지 업로드 중 · ${index + 1}/${activeDetailImages.length}`,
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
          current.map((image) =>
            activeDetailImages.some((savedImage) => savedImage.id === image.id)
              ? (({ file, ...stored }) => stored)(image)
              : image,
          ),
        );
      }
      const unchanged = latestFingerprint.current === attemptFingerprint;
      if (unchanged) {
        setContentState(nextContent);
        setHasUserEdits(false);
      }
      if (latestCommonRevision.current === attemptCommonRevision)
        setCommonDirty(false);
      setSaved({ title, content: nextContent });
      setSavedAt(true);
      succeeded = true;
      setMessage("프로필을 저장했습니다.");
      if (unchanged && (!id || !automatic)) {
        router.replace(`/my/profiles?profile=${r.id}`);
        router.refresh();
      }
      return true;
    } catch {
      setError("저장하지 못했습니다. 다시 시도해주세요.");
      return false;
    } finally {
      if (!succeeded) setFailedFingerprint(attemptFingerprint);
      saving.current = false;
      setUploadMessage("");
      setPending(false);
    }
  }
  latestSave.current = () => save(true);
  function changeEditorStep(next: number) {
    setEditorStep(next);
    setStep(next === 4 ? "preview" : "write");
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
      if (
        reviewPlan.some(
          (row) =>
            row.request &&
            row.files.some((file) => !file.maskedCopy || !file.blob),
        )
      ) {
        setError(
          "새로 심사할 자료는 증빙자료 확인에서 개인정보를 가리고 직접 확인해주세요.",
        );
        return;
      }
      for (const row of reviewPlan.filter(
        (row) =>
          !row.legacyVerified &&
          (row.files.length > 0 || row.expected !== null),
      )) {
        const fileIds: string[] = [];
        for (const file of row.files)
          fileIds.push(
            previewData || !row.request
              ? file.id
              : await storeEvidenceFile(owner, id, file),
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
    setPreviewOpen(true);
  }
  async function removeProfile() {
    if (!id || selected?.is_representative || pending) return;
    if (previewData) {
      setDeleteError("예시 화면에서는 실제 프로필을 삭제하지 않습니다.");
      return;
    }
    setPending(true);
    setDeleteError("");
    try {
      const result = await deleteProfileVersion(id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      deleteDialog.current?.close();
      setId(null);
      setEditing(false);
      setMessage("프로필을 삭제했습니다.");
      router.replace("/my/profiles");
      router.refresh();
    } catch {
      setDeleteError("프로필을 삭제하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
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
  useEffect(() => {
    if (editorStep === 3 && previewData)
      setImports(previewData.sources.filter((row) => row.owner === owner));
  }, [editorStep, previewData, owner]);
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
  const pickable = new Map(
    (imports ?? []).map((row) => {
      const activity = activityForProfile(
        row,
        CATEGORIES.find((category) => category.id === row.category)?.name ||
          "기타 활동",
      );
      return [activity.id, activity] as const;
    }),
  );
  for (const activity of content.activities)
    pickable.set(activity.id, activity);
  const pickGroups = [
    ...new Set([...pickable.values()].map((row) => row.category)),
  ];
  function selectActivity(
    row: VersionContent["activities"][number],
    checked: boolean,
  ) {
    const key = "damoa:" + row.id;
    setContent((previous) => ({
      ...previous,
      activities: previous.activities.some((item) => item.id === row.id)
        ? previous.activities
        : [...previous.activities, row],
      excluded: checked
        ? (previous.excluded ?? []).filter((item) => item !== key)
        : [...new Set([...(previous.excluded ?? []), key])],
    }));
    setReviewChoices((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] ?? { requested: false, files: {} }),
        visible: checked,
      },
    }));
  }
  const saveStatus = pending
    ? "saving"
    : failedFingerprint === fingerprint
      ? "error"
      : changed && hasUserEdits
        ? "dirty"
        : savedAt
          ? "saved"
          : "idle";
  const checklist = [
    {
      label: "기본 정보",
      filled:
        !!previewExpert.display_name && previewExpert.professions.length > 0,
      step: 0,
    },
    { label: "한 줄 소개", filled: !!content.headline.trim(), step: 0 },
    { label: "소개", filled: !!content.introduction.trim(), step: 1 },
    {
      label: "상세소개",
      filled: detailImages.length > 0 || !!content.detailDocument,
      step: 2,
    },
    {
      label: "이력",
      filled:
        previewActivities.some(
          (row) => !content.excluded?.includes("damoa:" + row.id),
        ) ||
        liveExpert.experiences.length +
          liveExpert.licenses.length +
          liveExpert.academic_records.length +
          liveExpert.educations.length >
          0,
      step: 3,
    },
  ];
  const identity = (
    <div data-editor-identity>
      {getProfilePhotoUrl(previewExpert.profile_image_path) && (
        <Image
          src={getProfilePhotoUrl(previewExpert.profile_image_path)!}
          alt="프로필 사진 미리보기"
          width={112}
          height={112}
        />
      )}
      <h2>{previewExpert.display_name || "이름을 입력해주세요"}</h2>
      <p data-editor-role>
        {previewExpert.professions.map((row) => row.name).join(" · ")}
      </p>
      {content.headline && <p data-editor-headline>{content.headline}</p>}
      <div data-editor-specialties>
        {previewExpert.specialties.map((row) => (
          <span key={row.slug}>{row.name}</span>
        ))}
      </div>
      <button type="button" onClick={openPreview}>
        전체 미리보기
      </button>
    </div>
  );
  return (
    <div className={`mx-auto ${editing ? "max-w-none" : "max-w-3xl"}`}>
      <header hidden={editing} className="mb-7">
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
          <div data-profile-editor className={contentStyles.root}>
            <h1 className="sr-only">프로필 작성</h1>
            <ProfileEditorShell
              step={editorStep}
              onStepChange={changeEditorStep}
              identity={identity}
              saveStatus={saveStatus}
              pending={pending}
              onRetry={() => {
                void save();
              }}
            >
              <Link href="/my/profiles" className={contentStyles.back}>
                ← 내 프로필 목록
              </Link>
              <div
                hidden={editorStep !== 0}
                data-editor-step="basic"
                aria-label="기본 정보"
              >
                <ProfileTitleCard value={title} onChange={setTitle} />
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
                  <CommonProfileSaveContext.Provider value={commonSaveRegistry}>
                    <div
                      data-common-editor
                      onChangeCapture={markCommonDirty}
                      onClickCapture={(event) => {
                        const button = (event.target as HTMLElement).closest(
                          "button",
                        );
                        if (
                          button &&
                          !button.disabled &&
                          (button.hasAttribute("data-profile-dirty-control") ||
                            /삭제|제거|링크 추가/.test(
                              button.textContent || "",
                            ))
                        )
                          markCommonDirty();
                      }}
                    >
                      {commonEditor}
                    </div>
                  </CommonProfileSaveContext.Provider>
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
                  <label className="mt-5 block border-t border-slate-100 pt-5 text-sm font-semibold text-slate-800">
                    주요 활동 지역{" "}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      선택
                    </span>
                    <select
                      aria-label="주요 활동 지역"
                      value={
                        content.activityRegion ?? expert?.workplace_region ?? ""
                      }
                      onChange={(event) =>
                        setContent((previous) => ({
                          ...previous,
                          activityRegion: event.target.value,
                        }))
                      }
                      className={field}
                    >
                      <option value="">선택하지 않음</option>
                      {REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                    <span className="mt-2 block text-xs font-normal leading-6 text-slate-400">
                      저장 후 게시한 프로필에 시·도만 표시됩니다.
                    </span>
                  </label>
                  <CurrentWorkplaceSelector
                    previewActivities={previewData?.sources}
                    owner={owner}
                    value={content.currentWorkplace}
                    onChange={(currentWorkplace) =>
                      setContent((previous) => ({
                        ...previous,
                        currentWorkplace,
                        excluded: (previous.excluded ?? []).filter(
                          (key) => key !== "workplace:0",
                        ),
                      }))
                    }
                  />
                </section>

                {id && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setDeleteError("");
                      deleteDialog.current?.showModal();
                    }}
                    className={contentStyles.deleteButton}
                  >
                    프로필 삭제
                  </button>
                )}
              </div>
              <div hidden={editorStep !== 1} role="tabpanel" aria-label="소개">
                {" "}
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
                        소개
                      </h2>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        홈 화면 맨 위에 크게 보이는 글이에요. 첫 줄이 가장 크게
                        나와요.
                      </p>
                    </div>
                  </div>
                  {process.env.NODE_ENV === "development" &&
                    !INTRODUCTION_FORMATTING_STORAGE_ENABLED && (
                      <a
                        className={contentStyles.back}
                        href={`/preview/profile-introduction${id ? `?profile=${id}` : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        소개 서식 도구 미리보기 ↗
                      </a>
                    )}
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="profile-introduction-input"
                        className="text-sm font-medium text-slate-800"
                      >
                        소개 글
                      </label>
                      <span
                        aria-hidden
                        className="text-xs tabular-nums text-slate-400"
                      >
                        {content.introduction.length.toLocaleString()}/5,000
                      </span>
                    </div>
                    {INTRODUCTION_FORMATTING_STORAGE_ENABLED ? (
                      <IntroductionEditor
                        inputId="profile-introduction-input"
                        document={
                          content.introductionDocument ??
                          introductionFromText(content.introduction)
                        }
                        onChange={(document) =>
                          setContent((previous) => ({
                            ...previous,
                            introduction: introductionText(document),
                            introductionDocument: document,
                          }))
                        }
                      />
                    ) : (
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
                    )}
                  </div>
                </section>
              </div>
              <div
                hidden={editorStep !== 2}
                data-editor-step="detail"
                aria-label="상세소개"
              >
                {" "}
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
                          상세소개
                        </h2>
                        <span className="text-xs font-normal text-slate-400">
                          선택
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        글과 서식을 자유롭게 꾸미고, 사진·GIF·동영상과 유튜브를
                        글 사이에 넣어보세요.
                      </p>
                    </div>
                  </div>
                  <IntroductionEditor
                    label="상세소개 글"
                    richMode
                    inputId="profile-detail-input"
                    document={
                      content.detailDocument ??
                      detailDocumentFromImages(detailImages)
                    }
                    mediaImages={detailImages}
                    disabled={pending || !detailReady}
                    onMediaImagesChange={(images) => {
                      setHasUserEdits(true);
                      setDetailImages(images);
                    }}
                    onChange={(document) => {
                      setContent((previous) => ({
                        ...previous,
                        detailDocument: document,
                      }));
                    }}
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
              </div>
              <section
                hidden={editorStep !== 3}
                data-editor-step="records"
                aria-label="이력 고르기"
                className={contentStyles.pick}
              >
                <h2>이력 고르기</h2>
                <p>다모아에 모아 둔 기록 중 이 프로필에 보여 줄 것만 골라요.</p>
                <Link href="/my/damoa#records">
                  새 기록은 다모아에서 추가해요 ↗
                </Link>
                <button type="button" onClick={bringActivities}>
                  다모아 기록 새로고침
                </button>
                {pickGroups.map((group) => {
                  const rows = [...pickable.values()].filter(
                    (row) => row.category === group,
                  );
                  const selectedCount = rows.filter(
                    (row) =>
                      content.activities.some((item) => item.id === row.id) &&
                      !content.excluded?.includes("damoa:" + row.id),
                  ).length;
                  return (
                    <div key={group} className={contentStyles.pickGroup}>
                      <h3>
                        {group}
                        <span>
                          {rows.length}개 중 {selectedCount}개 선택
                        </span>
                      </h3>
                      {rows.map((row) => (
                        <label key={row.id} className={contentStyles.pickRow}>
                          <span>
                            <strong>{row.title || "보관한 자료"}</strong>
                            {row.organizer && <small>{row.organizer}</small>}
                            {evidence.rows.some(
                              (review) =>
                                review.item_key === "damoa:" + row.id &&
                                review.status === "verified",
                            ) && <small>인증완료</small>}
                          </span>
                          <input
                            type="checkbox"
                            checked={
                              content.activities.some(
                                (item) => item.id === row.id,
                              ) &&
                              !content.excluded?.includes("damoa:" + row.id)
                            }
                            onChange={(event) =>
                              selectActivity(row, event.target.checked)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  );
                })}
                {imports !== null && pickGroups.length === 0 && (
                  <p>기록이 없어요. 다모아에서 첫 기록을 추가해보세요.</p>
                )}
                <p>
                  선택한 이력의 표시와 순서는 공개 전 확인에서 조정할 수 있어요.
                </p>
              </section>
              <section
                hidden={editorStep !== 4}
                className={contentStyles.checklist}
                aria-label="공개 전 확인 목록"
              >
                <h2>공개 전 확인</h2>
                <p>
                  작성한 내용을 확인하고 기존 공개 조건에 따라 게시할 수 있어요.
                </p>
                <ul>
                  {checklist.map((row) => (
                    <li key={row.label}>
                      <span aria-hidden="true">{row.filled ? "✓" : "—"}</span>
                      {row.label}
                      <button
                        type="button"
                        onClick={() => changeEditorStep(row.step)}
                      >
                        {row.filled ? "수정" : "쓰러 가기"}
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={openPreview}>
                  전체 미리보기
                </button>
              </section>
              <ProfileVisualReview
                hideEditor={editorStep !== 4}
                previewOpen={previewOpen}
                onPreviewClose={() => setPreviewOpen(false)}
                verifiedCareerCount={
                  selected?.is_representative ? publishedVerifiedCount : 0
                }
                damoaFiles={damoaFiles}
                publishAction={
                  <div className="space-y-3">
                    {changed && (
                      <button
                        type="button"
                        onClick={() => void save()}
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
                  </div>
                }
                detailImages={activeDetailImages}
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
                activityRegion={content.activityRegion}
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
              {error && editorStep !== 4 && <p role="alert">{error}</p>}
              {message && editorStep !== 4 && <p role="status">{message}</p>}
              {uploadMessage && <p role="status">{uploadMessage}</p>}
              {!canPublish && (
                <p className={contentStyles.help}>
                  비공개 저장은 가능하며 공개는 기본 프로필 승인 후 가능합니다.
                </p>
              )}
              {hasUserEdits && !title.trim() && (
                <p role="status">
                  자동 저장을 시작하려면 프로필 제목을 입력해주세요.
                </p>
              )}
              <button
                type="button"
                disabled={pending || commonBusy || !title.trim()}
                onClick={() => void save()}
                className={contentStyles.manualSave}
              >
                지금 저장
              </button>
            </ProfileEditorShell>
          </div>
          <dialog
            ref={deleteDialog}
            aria-labelledby="delete-profile-title"
            aria-describedby="delete-profile-description"
            onCancel={(event) => {
              if (pending) event.preventDefault();
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/25"
          >
            <h2
              id="delete-profile-title"
              className="text-lg font-semibold text-slate-900"
            >
              {selected?.is_representative
                ? "대표 프로필은 먼저 변경해주세요"
                : "이 프로필을 삭제하시겠습니까?"}
            </h2>
            <p
              id="delete-profile-description"
              className="mt-3 text-sm leading-6 text-slate-500"
            >
              {selected?.is_representative ? (
                "현재 대표 프로필은 삭제할 수 없습니다. 다른 프로필을 게시해 대표로 변경한 뒤 삭제해주세요."
              ) : (
                <>
                  ‘{saved.title || title}’의 작성 내용과 이 프로필의 심사 내역이
                  삭제되며 복구할 수 없습니다. 다모아 원본·공통 정보·원본
                  파일·다른 프로필은 유지됩니다.
                </>
              )}
            </p>
            {deleteError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                autoFocus
                type="button"
                disabled={pending}
                onClick={() => deleteDialog.current?.close()}
                className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 disabled:opacity-40"
              >
                {selected?.is_representative ? "확인" : "취소"}
              </button>
              {!selected?.is_representative && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={removeProfile}
                  className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {pending ? "삭제 중…" : "삭제하기"}
                </button>
              )}
            </div>
          </dialog>
          <dialog
            ref={leaveDialog}
            aria-labelledby="unsaved-profile-title"
            className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/25"
          >
            <h2 id="unsaved-profile-title" className="font-bold">
              완료하지 않은 작업이 있습니다. 이동하시겠습니까?
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              아직 저장되지 않은 변경사항이 있습니다. 자동 저장 상태를
              확인하거나 다시 시도해주세요.
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
                  const destination = pendingLeave.current;
                  pendingLeave.current = null;
                  if (destination) {
                    setHasUserEdits(false);
                    router.push(destination);
                  }
                }}
                className="min-h-11 rounded-xl bg-blue-50 px-4 text-sm text-primary"
              >
                그대로 이동
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
