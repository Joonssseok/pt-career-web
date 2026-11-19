"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import { formatActivityPeriod } from "@/lib/activity-period";
import {
  CATEGORIES,
  STORAGE_LIMIT,
  STORAGE_LIMIT_MB,
  type Activity,
  type Attachment,
} from "@/lib/damoa/categories";
import styles from "./DamoaLibrary.module.css";

export type DamoaLibraryProps = {
  records: Activity[];
  ready: boolean;
  used: number;
  busy: boolean;
  onWrite: (category?: string) => void;
  onUpload: () => void;
  onEdit: (row: Activity) => void;
  onCleanup: () => void;
  children?: ReactNode;
};

function useFileUrl(file: Attachment) {
  const [local, setLocal] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (file.path || !file.blob) return;
    const url = URL.createObjectURL(file.blob);
    setLocal({ blob: file.blob, url });
    return () => URL.revokeObjectURL(url);
  }, [file.path, file.blob]);
  return file.path
    ? `/api/damoa/files/${encodeURIComponent(file.id)}`
    : local?.blob === file.blob
      ? local?.url
      : undefined;
}

function Preview({ file, url }: { file: Attachment; url?: string }) {
  const [failed, setFailed] = useState<string>();
  return file.type.startsWith("image/") && url && failed !== url ? (
    <img src={url} alt="" loading="lazy" onError={() => setFailed(url)} />
  ) : (
    <span>
      {file.type.startsWith("image/")
        ? "사진"
        : file.type === "application/pdf"
          ? "PDF"
          : "문서"}
    </span>
  );
}

function Thumbnail({ files }: { files: Attachment[] }) {
  const file = files[0];
  const url = useFileUrl(file);
  return (
    <span className={styles.thumbnail} aria-hidden="true">
      <Preview file={file} url={url} />
      {files.length > 1 && (
        <span className={styles.more}>+{files.length - 1}</span>
      )}
    </span>
  );
}

function FileLink({ file, title }: { file: Attachment; title: string }) {
  const url = useFileUrl(file);
  return (
    <a
      className={styles.file}
      href={url}
      download={file.name}
      aria-disabled={!url}
    >
      <span className={styles.picture}>
        <Preview file={file} url={url} />
      </span>
      <strong title={file.name}>{file.name}</strong>
      <span title={title}>{title}</span>
      <span>
        {(file.size / 1024 / 1024).toFixed(2)}MB ·{" "}
        {url ? "다운로드" : "불러오는 중"}
      </span>
    </a>
  );
}

const normalize = (value: string) =>
  value.toLowerCase().replace(/[\s·ㆍ/]/g, "");

