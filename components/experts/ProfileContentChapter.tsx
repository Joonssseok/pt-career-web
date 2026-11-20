import type { ReactNode } from "react";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import styles from "./ProfileContentChapter.module.css";

export function ProfileContentChapter({
  kind,
  home = false,
  ownerPreview = false,
  children,
}: {
  kind: "board" | "video";
  home?: boolean;
  ownerPreview?: boolean;
  children?: ReactNode;
}) {
  const title = kind === "board" ? "게시판" : "영상";
  if (home && !children) return null;
  return (
    <section
      data-profile-chapter={kind}
      data-home-section={home ? kind : undefined}
      className={`${styles.chapter} ${home ? styles.home : ""}`}
    >
      <header className={styles.header}>
        <h2>{title}</h2>
        <div className={styles.actions}>
          {home && (
            <a
              href={`?tab=${kind}`}
              data-profile-tab-link={kind}
              aria-label={`${title} 전체 보기`}
            >
              전체 보기
            </a>
          )}
          {ownerPreview && (
            <ComingSoonButton className={styles.add}>
              {kind === "board" ? "글쓰기" : "영상 추가"}
            </ComingSoonButton>
          )}
        </div>
      </header>
      {children || (
        <div
          className={`${styles.empty} ${kind === "video" ? styles.video : ""}`}
        >
          <svg
            aria-hidden="true"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            {kind === "video" ? (
              <>
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="m10 8 6 4-6 4Z" />
              </>
            ) : (
              <>
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <path d="M9 8h6M9 12h6M9 16h4" />
              </>
            )}
          </svg>
          <p>
            {kind === "board"
              ? "등록된 게시글이 없습니다."
              : "등록된 영상이 없습니다."}
          </p>
        </div>
      )}
    </section>
  );
}
