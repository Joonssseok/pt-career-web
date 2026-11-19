"use client";

import { useRef, type FormEvent } from "react";
import { Activity, CATEGORIES, DATE_DETAIL_KEYS } from "@/lib/damoa/categories";
import {
  getRecordFormConfig,
  recordFormIssues,
  recordPeriod,
  getPeriodMonths,
} from "@/lib/damoa/record-form";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import styles from "./DamoaRecordForm.module.css";

export function DamoaRecordForm({
  draft,
  onChange,
  onClose,
  onSave,
  onRemove,
  onAttach,
  saving,
  ready,
  uploadOnly,
  error,
}: {
  draft: Activity;
  onChange: (value: Activity) => void;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
  onRemove?: () => void;
  onAttach: (files: FileList | null) => void;
  saving: boolean;
  ready: boolean;
  uploadOnly: boolean;
  error: string;
}) {
  const config = getRecordFormConfig(draft.category);
  const input = useRef<HTMLInputElement>(null);
  const issues = recordFormIssues(draft, uploadOnly);
  const ongoing = draft.details[DATE_DETAIL_KEYS.ongoing] === "true";
  const start = draft.details[DATE_DETAIL_KEYS.start] || "";
  const end = draft.details[DATE_DETAIL_KEYS.end] || "";
  const months = getPeriodMonths(
    start,
    ongoing ? new Date().toLocaleDateString("sv-SE").slice(0, 7) : end,
  );
  const structured = Object.values(DATE_DETAIL_KEYS).some((key) =>
    Object.prototype.hasOwnProperty.call(draft.details, key),
  );
  const detail = (key: string, value: string) =>
    onChange({ ...draft, details: { ...draft.details, [key]: value } });
  const change = (key: keyof Activity, value: string) =>
    onChange({ ...draft, [key]: value });
  const knownKeys = new Set([
    ...(uploadOnly ? ["지역", "주관"] : []),
    config.secondaryKey,
    config.statusKey,
    ...config.extraFields,
    "기관·회사명",
    "학교명",
    "담당 업무",
    ...Object.values(DATE_DETAIL_KEYS),
  ]);
  const extraFields = Array.from(
    new Set([
      ...config.extraFields,
      ...Object.keys(draft.details).filter(
        (key) => !knownKeys.has(key) && key !== "재직 상태",
      ),
    ]),
  ).filter(
    (key) =>
      key !== config.secondaryKey &&
      key !== config.statusKey &&
      key !== "주소·지도 공개" &&
      key !== "취득일",
  );
  const field = (
    label: string,
    key: string,
    value: string,
    handler: (value: string) => void,
    placeholder = "",
    required = false,
    multiline = false,
  ) => (
    <label className={styles.field} key={key}>
      {label}
      {required && <span aria-hidden="true"> *</span>}
      {multiline ? (
        <textarea
          rows={4}
          maxLength={5000}
          value={value}
          onChange={(e) => handler(e.target.value)}
          disabled={saving}
          placeholder={placeholder}
        />
      ) : (
        <input
          autoFocus={key === "title"}
          maxLength={key === "title" ? 150 : 1000}
          value={value}
          onChange={(e) => handler(e.target.value)}
          disabled={saving}
          placeholder={placeholder}
        />
      )}
    </label>
  );
  function monthField(
    label: string,
    key: string,
    value: string,
    disabled = false,
  ) {
    const [year = "", month = ""] = value.split("-");
    const thisYear = new Date().getFullYear();
    const years = Array.from(
      new Set([
        ...(year ? [year] : []),
        ...Array.from({ length: 131 }, (_, i) => String(thisYear + 10 - i)),
      ]),
    );
    return (
      <fieldset className={styles.monthField} disabled={saving || disabled}>
        <legend>{label} *</legend>
        <div>
          <select
            aria-label={`${label} 연도`}
            value={year}
            onChange={(e) =>
              detail(
                key,
                e.target.value || month ? `${e.target.value}-${month}` : "",
              )
            }
          >
            <option value="">연도</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select
            aria-label={`${label} 월`}
            value={month}
            onChange={(e) =>
              detail(
                key,
                year || e.target.value ? `${year}-${e.target.value}` : "",
              )
            }
          >
            <option value="">월</option>
            {Array.from({ length: 12 }, (_, i) =>
              String(i + 1).padStart(2, "0"),
            ).map((m) => (
              <option key={m} value={m}>
                {Number(m)}월
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    );
  }
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <p>나만 보는 기록</p>
          <h1>{uploadOnly ? "자료만 올리기" : `${config.name} 기록하기`}</h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="작성창 닫기"
        >
          닫기 ×
        </button>
      </header>
      {!uploadOnly && (
        <nav aria-label="기록 분류" className={styles.categories}>
          {CATEGORIES.filter((c) =>
            ["career", "academic", "license", "education"].includes(c.id),
          ).map((c) => (
            <button
              type="button"
              key={c.id}
              disabled={saving}
              aria-pressed={c.id === draft.category}
              onClick={() => change("category", c.id)}
            >
              {c.name}
            </button>
          ))}
          <label>
            <span className="sr-only">다른 활동 분류</span>
            <select
              disabled={saving}
              value={
                ["career", "academic", "license", "education"].includes(
                  draft.category,
                )
                  ? ""
                  : draft.category
              }
              onChange={(e) => {
                if (e.target.value) change("category", e.target.value);
              }}
            >
              <option value="">다른 활동</option>
              {CATEGORIES.filter(
                (c) =>
                  !["career", "academic", "license", "education"].includes(
                    c.id,
                  ),
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </nav>
      )}
      <div className={styles.layout}>
        <aside className={styles.preview} aria-label="기록 미리보기">
          <p>{config.name}</p>
          <h2>{draft.title || config.titleLabel}</h2>
          <p>{draft.details[config.secondaryKey] || config.secondaryLabel}</p>
          <p>{recordPeriod(draft) || "기간을 골라주세요"}</p>
          {draft.description && (
            <p className={styles.previewDescription}>{draft.description}</p>
          )}
          <small>
            {issues.length
              ? `남은 칸: ${issues.join(" · ")}`
              : "저장할 준비가 되었어요"}
          </small>
          {draft.category === "career" && ongoing && (
            <div className={styles.place}>
              <p>근무지 위치 (선택)</p>
              <ComingSoonButton>
                지도에서 근무지 찾기 · 추후 연결
              </ComingSoonButton>
            </div>
          )}
        </aside>
        <form onSubmit={onSave} className={styles.form}>
          <fieldset disabled={saving} className={styles.paper}>
            <section>
              <h2>{uploadOnly ? "어떤 자료인가요?" : config.questions[0]}</h2>
              {field(
                uploadOnly ? "활동 이름 · 선택" : config.titleLabel,
                "title",
                draft.title,
                (v) => change("title", v),
                uploadOnly
                  ? "어떤 경험인지 짧게 적어주세요"
                  : config.titlePlaceholder,
                !uploadOnly,
              )}
              {!uploadOnly &&
                field(
                  config.secondaryLabel,
                  config.secondaryKey,
                  draft.details[config.secondaryKey] || "",
                  (v) => detail(config.secondaryKey, v),
                  config.secondaryPlaceholder,
                  true,
                )}
            </section>
            <section>
              <h2>{uploadOnly ? "덧붙일 정보 (선택)" : config.questions[1]}</h2>
              {uploadOnly ? (
                <>
                  {field("지역", "지역", draft.details["지역"] || "", (v) =>
                    detail("지역", v),
                  )}
                  {field("주관", "주관", draft.details["주관"] || "", (v) =>
                    detail("주관", v),
                  )}
                  <label className={styles.field}>
                    날짜·기간 · 선택
                    <input
                      maxLength={100}
                      value={draft.period}
                      onChange={(e) => change("period", e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  {!structured && (draft.period || draft.details["취득일"]) && (
                    <p className={styles.legacy}>
                      전에 적은 기간: {draft.period || draft.details["취득일"]}
                      <small>새 기간을 고르기 전까지 그대로 유지됩니다.</small>
                    </p>
                  )}
                  <div className={styles.dates}>
                    {monthField(
                      config.dateMode === "one" ? "취득 연·월" : "시작",
                      DATE_DETAIL_KEYS.start,
                      start,
                    )}
                    {config.dateMode !== "one" &&
                      monthField("종료", DATE_DETAIL_KEYS.end, end, ongoing)}
                  </div>
                  {config.dateMode !== "one" && (
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={ongoing}
                        onChange={(e) =>
                          onChange({
                            ...draft,
                            details: {
                              ...draft.details,
                              [DATE_DETAIL_KEYS.ongoing]: String(
                                e.target.checked,
                              ),
                              ...(draft.category === "career"
                                ? {
                                    "재직 상태": e.target.checked
                                      ? "재직 중"
                                      : "종료",
                                  }
                                : {}),
                            },
                          })
                        }
                      />
                      {config.ongoingLabel}
                    </label>
                  )}
                  {config.dateMode !== "one" &&
                    months !== null &&
                    months > 0 && (
                      <p className={styles.duration}>
                        {config.durationLabel}{" "}
                        {Math.floor(months / 12)
                          ? `${Math.floor(months / 12)}년 `
                          : ""}
                        {months % 12 ? `${months % 12}개월` : ""}
                      </p>
                    )}
                </>
              )}
            </section>
            <section>
              <h2>
                {uploadOnly
                  ? "짧은 기록 (선택)"
                  : `${config.questions[2]} (선택)`}
              </h2>
              {!uploadOnly && config.statusKey && (
                <fieldset className={styles.options}>
                  <legend>{config.statusLabel}</legend>
                  {Array.from(
                    new Set([
                      ...(config.statusOptions || []),
                      ...(draft.details[config.statusKey]
                        ? [draft.details[config.statusKey]]
                        : []),
                    ]),
                  ).map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={draft.details[config.statusKey!] === value}
                      onClick={() =>
                        detail(
                          config.statusKey!,
                          draft.details[config.statusKey!] === value
                            ? ""
                            : value,
                        )
                      }
                    >
                      {value}
                    </button>
                  ))}
                </fieldset>
              )}
              {field(
                config.descriptionLabel,
                "description",
                draft.description || draft.details["담당 업무"] || "",
                (v) =>
                  onChange({
                    ...draft,
                    description: v,
                    details: {
                      ...draft.details,
                      ...(Object.prototype.hasOwnProperty.call(
                        draft.details,
                        "담당 업무",
                      )
                        ? { "담당 업무": v }
                        : {}),
                    },
                  }),
                config.descriptionPlaceholder,
                false,
                true,
              )}
            </section>
            <section>
              <h2>증빙 자료가 있나요? (선택)</h2>
              <input
                ref={input}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                aria-label="사진 또는 PDF 첨부"
                className="sr-only"
                onChange={(e) => {
                  onAttach(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className={styles.upload}
                disabled={saving}
                onClick={() => input.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!saving) onAttach(e.dataTransfer.files);
                }}
              >
                사진·자료 선택
                <small>{config.fileLabel} · 클릭하거나 끌어놓으세요.</small>
              </button>
              <p className={styles.hint}>
                JPG·PNG·WebP·PDF · 파일당 10MB · 모든 자료는 비공개
              </p>
              <p className={styles.hint}>
                자료가 있으면 나중에 인증 표시를 받을 때 쓸 수 있어요.
              </p>
              {draft.files.map((file) => (
                <div className={styles.attachment} key={file.id}>
                  <span>{file.name}</span>
                  <button
                    type="button"
                    aria-label={`${file.name} 첨부 해제`}
                    onClick={() =>
                      onChange({
                        ...draft,
                        files: draft.files.filter((f) => f.id !== file.id),
                      })
                    }
                  >
                    첨부 해제
                  </button>
                </div>
              ))}
            </section>
            <details className={styles.more}>
              <summary>
                더 적기 <small>추가 정보 · 배운 점 · 링크 · 메모</small>
              </summary>
              {extraFields.map((key) =>
                field(key, key, draft.details[key] || "", (v) =>
                  detail(key, v),
                ),
              )}
              {draft.category === "career" && (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.details["주소·지도 공개"] === "공개"}
                    onChange={(e) =>
                      detail(
                        "주소·지도 공개",
                        e.target.checked ? "공개" : "비공개",
                      )
                    }
                  />
                  프로필에 기관 주소와 지도 표시
                </label>
              )}
              {draft.category === "career" && (
                <p className={styles.hint}>
                  기관의 공식 주소·대표 전화·홈페이지만 입력해주세요. 기본은
                  비공개이며, 프로필에서 현재 근무지로 선택한 뒤 게시할 때만
                  공개됩니다.
                </p>
              )}
              {field(
                "배운 점·결과",
                "learning",
                draft.learning,
                (v) => change("learning", v),
                "",
                false,
                true,
              )}
              <label className={styles.field}>
                관련 링크
                <input
                  type="url"
                  maxLength={2000}
                  value={draft.link}
                  placeholder="https://"
                  onChange={(e) => change("link", e.target.value)}
                />
              </label>
              {field(
                "개인 메모 · 나만 보기",
                "memo",
                draft.memo,
                (v) => change("memo", v),
                "",
                false,
                true,
              )}
            </details>
          </fieldset>
          <footer className={styles.savebar}>
            {error && <p role="alert">{error}</p>}
            <p role="status">
              {issues.length
                ? `남은 칸: ${issues.join(" · ")}`
                : "나만 보는 기록으로 저장됩니다."}
            </p>
            <div>
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={saving}
                  className={styles.remove}
                >
                  기록 삭제
                </button>
              )}
              <button type="button" onClick={onClose} disabled={saving}>
                취소
              </button>
              <button
                type="submit"
                disabled={saving || !ready || issues.length > 0}
                className={styles.save}
              >
                {saving ? "저장 중…" : "비공개로 저장"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