export function DamoaLibrary({
  records,
  ready,
  used,
  busy,
  onWrite,
  onUpload,
  onEdit,
  onCleanup,
  children,
}: DamoaLibraryProps) {
  const [view, setView] = useState<"records" | "files">("records");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [fileFilter, setFileFilter] = useState<"all" | "photos" | "docs">(
    "all",
  );
  useEffect(() => {
    const followHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "records" || hash === "files") setView(hash);
      else if (hash === "summary") setView("records");
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);

  const disabled = !ready || busy;
  const counts = new Map<string, number>();
  for (const row of records)
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  const selected =
    category !== "all" && counts.has(category) ? category : "all";
  const query = normalize(search);
  const visible = records.filter(
    (row) =>
      (selected === "all" || row.category === selected) &&
      normalize(
        [
          CATEGORIES.find((c) => c.id === row.category)?.name ?? row.category,
          row.title,
          row.period,
          row.description,
          ...Object.keys(row.details || {}),
          ...Object.values(row.details || {}),
          ...row.files.map((file) => file.name),
        ].join(" "),
      ).includes(query),
  );
  const files = visible
    .flatMap((row) =>
      row.files.map((file) => ({ file, title: row.title || "보관한 자료" })),
    )
    .filter(
      ({ file }) =>
        fileFilter === "all" ||
        (fileFilter === "photos"
          ? file.type.startsWith("image/")
          : !file.type.startsWith("image/")),
    );
  const totalFiles = records.reduce((sum, row) => sum + row.files.length, 0);
  const percent = Math.min(
    100,
    Math.max(0, ((Number.isFinite(used) ? used : 0) / STORAGE_LIMIT) * 100),
  );
  const storage = `${(Math.max(0, Number.isFinite(used) ? used : 0) / 1024 / 1024).toFixed(1)} / ${STORAGE_LIMIT_MB}MB`;
  const filtered =
    !!query || selected !== "all" || (view === "files" && fileFilter !== "all");
  const hasResults = view === "files" ? files.length > 0 : visible.length > 0;
  function switchView(next: "records" | "files") {
    setView(next);
    window.location.hash = next;
  }

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="다모아 보관함">
          <p className={styles.caption}>나만 보는 보관함</p>
          <h1>
            내활동 <span>다모아</span>
          </h1>
          <p className={styles.count}>
            {ready
              ? `기록 ${records.length}건 · 자료 ${totalFiles}개`
              : "기록·자료 확인 중"}
          </p>
          <div className={styles.storage}>
            <div>
              <span>저장 공간</span>
              <span>{ready ? storage : "확인 중"}</span>
            </div>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label="저장 공간 사용량"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ready ? percent : undefined}
              aria-valuetext={ready ? storage : "확인 중"}
            >
              <span style={{ width: ready ? `${percent}%` : "0%" }} />
            </div>
            <small>파일 한 개 10MB까지 · 모든 자료는 비공개</small>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={disabled}
              onClick={() => onWrite()}
            >
              활동 기록하기
            </button>
            <button type="button" disabled={disabled} onClick={onUpload}>
              자료만 올리기
            </button>
          </div>
          <h2 className={styles.categoryTitle}>분류</h2>
          <nav aria-label="기록 분류">
            <ul className={styles.categories}>
              <li>
                <button
                  type="button"
                  aria-pressed={selected === "all"}
                  onClick={() => setCategory("all")}
                >
                  전체 <span>{ready ? records.length : "확인 중"}</span>
                </button>
              </li>
              {ready &&
                CATEGORIES.filter((c) => counts.has(c.id)).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={selected === c.id}
                      onClick={() => setCategory(c.id)}
                    >
                      {c.name}
                      <span>{counts.get(c.id)}</span>
                    </button>
                  </li>
                ))}
              <li>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onWrite()}
                >
                  + 다른 분류 기록하기
                </button>
              </li>
            </ul>
          </nav>
          <button
            type="button"
            className={styles.cleanup}
            disabled={disabled}
            onClick={onCleanup}
          >
            {busy ? "처리 중…" : "사용하지 않는 업로드 정리"}
          </button>
        </aside>

        <div className={styles.content}>
          {children}
          <nav className={styles.tabs} aria-label="보관함 보기">
            <button
              type="button"
              aria-pressed={view === "records"}
              onClick={() => switchView("records")}
            >
              활동 기록{ready && <sup>{records.length}</sup>}
            </button>
            <button
              type="button"
              aria-pressed={view === "files"}
              onClick={() => switchView("files")}
            >
              보관 자료{ready && <sup>{totalFiles}</sup>}
            </button>
            <ComingSoonButton className={styles.soon}>
              AI 묶음 요약 <small>준비중</small>
            </ComingSoonButton>
          </nav>
          <label className={styles.search}>
            <span className={styles.srOnly}>기록·자료 검색</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="분류, 활동 이름, 내용, 파일 이름 검색"
            />
          </label>
          <div className={styles.current}>
            <span aria-live="polite">
              <b>{CATEGORIES.find((c) => c.id === selected)?.name ?? "전체"}</b>{" "}
              ·{" "}
              {ready
                ? `${view === "files" ? files.length : visible.length}${view === "files" ? "개" : "건"}`
                : "확인 중"}
            </span>
            {(selected !== "all" || search || fileFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setCategory("all");
                  setSearch("");
                  setFileFilter("all");
                }}
              >
                전체 보기
              </button>
            )}
          </div>
          {view === "files" && (
            <div className={styles.filters} aria-label="자료 종류">
              {(
                [
                  ["all", "전체"],
                  ["photos", "사진"],
                  ["docs", "문서"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={fileFilter === value}
                  onClick={() => setFileFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {!ready ? (
            <p className={styles.empty} role="status">
              기록·자료를 불러오는 중입니다. 불러오지 못한 경우 위 안내를
              확인해주세요.
            </p>
          ) : hasResults ? (
            view === "files" ? (
              <div className={styles.grid}>
                {files.map(({ file, title }, index) => (
                  <FileLink
                    key={`${file.id}-${index}`}
                    file={file}
                    title={title}
                  />
                ))}
              </div>
            ) : (
              CATEGORIES.map((c) => {
                const rows = visible.filter((row) => row.category === c.id);
                if (!rows.length) return null;
                return (
                  <section
                    key={c.id}
                    className={styles.section}
                    aria-label={c.name}
                  >
                    <h2>
                      {c.name} <span>{rows.length}건</span>
                    </h2>
                    <ul className={styles.list}>
                      {rows.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            className={styles.row}
                            disabled={disabled}
                            onClick={() => onEdit(row)}
                          >
                            <span className={styles.rowText}>
                              <strong>{row.title || "보관한 자료"}</strong>
                              <span className={styles.meta}>
                                <span
                                  className={
                                    !row.period ? styles.missing : undefined
                                  }
                                >
                                  {formatActivityPeriod(row.period) ||
                                    "기간을 적어 주세요"}
                                </span>{" "}
                                · 첨부 {row.files.length}개
                              </span>
                              {row.description && (
                                <span className={styles.description}>
                                  {row.description}
                                </span>
                              )}
                            </span>
                            {row.files.length > 0 && (
                              <Thumbnail files={row.files} />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={styles.add}
                      disabled={disabled}
                      onClick={() => onWrite(c.id)}
                    >
                      + {c.name} 추가하기
                    </button>
                  </section>
                );
              })
            )
          ) : (
            <section className={styles.empty}>
              <h2>
                {filtered
                  ? "조건에 맞는 기록이 없어요"
                  : view === "files"
                    ? "사진 한 장부터 모아보세요"
                    : "오늘의 작은 경험부터 남겨보세요"}
              </h2>
              <p>
                {filtered
                  ? "검색어나 분류를 바꿔보세요."
                  : "수업 과제, 하루의 봉사, 짧은 교육도 좋아요."}
              </p>
              {!filtered && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => (view === "files" ? onUpload() : onWrite())}
                >
                  {view === "files" ? "첫 자료 올리기" : "첫 활동 기록하기"} →
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
