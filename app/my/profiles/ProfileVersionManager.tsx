"use client";
import { ProfileTitleCard } from "@/components/ProfileTitleCard";
import {
  CommonProfileSaveContext,
  type CommonProfileSave,
} from "@/components/CommonProfileSaveContext";
import { useRef, useMemo, useState } from "react";
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
  type ProfileVersion,
  type VersionContent,
} from "@/lib/profile-versions/types";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "@/components/experts/ExpertProfileView";
import { ProfileActivitySections } from "@/components/ProfileActivitySections";
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
}: {
  commonEditor?: React.ReactNode;
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
  const [step, setStep] = useState<"write" | "preview">("write");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [imports, setImports] = useState<Activity[] | null>(null);
  const canPublish =
    base?.verification_status === "approved" &&
    base.is_public &&
    !base.suspended_at &&
    !base.deletion_requested_at;
  const changed =
    !selected ||
    title !== selected.title ||
    JSON.stringify(content) !== JSON.stringify(selected.draft_content);
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
      setMessage("비공개 초안을 저장했습니다. 공개본은 변경되지 않았습니다.");
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
  function move(index: number, offset: number) {
    const rows = [...content.activities];
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    setContent({ ...content, activities: rows });
  }
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
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
                    {v.is_representative ? "대표 프로필" : "비공개 초안"}
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
          <ProfileTitleCard value={title} onChange={setTitle} />
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
                onClick={() => setStep("preview")}
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
                <CommonProfileSaveContext.Provider value={commonSaveRegistry}>
                  <div className="mt-5">{commonEditor}</div>
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
                      setContent({ ...content, introduction: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <div className="border-t border-slate-100 pt-5">
                  <h2 className="font-bold text-slate-800">
                    프로필에 담을 활동
                  </h2>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    다모아의 활동 내용만 가져옵니다. 개인 메모와 원본 첨부는
                    포함하지 않습니다.
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
                        현재 브라우저에 보관된 기록
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
                      <span className="text-xs text-primary">{a.category}</span>
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
                  학력·경력·교육 등은 다모아에서 골라 담습니다. AI 구성 추천은
                  아직 연결되지 않았습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5">
                <h2 className="text-sm font-bold text-slate-800">
                  공통 이력 표시
                </h2>
                <div className="mt-3 flex flex-wrap gap-4">
                  {BASE_SECTIONS.map((section) => (
                    <label
                      key={section.id}
                      className="flex min-h-11 items-center gap-2 text-sm text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={content.sections.includes(section.id)}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            sections: e.target.checked
                              ? [...content.sections, section.id]
                              : content.sections.filter(
                                  (s) => s !== section.id,
                                ),
                          })
                        }
                        className="accent-blue-600"
                      />
                      {section.label}
                    </label>
                  ))}
                </div>
                {content.activities.map((a, i) => (
                  <div
                    key={a.id}
                    className="mt-2 flex items-center gap-2 rounded-xl bg-white p-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{a.title}</span>
                    <button
                      aria-label={`${a.title} 위로`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="min-h-11 px-2 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`${a.title} 아래로`}
                      disabled={i === content.activities.length - 1}
                      onClick={() => move(i, 1)}
                      className="min-h-11 px-2 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() =>
                        setContent({
                          ...content,
                          activities: content.activities.filter(
                            (row) => row.id !== a.id,
                          ),
                        })
                      }
                      className="min-h-11 text-xs text-slate-500"
                    >
                      이 프로필에서 빼기
                    </button>
                  </div>
                ))}
                <p className="mt-3 text-xs leading-6 text-slate-400">
                  제목은 공개 화면에 표시되지 않습니다. 활동을 빼도 다모아
                  원본은 남습니다.
                </p>
              </section>
              {expert ? (
                <ExpertProfileView
                  expert={applyVersion(expert, content)}
                  galleryImages={[]}
                />
              ) : (
                <section className="rounded-2xl border border-slate-200 p-6">
                  <h2 className="text-xl font-bold">
                    {base?.display_name || "내 프로필"}
                  </h2>
                  <p className="mt-3 text-primary">{content.headline}</p>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {content.introduction}
                  </p>
                  <p className="mt-4 text-xs text-slate-400">
                    기본 프로필 공개 승인 전입니다.
                  </p>
                </section>
              )}
              <ProfileActivitySections activities={content.activities} />
            </div>
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
          <div className="my-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending || !title.trim()}
              onClick={save}
              className={primary}
            >
              {pending ? "처리 중…" : "비공개 저장"}
            </button>
            {id && (
              <button
                type="button"
                disabled={pending || !canPublish || changed}
                onClick={publish}
                className="min-h-12 rounded-xl border border-blue-200 px-5 text-sm font-semibold text-primary disabled:opacity-40"
              >
                공개 저장 / 대표프로필 설정
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setId(null);
                setTitle(`${title} 복사본`.slice(0, 80));
                setMessage(
                  "복사본입니다. 새 제목으로 저장하면 별도 프로필이 됩니다.",
                );
                setStep("write");
              }}
              className="min-h-12 px-3 text-sm text-slate-500"
            >
              복제하기
            </button>
          </div>
          {!canPublish && (
            <p className="text-xs leading-6 text-slate-400">
              비공개 저장은 가능하며 공개는 기본 프로필 승인 후 가능합니다.
            </p>
          )}
          {changed && id && (
            <p className="text-xs leading-6 text-slate-400">
              대표 선택과 변경사항 적용은 저장된 초안에만 적용됩니다. 먼저
              저장해주세요.
            </p>
          )}
        </>
      )}
    </div>
  );
}
