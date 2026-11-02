"use client";
import {
  loadEvidenceReviews,
  storeEvidenceFile,
  type EvidenceReview,
} from "@/lib/profile-versions/evidence";
import { saveProfileEvidence } from "@/app/actions/profile-evidence";
import { ProfileVisualReview } from "./ProfileVisualReview";
import { getOwnCertifications } from "@/app/actions/certification";
import { getEvidenceFileUrl } from "@/lib/storage/evidence-file-url";
import {
  type ReviewItem,
  type ReviewChoice,
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
  LIVE_PROFILE_PUBLISH_ENABLED,
  BASE_SECTIONS,
  applyVersion,
  sameProfileContent,
  type ProfileVersion,
  type VersionContent,
} from "@/lib/profile-versions/types";
import { type ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
import { loadActivities } from "@/lib/damoa/server-store";
import { CATEGORIES, type Activity } from "@/lib/damoa/categories";
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
}: {
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
  const [saved, setSaved] = useState({
    title: selected?.title || "",
    content: selected?.draft_content,
  });
  const [evidence, setEvidence] = useState<
    Awaited<ReturnType<typeof loadEvidenceReviews>>
  >({ rows: [], files: {} });
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"write" | "preview">("write");
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
  const [reviewSources, setReviewSources] = useState<Activity[]>([]);
  const [reviewLicenses, setReviewLicenses] = useState<
    Awaited<ReturnType<typeof getOwnCertifications>>["certifications"]
  >([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewReload, setReviewReload] = useState(0);
  useEffect(() => {
    if (step !== "preview") return;
    let current = true;
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
          "일부 자료를 불러오지 못했습니다. 다시 불러온 뒤 심사 자료를 선택해주세요.",
        );
      }
      setReviewLoading(false);
    });
    return () => {
      current = false;
    };
  }, [step, owner, id, reviewReload]);
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
              href: "/api/damoa/files/" + encodeURIComponent(file.id),
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
    ],
  );
  const previewExpert = expert
    ? applyVersion(expert, { ...content, excluded: [] })
    : null;
  const canPublish =
    base?.verification_status === "approved" &&
    base.is_public &&
    !base.suspended_at &&
    !base.deletion_requested_at;
  const changed =
    commonDirty ||
    !saved.content ||
    title !== saved.title ||
    !sameProfileContent(content, saved.content);
  async function save() {
    setPending(true);
    setError("");
    try {
      if (commonSave.current && !(await commonSave.current())) {
        setError("기본정보를 저장하지 못했습니다. 입력 내용을 확인해주세요.");
        return false;
      }
      const r = await saveProfileVersion(id, title, content);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      setId(r.id);
      setSaved({ title, content });
      setCommonDirty(false);
      setMessage("프로필을 저장했습니다.");
      router.replace(`/my/profiles?profile=${r.id}`);
      router.refresh();
      return true;
    } catch {
      setError("저장하지 못했습니다. 다시 시도해주세요.");
      return false;
    } finally {
      setPending(false);
    }
  }
  async function publish() {
    if (!LIVE_PROFILE_PUBLISH_ENABLED) {
      setMessage(
        "대표 선택 미리보기입니다. 실제 공개 변경은 아직 연결하지 않았습니다.",
      );
      return;
    }
    if (!id || pending) return;
    if (changed) {
      setError("먼저 변경 내용을 저장해주세요.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const r = await publishProfileVersion(id);
      if (!r.ok) setError(r.error);
      else {
        setMessage(
          "이 프로필을 대표로 공개했습니다. 공유 주소는 그대로 유지됩니다.",
        );
        router.refresh();
      }
    } catch {
      setError("공개하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }
  function openPreview() {
    if (step === "write" && changed) leaveDialog.current?.showModal();
    else setStep("preview");
  }
  async function saveEvidence(
    key: string,
    files: import("@/lib/profile-versions/review-preview").ReviewFile[],
    publicIds: string[],
    request: boolean,
  ) {
    if (!id || changed)
      throw new Error("프로필 변경 내용을 먼저 저장해주세요.");
    const ids: string[] = [];
    for (const file of files)
      ids.push(await storeEvidenceFile(owner, id, file));
    const previous = evidence.rows.find((row) => row.item_key === key);
    const result = await saveProfileEvidence(
      id,
      key,
      ids,
      files.flatMap((file, index) =>
        publicIds.includes(file.id) ? [ids[index]] : [],
      ),
      request,
      previous?.updated_at ?? null,
    );
    if (!result.ok) throw new Error(result.error);
    const row = result.data as EvidenceReview;
    const storedFiles = Object.fromEntries(
      files.map((file, index) => [
        ids[index],
        {
          id: ids[index],
          name: file.name,
          href: "/api/damoa/files/" + ids[index],
        },
      ]),
    );
    setEvidence((previous) => ({
      rows: [...previous.rows.filter((r) => r.item_key !== key), row],
      files: { ...previous.files, ...storedFiles },
    }));
    setMessage(
      request ? "관리자에게 심사를 요청했습니다." : "증빙자료를 저장했습니다.",
    );
  }
  async function bringActivities() {
    setError("");
    try {
      setImports(await loadActivities(owner));
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
      <header hidden={editing && step === "preview"} className="mb-8">
        <p className="text-xs font-semibold tracking-wider text-primary">
          MY PROFILES
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950">
          프로필 관리
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          여러 프로필을 만들 수 있어요!
          <br />
          프로필을 생성하고, 대표 프로필을 선택하고 홍보하세요!
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
                ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_200px]"
                : ""
            }
          >
            <div className="min-w-0">
              {step === "write" && (
                <ProfileTitleCard value={title} onChange={setTitle} />
              )}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
                    className={`min-h-11 rounded-lg px-3 text-sm ${step === "write" ? "bg-blue-50 text-primary" : "text-slate-500"}`}
                  >
                    1. 작성
                  </button>
                  <button
                    type="button"
                    onClick={openPreview}
                    className={`min-h-11 rounded-lg px-3 text-sm ${step === "preview" ? "bg-blue-50 text-primary" : "text-slate-500"}`}
                  >
                    2. 공개 전 확인
                  </button>
                </div>
              </div>
              <div hidden={step !== "write"} className="mb-6">
                {commonEditor && (
                  <details
                    open
                    className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <summary className="cursor-pointer text-lg font-bold text-slate-900">
                      기본정보
                    </summary>
                    <CommonProfileSaveContext.Provider
                      value={commonSaveRegistry}
                    >
                      <div
                        className="mt-5"
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
                  </details>
                )}
              </div>
              {step === "write" ? (
                <div className="space-y-6">
                  <div className="space-y-5 rounded-2xl border border-slate-200 p-6">
                    <label className="block text-sm font-semibold text-slate-700">
                      한 줄 소개
                      <input
                        maxLength={100}
                        value={content.headline}
                        onChange={(e) =>
                          setContent({ ...content, headline: e.target.value })
                        }
                        className={field}
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      상세 소개
                      <textarea
                        rows={5}
                        maxLength={5000}
                        value={content.introduction}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            introduction: e.target.value,
                          })
                        }
                        className={field}
                      />
                    </label>
                    <div className="border-t border-slate-100 pt-5">
                      <h2 className="font-bold text-slate-800">
                        프로필에 담을 활동
                      </h2>
                      <p className="mt-2 text-xs leading-6 text-slate-500">
                        다모아의 활동을 골라 담은 뒤, 공개 전 확인에서 첨부
                        자료와 심사 요청 여부를 선택할 수 있습니다. 개인 메모는
                        가져오지 않습니다.
                      </p>
                      <button
                        type="button"
                        onClick={bringActivities}
                        className="mt-3 min-h-11 text-sm font-semibold text-primary"
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
                    </div>
                    <p className="text-xs leading-6 text-slate-400">
                      학력·경력·교육 등은 다모아에서 골라 담습니다. AI 구성
                      추천은 아직 연결되지 않았습니다.
                    </p>
                  </div>
                </div>
              ) : (
                <ProfileVisualReview
                  evidence={evidence}
                  onSaveEvidence={saveEvidence}
                  evidenceDisabled={!id || changed}
                  order={content.order}
                  onOrderChange={(order) =>
                    setContent((previous) => ({ ...previous, order }))
                  }
                  expert={previewExpert}
                  activities={content.activities}
                  items={reviewItems}
                  choices={reviewChoices}
                  onChange={(key, choice) => {
                    setReviewChoices((previous) => ({
                      ...previous,
                      [key]: choice,
                    }));
                    setContent((previous) => ({
                      ...previous,
                      excluded: choice.visible
                        ? (previous.excluded ?? []).filter(
                            (item) => item !== key,
                          )
                        : [...new Set([...(previous.excluded ?? []), key])],
                    }));
                  }}
                  galleryImages={
                    content.sections.includes("gallery") ? galleryImages : []
                  }
                  loading={reviewLoading}
                  error={reviewError}
                  retry={() => setReviewReload((count) => count + 1)}
                />
              )}
              {error && (
                <p role="alert" className="mt-4 text-sm text-red-600">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="mt-4 text-sm text-primary">
                  {message}
                </p>
              )}
              {step === "preview" && (
                <div className="my-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={pending || !title.trim()}
                    onClick={save}
                    className="min-h-12 rounded-xl border border-blue-200 px-5 text-sm font-semibold text-primary disabled:opacity-40"
                  >
                    {pending ? "처리 중…" : "프로필 저장"}
                  </button>
                  {id && (
                    <button
                      type="button"
                      disabled={pending || !canPublish || changed}
                      onClick={publish}
                      className="min-h-12 rounded-xl border border-blue-200 px-5 text-sm font-semibold text-primary disabled:opacity-40"
                    >
                      공개프로필 업로드
                    </button>
                  )}
                </div>
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
                className="order-first xl:order-last xl:sticky xl:top-28 xl:self-start rounded-2xl border border-slate-200 bg-white p-4"
              >
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
                  className="mt-3 min-h-12 w-full rounded-xl border border-blue-200 px-4 text-sm font-semibold text-primary disabled:opacity-40"
                >
                  공개 전 확인
                </button>
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
        </>
      )}
    </div>
  );
}
