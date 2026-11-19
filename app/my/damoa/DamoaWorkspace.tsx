"use client";
import { useEffect, useRef, useState } from "react";
import { Gowun_Dodum } from "next/font/google";
import { DamoaLibrary } from "@/components/damoa/DamoaLibrary";
import { DamoaRecordForm } from "@/components/damoa/DamoaRecordForm";
import {
  Activity,
  CATEGORIES,
  STORAGE_LIMIT,
  fileBytes,
} from "@/lib/damoa/categories";
import { recordFormIssues, recordPeriod } from "@/lib/damoa/record-form";
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
const displayFont = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--damoa-gowun",
});
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
  const [draft, setDraft] = useState<Activity | null>(null);
  const [uploadOnly, setUploadOnly] = useState(false);
  const originalDraft = useRef("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
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
    if (draft && !draft.category) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [draft?.category, !!draft]);
  useEffect(() => {
    if (!draft || JSON.stringify(draft) === originalDraft.current) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);
  const used = serverUsed;
  function start(mode: "write" | "upload", category = "") {
    setFormError("");
    setUploadOnly(mode === "upload");
    const next: Activity = {
      owner,
      id: crypto.randomUUID(),
      category: mode === "upload" ? "other" : category,
      title: "",
      period: "",
      description: "",
      learning: "",
      link: "",
      memo: "",
      details: {},
      files: [],
      updated: "",
    };
    originalDraft.current = JSON.stringify(next);
    setDraft(next);
  }
  function edit(row: Activity) {
    setFormError("");
    setUploadOnly(!row.title.trim() && row.files.length > 0);
    originalDraft.current = JSON.stringify(row);
    setDraft(row);
  }
  function update(key: keyof Activity, value: string) {
    if (draft) setDraft({ ...draft, [key]: value });
  }
  function close() {
    if (saving) return;
    if (
      draft &&
      JSON.stringify(draft) !== originalDraft.current &&
      !window.confirm(
        "저장하지 않은 내용을 닫을까요? 저장된 원본 기록은 유지됩니다.",
      )
    )
      return;
    setDraft(null);
  }
  function attach(list: FileList | null) {
    if (!draft || !list || saving) return;
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
      const issues = recordFormIssues(draft, uploadOnly);
      if (issues.length) throw new Error(issues.join(" · "));
      const saved = {
        ...draft,
        title: draft.title.trim(),
        period: recordPeriod(draft),
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
    <div
      className={displayFont.variable}
      style={
        {
          "--font-profile-display": "var(--damoa-gowun), var(--font-sans)",
        } as React.CSSProperties
      }
    >
      {draft?.category ? (
        <DamoaRecordForm
          draft={draft}
          onChange={setDraft}
          onClose={close}
          onSave={save}
          onRemove={
            records.some((row) => row.id === draft.id) ? remove : undefined
          }
          onAttach={attach}
          saving={saving}
          ready={ready}
          uploadOnly={uploadOnly}
          error={formError}
        />
      ) : (
        <>
          <DamoaLibrary
            records={records}
            ready={ready}
            used={used}
            busy={migrating || maintenance || saving}
            onWrite={(category) => start("write", category)}
            onUpload={() => start("upload")}
            onEdit={edit}
            onCleanup={cleanup}
          >
            {ready && legacy.length > 0 && (
              <section
                aria-label="브라우저 기록 이전"
                className="mb-4 rounded-xl bg-blue-50 p-4 text-sm"
              >
                <p>
                  이 브라우저에만 있는 기존 기록 {legacy.length}건이 있습니다.
                </p>
                <p>
                  서버로 옮긴 뒤에도 브라우저 원본은 삭제하지 않습니다. 이미
                  옮긴 기록은 중복 저장하지 않습니다.
                </p>
                <button
                  type="button"
                  onClick={migrate}
                  disabled={migrating || maintenance}
                  className="min-h-11 text-primary"
                >
                  {migrating ? "서버로 옮기는 중…" : "기존 기록 서버로 옮기기"}
                </button>
              </section>
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
          </DamoaLibrary>
          <dialog
            ref={dialog}
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            aria-labelledby="damoa-category-heading"
            className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border-0 bg-white p-6 shadow-xl backdrop:bg-slate-950/30"
          >
            <header className="flex items-center justify-between gap-4">
              <h2 id="damoa-category-heading" className="text-xl">
                어떤 활동을 했나요?
              </h2>
              <button
                type="button"
                aria-label="작성창 닫기"
                onClick={close}
                className="min-h-11 min-w-11"
              >
                ×
              </button>
            </header>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => update("category", c.id)}
                  className="min-h-12 rounded-xl bg-slate-50 px-3 py-3 text-left text-sm hover:bg-blue-50 focus-visible:outline-blue-600"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
