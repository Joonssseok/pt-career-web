"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Attachment,
  CATEGORIES,
  STORAGE_LIMIT,
  fileBytes,
} from "@/lib/damoa/categories";
import {
  deleteActivity,
  loadActivities,
  saveActivity,
  loadFileUsage,
  importBrowserActivities,
  cleanupUnusedFiles,
  FILE_LIMIT,
  pendingBrowserActivities,
} from "@/lib/damoa/server-store";
import { loadActivities as loadBrowserActivities } from "@/lib/damoa/browser-store";

type View = "records" | "files" | "summary";
const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const primaryClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50";
const secondaryClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-primary";
const groups = [...new Set(CATEGORIES.map((c) => c.group))];
function Icon({
  kind = "plus",
  className = "h-5 w-5",
}: {
  kind?: "plus" | "folder" | "upload" | "spark" | "lock" | "search";
  className?: string;
}) {
  const paths = {
    plus: "M12 5v14M5 12h14",
    folder: "M3 7V5h7l2 3h9v12H3V7Z",
    upload: "M12 16V3m-4 4 4-4 4 4M4 14v7h16v-7",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
    lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Z",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  };
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
function FileLink({ file }: { file: Attachment }) {
  const [localUrl, setLocalUrl] = useState("");
  useEffect(() => {
    if (!file.blob) return;
    const value = URL.createObjectURL(file.blob);
    setLocalUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file.blob]);
  const url = file.path ? `/api/damoa/files/${file.id}` : localUrl;
  return (
    <a
      href={url || undefined}
      aria-disabled={!url}
      download={file.name}
      className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:border-blue-200"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-primary">
        {file.type.startsWith("image/") && url ? (
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon kind="folder" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-700">
          {file.name}
        </span>
        <span className="text-xs text-slate-400">
          {(file.size / 1024 / 1024).toFixed(2)}MB ·{" "}
          {url ? "다운로드" : "불러오는 중"}
        </span>
      </span>
    </a>
  );
}
export function DamoaWorkspace({ owner }: { owner: string }) {
  const [records, setRecords] = useState<Activity[]>([]);
  const [ready, setReady] = useState(false);
  const [serverUsed, setServerUsed] = useState(0);
  const [legacy, setLegacy] = useState<Activity[]>([]);
  const [migrating, setMigrating] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  async function refresh() {
    const [rows, bytes] = await Promise.all([
      loadActivities(owner),
      loadFileUsage(owner),
    ]);
    setRecords(rows);
    setServerUsed(bytes);
    return rows;
  }
  async function migrate() {
    setMigrating(true);
    setLoadError("");
    try {
      const count = await importBrowserActivities(owner, legacy);
      await refresh();
      setLegacy(await pendingBrowserActivities(owner, legacy));
      setNotice(
        `${count}건을 서버에서 확인했습니다. 브라우저 원본은 그대로 유지됩니다.`,
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "이전에 실패했습니다. 다시 시도해주세요.",
      );
      await refresh().catch(() => {});
    } finally {
      setMigrating(false);
    }
  }
  async function cleanup() {
    if (
      !window.confirm(
        "기록에 저장되지 않은 업로드 자료를 정리할까요? 다른 창에서 작성 중인 첨부 자료도 포함될 수 있습니다.",
      )
    )
      return;
    setMaintenance(true);
    setLoadError("");
    try {
      await cleanupUnusedFiles(owner);
      await refresh();
      setNotice("기록에 사용하지 않는 업로드 자료를 정리했습니다.");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "자료를 정리하지 못했습니다.",
      );
    } finally {
      setMaintenance(false);
    }
  }
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("records");
  useEffect(() => {
    const followMenu = () => {
      const target = window.location.hash.slice(1);
      if (target === "records" || target === "files" || target === "summary")
        setView(target);
    };
    followMenu();
    window.addEventListener("hashchange", followMenu);
    return () => window.removeEventListener("hashchange", followMenu);
  }, []);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Activity | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [detailed, setDetailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      loadActivities(owner),
      loadFileUsage(owner),
      loadBrowserActivities(owner)
        .catch(() => {
          if (active)
            setNotice(
              "이 브라우저의 기존 기록을 읽지 못했습니다. 브라우저 저장소 허용 여부를 확인해주세요. 서버 기록은 정상적으로 이용할 수 있습니다.",
            );
          return [] as Activity[];
        })
        .then((rows) => pendingBrowserActivities(owner, rows)),
    ])
      .then(([rows, bytes, local]) => {
        if (active) {
          setRecords(rows);
          setServerUsed(bytes);
          setLegacy(local);
          setReady(true);
        }
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      });
    return () => {
      active = false;
    };
  }, [owner]);
  useEffect(() => {
    if (draft && !dialog.current?.open) dialog.current?.showModal();
    if (!draft) dialog.current?.close();
  }, [draft]);
  const used = serverUsed;
  const category = CATEGORIES.find((c) => c.id === draft?.category);
  const visible = records.filter(
    (row) =>
      (filter === "all" || row.category === filter) &&
      `${row.title} ${row.description} ${CATEGORIES.find((c) => c.id === row.category)?.name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const files = visible.flatMap((row) =>
    row.files.map((file) => ({ file, title: row.title || "보관한 자료" })),
  );
  function start(mode: "write" | "upload") {
    setFormError("");
    setCategorySearch("");
    setDetailed(false);
    setDraft({
      owner,
      id: crypto.randomUUID(),
      category: mode === "upload" ? "other" : "",
      title: "",
      period: "",
      description: "",
      learning: "",
      link: "",
      memo: "",
      details: {},
      files: [],
      updated: "",
    });
  }
  function update(key: keyof Activity, value: string) {
    if (draft) setDraft({ ...draft, [key]: value });
  }
  function close() {
    if (saving) return;
    if (
      draft &&
      (draft.title ||
        draft.description ||
        draft.files.length ||
        Object.values(draft.details).some(Boolean)) &&
      !window.confirm(
        "저장하지 않은 내용을 닫을까요? 저장된 원본 기록은 유지됩니다.",
      )
    )
      return;
    setDraft(null);
  }
  function attach(list: FileList | null) {
    if (!draft || !list) return;
    if ([...list].some((file) => file.size > FILE_LIMIT)) {
      setFormError("파일은 한 개당 10MB 이하로 첨부해주세요.");
      return;
    }
    const accepted = [...list].filter((file) =>
      ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      ),
    );
    const additions = accepted.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      blob: file,
    }));
    const total =
      used -
      fileBytes(records.filter((r) => r.id === draft.id)) +
      fileBytes([{ ...draft, files: [...draft.files, ...additions] }]);
    if (total > STORAGE_LIMIT) {
      setFormError("첨부하면 100MB를 초과합니다. 파일 수나 크기를 줄여주세요.");
      return;
    }
    setDraft({ ...draft, files: [...draft.files, ...additions] });
    setFormError(
      accepted.length !== list.length
        ? "JPG·PNG·WebP·PDF만 첨부할 수 있습니다."
        : "",
    );
  }
  async function remove() {
    if (
      !draft ||
      saving ||
      !window.confirm(
        "서버에서 이 기록을 삭제할까요? 첨부 자료도 정리되며 복구할 수 없습니다.",
      )
    )
      return;
    setSaving(true);
    try {
      await deleteActivity(owner, draft.id, draft.revision);
      let remaining = false;
      await cleanupUnusedFiles(owner, draft.id).catch(() => {
        remaining = true;
      });
      await refresh();
      setDraft(null);
      setNotice(
        remaining
          ? "기록은 삭제했지만 첨부 자료 정리가 남았습니다. 업로드 정리 버튼으로 다시 시도해주세요."
          : "서버에서 기록과 첨부 자료를 삭제했습니다.",
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "삭제하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !ready || saving) return;
    setSaving(true);
    setFormError("");
    try {
      const saved = {
        ...draft,
        title: draft.title.trim(),
        updated: new Date().toISOString(),
      };
      await saveActivity(saved);
      await refresh();
      setDraft(null);
      setNotice("계정의 서버 저장소에 비공개로 저장했습니다.");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "저장하지 못했습니다. 다시 시도해주세요.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <Icon kind="lock" className="h-3.5 w-3.5" /> 나만의 비공개 기록함
        </span>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-medium text-primary">
          서버 보관
        </span>
      </div>
      <header className="relative overflow-hidden border-b border-slate-100 pb-9">
        <svg
          aria-hidden="true"
          viewBox="0 0 700 190"
          className="pointer-events-none absolute -right-20 bottom-1 -z-0 w-[75%] text-blue-100/70"
        >
          <path
            d="M0 180C160 180 130 120 290 120S450 30 700 20M0 188C140 188 210 150 350 150S520 55 700 65"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary">
            MY ACTIVITY COLLECTION
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            내활동 <span className="text-primary">다모아</span>
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            작은 경험도, 한 장의 자료도.
            <br />
            차곡차곡 모으면 나를 보여주는 이력이 됩니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!ready || migrating || maintenance}
              onClick={() => start("write")}
              className={primaryClass}
            >
              <Icon /> 활동 기록하기
            </button>
            <button
              type="button"
              disabled={!ready || migrating || maintenance}
              onClick={() => start("upload")}
              className={secondaryClass}
            >
              <Icon kind="upload" /> 자료 올리기
            </button>
          </div>
        </div>
      </header>
      <div className="my-5 flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          로그인한 계정에 비공개로 보관됩니다. 브라우저 데이터를 지워도 서버
          기록은 유지됩니다. AI 분석은 준비 중입니다.
        </p>
        <div className="shrink-0">
          <span>{(used / 1024 / 1024).toFixed(1)} / 100MB</span>
          <div
            role="progressbar"
            aria-label="첨부 자료 사용량"
            aria-valuenow={Math.round((used / STORAGE_LIMIT) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-1 h-1 w-28 overflow-hidden rounded bg-slate-200"
          >
            <div
              className="h-full rounded bg-primary"
              style={{ width: `${(used / STORAGE_LIMIT) * 100}%` }}
            />
          </div>
        </div>
      </div>
      {ready && legacy.length > 0 && (
        <section
          className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-600"
          aria-label="브라우저 기록 이전"
        >
          <p>이 브라우저에만 있는 기존 기록 {legacy.length}건이 있습니다.</p>
          <p className="mt-1 text-xs">
            서버로 옮긴 뒤에도 브라우저 원본은 삭제하지 않습니다. 이미 옮긴
            기록은 중복 저장하지 않습니다.
          </p>
          <button
            type="button"
            onClick={migrate}
            disabled={migrating || maintenance}
            className="mt-3 min-h-11 font-semibold text-primary"
          >
            {migrating ? "서버로 옮기는 중…" : "기존 기록 서버로 옮기기"}
          </button>
        </section>
      )}
      {ready && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            파일당 최대 10MB · 개인당 100MB · 업로드 중에는 10MB를 임시
            확보합니다.
          </span>
          <button
            type="button"
            onClick={cleanup}
            disabled={maintenance || migrating || saving || !!draft}
            className="min-h-11 text-slate-500"
          >
            {maintenance ? "정리 중…" : "사용하지 않는 업로드 정리"}
          </button>
        </div>
      )}
      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {loadError}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 text-sm text-primary">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
        <div className="flex gap-5" role="group" aria-label="기록 보기">
          {(
            [
              ["records", "활동 기록", records.length],
              [
                "files",
                "보관 자료",
                records.reduce((n, r) => n + r.files.length, 0),
              ],
              ["summary", "AI 묶음 요약", null],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`min-h-14 border-b-2 text-sm font-semibold ${view === key ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-700"}`}
            >
              {label}
              {count !== null && (
                <span className="ml-1.5 text-xs">{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {view === "summary" ? (
        <section className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/30 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Icon kind="spark" />
            <h2 className="text-lg font-bold text-slate-900">
              쌓인 경험을 한눈에 보여주는 이력으로
            </h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            관련 기록을 모아 한 줄로 제안하고, 포함할 활동과 표현은 직접 고르는
            기능을 준비하고 있습니다.
          </p>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-400">
              기능 예시 · 실제 내 기록을 분석한 결과가 아닙니다
            </p>
            <p className="mt-3 font-bold text-slate-800">
              지역사회 운동 지도 등 봉사활동 30건
            </p>
            <p className="mt-2 text-sm text-slate-500">
              원본은 유지하고, 묶음에 포함할 활동을 확인한 뒤 프로필에
              추가합니다.
            </p>
          </div>
          <p className="mt-5 text-xs leading-6 text-slate-500">
            AI 입력 보조·묶음 추천은 아직 연결되지 않았습니다. 외부 AI로 자료를
            전송하지 않습니다.
          </p>
        </section>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">기록 검색</span>
              <span className="pointer-events-none absolute left-4 top-3.5 text-slate-400">
                <Icon kind="search" className="h-4 w-4" />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="활동 이름이나 내용으로 찾아보세요"
                className={`${inputClass} mt-0 pl-11`}
              />
            </label>
            <label>
              <span className="sr-only">카테고리 필터</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={`${inputClass} mt-0 sm:w-44`}
              >
                <option value="all">전체 카테고리</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!ready && !loadError && (
            <p
              role="status"
              className="py-12 text-center text-sm text-slate-500"
            >
              기록함을 불러오고 있습니다.
            </p>
          )}
          {ready &&
          (view === "files" ? files.length > 0 : visible.length > 0) ? (
            view === "files" ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {files.map(({ file, title }) => (
                  <div key={file.id}>
                    <FileLink file={file} />
                    <p className="mt-1 px-3 text-xs text-slate-400">{title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {visible.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setDetailed(false);
                      setDraft(row);
                    }}
                    className="group w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-primary">
                          {CATEGORIES.find((c) => c.id === row.category)?.name}
                        </span>
                        <h2 className="mt-2 break-words text-base font-bold text-slate-900">
                          {row.title || "보관한 자료"}
                        </h2>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        수정 →
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {row.period || "기간 미입력"} · 첨부 {row.files.length}개
                      · 비공개
                    </p>
                    {row.description && (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                        {row.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )
          ) : (
            ready && (
              <section className="py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-400">
                  <Icon kind="folder" className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-slate-800">
                  {search || filter !== "all"
                    ? "조건에 맞는 기록이 없어요"
                    : view === "files"
                      ? "사진 한 장부터 모아보세요"
                      : "오늘의 작은 경험부터 남겨보세요"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  {search || filter !== "all"
                    ? "검색어나 카테고리를 바꿔보세요."
                    : "수업 과제, 하루의 봉사, 짧은 교육도 좋아요."}
                </p>
                {!search && filter === "all" && (
                  <button
                    type="button"
                    onClick={() => start(view === "files" ? "upload" : "write")}
                    className="mt-4 min-h-11 text-sm font-semibold text-primary"
                  >
                    {view === "files" ? "첫 자료 올리기" : "첫 활동 기록하기"} →
                  </button>
                )}
              </section>
            )
          )}
          <section className="mt-5 border-t border-slate-100 pt-7">
            <h2 className="text-sm font-bold text-slate-700">
              어떤 경험을 모아볼까요?
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {groups
                .filter((g) => g !== "새로운 경험")
                .map((group) => (
                  <button
                    key={group}
                    type="button"
                    disabled={!ready || migrating || maintenance}
                    onClick={() => {
                      start("write");
                      setCategorySearch(group);
                    }}
                    className="rounded-xl bg-slate-50/80 p-4 text-left transition hover:bg-blue-50"
                  >
                    <span className="text-sm font-semibold text-slate-700">
                      {group}{" "}
                      <span className="float-right text-blue-400">↗</span>
                    </span>
                    <span className="mt-2 block text-xs leading-6 text-slate-400">
                      {CATEGORIES.filter((c) => c.group === group)
                        .map((c) => c.name)
                        .join(" · ")}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        </>
      )}
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-xl backdrop:bg-slate-950/30"
      >
        {draft && (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-semibold text-primary">
                  내활동 다모아
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {category ? "경험을 기록하세요" : "어떤 활동을 했나요?"}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-400 sm:text-xs">
                  <Icon kind="lock" className="h-3.5 w-3.5" />
                  나만 보는 기록
                </span>
                <button
                  type="button"
                  aria-label="작성창 닫기"
                  onClick={close}
                  disabled={saving}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-50"
                >
                  ×
                </button>
              </div>
            </div>
            {!category ? (
              <div className="p-6">
                <p className="text-sm leading-6 text-slate-500">
                  가까운 카테고리를 골라주세요. 나중에 변경할 수 있어요.
                </p>
                <label>
                  <span className="sr-only">카테고리 검색</span>
                  <input
                    autoFocus
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="봉사, 해외 연수, 수상…"
                    className={inputClass}
                  />
                </label>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {CATEGORIES.filter((c) =>
                    `${c.name} ${c.group} ${c.id === "award" ? "대회 수상 수상 내역" : c.id === "education" ? "해외 연수 워크숍 세미나" : c.id === "volunteer" ? "재능기부" : ""}`
                      .replace(/\s/g, "")
                      .includes(categorySearch.replace(/\s/g, "")),
                  ).map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => update("category", c.id)}
                      className="min-h-16 rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50"
                    >
                      <span className="block text-sm font-semibold text-slate-700">
                        {c.name}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {c.group}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => update("category", "other")}
                  className="mt-5 min-h-11 text-sm font-semibold text-primary"
                >
                  맞는 카테고리가 없나요? 새 분류 제안하기 →
                </button>
              </div>
            ) : (
              <form onSubmit={save} className="space-y-5 p-6">
                <label className="block text-sm font-medium text-slate-600">
                  카테고리
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value })
                    }
                    className={inputClass}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  활동 이름{" "}
                  <span className="font-normal text-slate-400">
                    · 자료만 보관할 때는 생략 가능
                  </span>
                  <input
                    autoFocus
                    maxLength={150}
                    value={draft.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder={
                      draft.category === "volunteer"
                        ? "예: 복지관 어르신 운동 프로그램 보조"
                        : "어떤 경험인지 짧게 적어주세요"
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  날짜·기간{" "}
                  <span className="font-normal text-slate-400">· 선택</span>
                  <input
                    maxLength={100}
                    value={draft.period}
                    onChange={(e) => update("period", e.target.value)}
                    placeholder="예: 2026. 10. 24. / 2025–현재 / 2024년"
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  짧은 기록
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={draft.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="무엇을 했나요? 한 문장으로 시작해도 좋아요."
                    className={inputClass}
                  />
                </label>
                <div>
                  <p className="text-sm font-medium text-slate-600">
                    사진·자료
                  </p>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => {
                      attach(e.target.files);
                      e.target.value = "";
                    }}
                    className="sr-only"
                    aria-label="사진 또는 PDF 첨부"
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="mt-2 flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/30 text-sm text-primary"
                  >
                    <Icon kind="upload" /> 사진·자료 선택
                  </button>
                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    JPG·PNG·WebP·PDF · 파일당 10MB · 모든 자료는 비공개
                    <br />
                    저장 버튼을 누르면 서버에 보관됩니다. 중요한 원본은 별도로
                    보관해주세요.
                  </p>
                  {draft.files.map((file) => (
                    <div key={file.id} className="mt-2 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            files: draft.files.filter((f) => f.id !== file.id),
                          })
                        }
                        className="min-h-11 px-2 text-xs text-slate-500"
                        aria-label={`${file.name} 첨부 해제`}
                      >
                        첨부 해제
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  aria-expanded={detailed}
                  onClick={() => setDetailed(!detailed)}
                  className="min-h-11 text-sm font-semibold text-primary"
                >
                  {detailed ? "− 자세한 기록 접기" : "+ 자세히 기록하기"}
                </button>
                {detailed && (
                  <div className="space-y-4 rounded-xl bg-slate-50 p-4">
                    {category.fields.map((field) => (
                      <label
                        key={field}
                        className="block text-sm text-slate-600"
                      >
                        {field}
                        <input
                          maxLength={1000}
                          value={draft.details[field] || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              details: {
                                ...draft.details,
                                [field]: e.target.value,
                              },
                            })
                          }
                          className={inputClass}
                        />
                      </label>
                    ))}
                    <label className="block text-sm text-slate-600">
                      배운 점·결과
                      <textarea
                        maxLength={5000}
                        value={draft.learning}
                        onChange={(e) => update("learning", e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm text-slate-600">
                      관련 링크
                      <input
                        type="url"
                        maxLength={2000}
                        value={draft.link}
                        onChange={(e) => update("link", e.target.value)}
                        placeholder="https://"
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm text-slate-600">
                      개인 메모 · 나만 보기
                      <textarea
                        maxLength={5000}
                        value={draft.memo}
                        onChange={(e) => update("memo", e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                )}
                {draft.category === "other" && (
                  <p className="text-xs leading-6 text-slate-500">
                    새 분류 제안은 기록과 함께 비공개로 보관됩니다. 운영자에게
                    제출하거나 통합하는 기능은 아직 연결되지 않았습니다.
                  </p>
                )}
                <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs leading-6 text-blue-700">
                  AI 입력 보조 준비 중 · 현재는 자료를 분석하거나 외부 AI에
                  전송하지 않습니다.
                </p>
                {formError && (
                  <p role="alert" className="text-sm text-red-600">
                    {formError}
                  </p>
                )}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div>
                    {" "}
                    {records.some((row) => row.id === draft.id) && (
                      <button
                        type="button"
                        onClick={remove}
                        disabled={saving}
                        className="min-h-11 text-xs text-red-500"
                      >
                        기록 삭제
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={saving || !ready}
                    className={primaryClass}
                  >
                    {saving ? "저장 중…" : "비공개로 저장"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
