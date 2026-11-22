"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { normalizePostLink } from "@/lib/profile-post-document";
import { ProfileOrderLayout } from "@/components/ProfileOrderLayout";
import {
  YoutubeIcon,
  InstagramIcon,
  BlogIcon,
  ThreadsIcon,
  KakaoIcon,
} from "@/components/icons/SocialIcons";
import styles from "./ExternalLinksPreview.module.css";

export type ExternalPreviewLink = {
  id: string;
  kind: string;
  label: string;
  url: string;
};
export type ExternalLinkDraft = {
  links: ExternalPreviewLink[];
  pending: boolean;
};
const kinds = [
  ["youtube", "유튜브"],
  ["instagram", "인스타그램"],
  ["blog", "블로그"],
  ["threads", "스레드"],
  ["kakao", "카카오톡"],
  ["custom", "직접 입력"],
];
function Icon({ kind }: { kind: string }) {
  const Icons: Record<string, typeof YoutubeIcon> = {
    youtube: YoutubeIcon,
    instagram: InstagramIcon,
    blog: BlogIcon,
    threads: ThreadsIcon,
    kakao: KakaoIcon,
  };
  const Platform = Icons[kind];
  return Platform ? (
    <Platform className={styles.platformIcon} />
  ) : (
    <svg
      className={styles.platformIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M13 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" />
    </svg>
  );
}
export function ExternalLinksPreview({
  initialLinks,
  displayName,
  headline,
  embedded = false,
  onDraftChange,
}: {
  initialLinks: ExternalPreviewLink[];
  displayName: string;
  headline?: string;
  embedded?: boolean;
  onDraftChange?: (draft: ExternalLinkDraft) => void;
}) {
  const [links, setLinks] = useState(() =>
    initialLinks.flatMap((link) => {
      const url = normalizePostLink(link.url);
      return url || embedded
        ? [
            {
              ...link,
              url: url ?? link.url,
              kind: kinds.some(([id]) => id === link.kind)
                ? link.kind
                : "custom",
            },
          ]
        : [];
    }),
  );
  const [open, setOpen] = useState(initialLinks.length === 0);
  const [editing, setEditing] = useState<string | null>(null);
  const [kind, setKind] = useState("custom");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const change = useRef(onDraftChange);
  change.current = onDraftChange;
  useEffect(() => {
    change.current?.({
      links,
      pending: open && (!!editing || !!name.trim() || !!url.trim()),
    });
  }, [links, open, editing, name, url]);
  function start(link?: ExternalPreviewLink) {
    setEditing(link?.id ?? null);
    setKind(link?.kind ?? "custom");
    setName(link?.label ?? "");
    setUrl(link?.url ?? "");
    setError("");
    setOpen(true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = normalizePostLink(url.trim());
    if (!clean) {
      setError("http:// 또는 https://로 시작하는 올바른 주소를 입력해주세요.");
      return;
    }
    if (!name.trim()) {
      setError("표시 이름을 입력해주세요.");
      return;
    }
    if (!editing && links.length >= 15) {
      setError("링크는 최대 15개까지 등록할 수 있습니다.");
      return;
    }
    const id = editing ?? crypto.randomUUID();
    const link = { id, kind, label: name.trim(), url: clean };
    setLinks((current) =>
      editing
        ? current.map((row) => (row.id === editing ? link : row))
        : [...current, link],
    );
    setOpen(false);
    setEditing(null);
    setError("");
  }
  return (
    <div className={`${styles.page}${embedded ? ` ${styles.embedded}` : ""}`}>
      {!embedded && (
        <>
          <div className={styles.notice}>
            디자인 미리보기 · 변경 내용은 저장되지 않습니다.
          </div>
          <header className={styles.header}>
            <div>
              <p>프로필 · 기본 정보</p>
              <h1>외부 링크</h1>
              <p>내 채널과 홈페이지, 상담·예약 링크를 한곳에서 관리하세요.</p>
            </div>
            <a href="/my/profiles">프로필 작성으로 돌아가기</a>
          </header>
        </>
      )}
      <div className={styles.layout}>
        <section className={styles.editor} aria-label="외부 링크 편집">
          <div className={styles.sectionHeading}>
            <h2>
              등록한 링크 <span>{links.length}</span>
            </h2>
            <button type="button" onClick={() => start()}>
              ＋ 링크 추가
            </button>
          </div>
          {links.length ? (
            <ProfileOrderLayout
              showSingleHandle
              className={styles.sortable}
              order={{ sections: links.map((link) => link.id) }}
              onChange={({ sections }) =>
                setLinks((current) => [
                  ...sections.flatMap((id) =>
                    current.filter((link) => link.id === id),
                  ),
                  ...current.filter((link) => !sections.includes(link.id)),
                ])
              }
            >
              <ul className={styles.rows} aria-label="등록한 링크 목록">
                {links.map((link) => (
                  <li key={link.id} data-order-key={link.id} title={link.label}>
                    <span className={styles.icon}>
                      <Icon kind={link.kind} />
                    </span>
                    <div className={styles.linkText}>
                      <strong>{link.label}</strong>
                      <span title={link.url}>{link.url}</span>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        aria-label={`${link.label} 수정`}
                        onClick={() => start(link)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        aria-label={`${link.label} 삭제`}
                        onClick={() => {
                          setLinks((current) =>
                            current.filter((row) => row.id !== link.id),
                          );
                          if (editing === link.id) setOpen(false);
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </ProfileOrderLayout>
          ) : (
            <p className={styles.empty}>
              등록한 링크가 없습니다. 사용하는 링크만 추가해보세요.
            </p>
          )}
          {open && (
            <form
              onSubmit={submit}
              className={styles.form}
              aria-label={editing ? "링크 수정" : "링크 추가"}
            >
              <h3>{editing ? "링크 수정" : "새 링크"}</h3>
              <label>
                종류
                <select
                  value={kind}
                  onChange={(event) => {
                    const next = event.target.value;
                    setKind(next);
                    if (next !== "custom")
                      setName(kinds.find(([id]) => id === next)![1]);
                    else setName("");
                  }}
                >
                  {kinds.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                표시 이름
                <input
                  value={name}
                  maxLength={40}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={
                    kind === "custom"
                      ? "예: 상담·예약, 홈페이지"
                      : "프로필에 보일 이름"
                  }
                  required
                />
              </label>
              <label>
                링크 주소
                <input
                  type="url"
                  value={url}
                  maxLength={2048}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                  required
                />
              </label>
              <p role="alert" className={styles.error}>
                {error}
              </p>
              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError("");
                  }}
                >
                  취소
                </button>
                <button type="submit">{editing ? "수정 완료" : "추가"}</button>
              </div>
            </form>
          )}
          <p className={styles.hint}>
            왼쪽 손잡이를 끌어 순서를 바꿀 수 있습니다.
          </p>
        </section>
        <aside className={styles.preview} aria-label="프로필 표시 미리보기">
          <p className={styles.previewLabel}>프로필 표시</p>
          <div className={styles.profile}>
            <div className={styles.avatar} aria-hidden="true">
              {displayName.slice(0, 1)}
            </div>
            <h2>{displayName}</h2>
            {headline && <p className={styles.headline}>{headline}</p>}
            {links.length ? (
              <ExternalLinkButtons links={links} />
            ) : (
              <p className={styles.empty}>추가한 링크가 여기에 표시됩니다.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ExternalLinkButtons({
  links,
}: {
  links: { kind?: string; label: string; url: string; is_primary?: boolean }[];
}) {
  const safe = links.flatMap((link) => {
    const url = normalizePostLink(link.url);
    return url ? [{ ...link, url, kind: link.kind ?? "custom" }] : [];
  });
  if (!safe.length) return null;
  return (
    <div className={styles.publicLinks} aria-label="외부 링크">
      {safe.map((link, index) => (
        <a
          data-profile-contact
          key={index}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={link.label}
          aria-label={link.label}
        >
          <Icon kind={link.kind} />
          <span>{link.label}</span>
        </a>
      ))}
    </div>
  );
}
