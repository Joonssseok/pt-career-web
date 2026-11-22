"use client";

import { Gowun_Dodum } from "next/font/google";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./ProfileEditorShell.module.css";

const displayFont = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--profile-editor-gowun",
});

const steps = [
  "기본 정보",
  "소개",
  "상세소개",
  "이력 고르기",
  "공개 전 확인",
] as const;

export type ProfileEditorSaveStatus =
  "idle" | "dirty" | "saving" | "saved" | "error";
export type ProfileEditorShellProps = {
  step: number;
  onStepChange: (step: number) => void;
  identity: ReactNode;
  identityFooter?: ReactNode;
  children: ReactNode;
  saveStatus: ProfileEditorSaveStatus;
  onRetry: () => void;
  pending: boolean;
};

const saveLabels: Record<ProfileEditorSaveStatus, string> = {
  idle: "작성 중",
  dirty: "변경사항 저장 대기",
  saving: "저장 중…",
  saved: "자동 저장됨 · 방금",
  error: "저장하지 못했어요. 다시 시도",
};

export function ProfileEditorShell({
  step,
  onStepChange,
  identity,
  identityFooter,
  children,
  saveStatus,
  onRetry,
  pending,
}: ProfileEditorShellProps) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [wide, setWide] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    // Open the native disclosure on desktop too, keeping its accessibility state accurate.
    const measure = () => setWide(element.getBoundingClientRect().width >= 900);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(([entry]) =>
      setWide(entry.contentRect.width >= 900),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function moveStep(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % steps.length;
        break;
      case "ArrowLeft":
        next = (index + steps.length - 1) % steps.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = steps.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onStepChange(next);
    buttons.current[next]?.focus();
  }

  return (
    <div
      ref={container}
      className={`${displayFont.variable} ${styles.root}`}
      data-profile-editor-shell
    >
      <div className={`${styles.wrap} ${step !== 0 ? styles.review : ""}`}>
        <aside
          hidden={step !== 0}
          className={styles.preview}
          aria-label="실시간 프로필 미리보기"
        >
          <details
            className={styles.disclosure}
            open={wide || previewOpen}
            onToggle={(event) => {
              if (!wide) setPreviewOpen(event.currentTarget.open);
            }}
          >
            <summary className={styles.summary}>미리보기</summary>
            <div className={styles.identity}>
              <p className={styles.caption}>방문자에게 이렇게 보여요</p>
              {identity}
            </div>
          </details>
          {identityFooter && <div className={styles.identityFooter}>{identityFooter}</div>}
        </aside>
        <div className={styles.read}>
          <nav className={styles.nav} aria-label="프로필 작성 단계">
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="프로필 작성 단계"
            >
              {steps.map((label, index) => (
                <button
                  key={label}
                  ref={(button) => {
                    buttons.current[index] = button;
                  }}
                  id={`${id}-step-${index}`}
                  type="button"
                  role="tab"
                  aria-controls={`${id}-panel`}
                  aria-selected={step === index}
                  tabIndex={step === index ? 0 : -1}
                  className={index < step ? styles.done : undefined}
                  onClick={() => onStepChange(index)}
                  onKeyDown={(event) => moveStep(event, index)}
                >
                  <span className={styles.number} aria-hidden="true">
                    {index + 1}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </nav>
          <div
            className={styles.content}
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-step-${step}`}
            aria-busy={pending}
            tabIndex={0}
          >
            {children}
          </div>
          <div className={styles.footer} aria-label="단계 이동 및 저장 상태">
            <div className={styles.previous}>
              {step > 0 && (
                <button
                  className={styles.button}
                  type="button"
                  onClick={() => onStepChange(step - 1)}
                >
                  이전
                </button>
              )}
            </div>
            <div
              className={styles.saved}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {saveStatus === "error" ? (
                <button
                  className={styles.retry}
                  type="button"
                  onClick={onRetry}
                  disabled={pending}
                >
                  {saveLabels.error}
                </button>
              ) : (
                <span>{saveLabels[saveStatus]}</span>
              )}
            </div>
            <div className={styles.next}>
              {step < steps.length - 1 && (
                <button
                  className={`${styles.button} ${styles.primary}`}
                  type="button"
                  onClick={() => onStepChange(step + 1)}
                >
                  다음
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
