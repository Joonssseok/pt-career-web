"use client";
import Link from "next/link";
import { useState } from "react";
import {
  loadProfilePosts,
  removeProfilePost,
  saveProfilePost,
} from "@/app/actions/profile-posts";
import { type ProfilePost } from "@/lib/profile-posts";
import { PostDocumentContent } from "@/components/profile-editor/PostDocumentContent";
import { useRouter } from "next/navigation";
import { ContentViewToggle } from "./ContentViewToggle";
import styles from "./ProfilePostBoard.module.css";

export function PostBody({ post }: { post: ProfilePost }) {
  return (
    <div className={styles.body}>
      <PostDocumentContent document={post.document} images={post.images} />
    </div>
  );
}
export function ProfilePostBoard({
  profileId,
  initialPosts,
  selectedPost,
  owner = false,
  canWrite = false,
  home = false,
  storageReady = true,
  includeDrafts = false,
}: {
  profileId: string;
  initialPosts: ProfilePost[];
  selectedPost?: ProfilePost | null;
  owner?: boolean;
  canWrite?: boolean;
  home?: boolean;
  storageReady?: boolean;
  includeDrafts?: boolean;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [category, setCategory] = useState("");
  const [view, setView] = useState("blog");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(initialPosts.length);
  const [more, setMore] = useState(initialPosts.length === 10);
  const publicPost = (p: ProfilePost) =>
    p.status === "published" && p.visibility === "public" && !p.adminHidden;
  const shown = (home ? initialPosts : posts).filter(
    (p) =>
      ((owner && !home) || publicPost(p)) &&
      (p.status !== "draft" || (owner && includeDrafts && !home)) &&
      (!category || p.category === category),
  );
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))];
  async function changePost(post: ProfilePost, remove: boolean) {
    if (
      !canWrite ||
      busy ||
      !window.confirm(
        remove
          ? "이 글을 삭제할까요? 삭제하면 복구할 수 없습니다."
          : "이 글의 공개 설정을 변경할까요?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = remove
        ? await removeProfilePost(post.id, post.updatedAt)
        : await saveProfilePost({
            id: post.id,
            content: {
              title: post.title,
              document: post.document,
              category: post.category,
              tags: post.tags,
            },
            publish: true,
            visibility: post.visibility === "public" ? "private" : "public",
            expected: post.updatedAt,
          });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      if (remove) router.push(`/experts/${profileId}?tab=board`);
    } catch {
      setError("변경하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }
  if (home && !shown.length) return null;
  if (selectedPost)
    return (
      <article className={styles.article}>
        <Link
          href={
            owner && !canWrite
              ? "/my/content"
              : `/experts/${profileId}?tab=board`
          }
        >
          ← 목록으로
        </Link>
        <p className={styles.meta}>{selectedPost.category}</p>
        <h1>{selectedPost.title || "제목 없는 글"}</h1>
        <p className={styles.meta}>
          {selectedPost.publishedAt
            ? new Date(selectedPost.publishedAt).toLocaleDateString("ko-KR")
            : "임시 저장한 글"}
          {owner &&
          (selectedPost.visibility === "private" ||
            selectedPost.status === "draft")
            ? " · 나만 보기"
            : ""}
        </p>
        {selectedPost.adminHidden && <p>관리자가 숨긴 글입니다.</p>}
        {owner && canWrite && (
          <div className={styles.actions}>
            <Link href={`/my/content/posts/${selectedPost.id}/edit`}>
              수정하기
            </Link>
            {selectedPost.status === "published" && (
              <button
                disabled={busy || selectedPost.adminHidden}
                onClick={() => void changePost(selectedPost, false)}
              >
                {selectedPost.visibility === "public"
                  ? "나만 보기로"
                  : "전체 공개로"}
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => void changePost(selectedPost, true)}
            >
              삭제하기
            </button>
          </div>
        )}
        <PostBody post={selectedPost} />
        <div className={styles.tags}>
          {selectedPost.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
        <p role="status">{error}</p>
      </article>
    );
  return (
    <div className={styles.board}>
      {!home && (
        <div className={styles.top}>
          {owner && (
            <>
              {canWrite ? (
                <Link
                  className={styles.writeIcon}
                  href="/my/content/posts/new"
                  aria-label="글쓰기"
                  title="글쓰기"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
                    <path d="m13 6 5 5" />
                  </svg>
                </Link>
              ) : (
                <span className={styles.meta}>
                  프로필 공개 후 글을 작성할 수 있습니다.
                </span>
              )}
            </>
          )}
        </div>
      )}
      {!home && (
        <div className={styles.filters}>
          <label>
            분류{" "}
            <select
              value={category}
              onChange={async (e) => {
                const next = e.target.value;
                setBusy(true);
                setError("");
                try {
                  const r = await loadProfilePosts(
                    profileId,
                    owner,
                    0,
                    "",
                    next,
                  );
                  if (r.ok) {
                    setCategory(next);
                    setPosts(r.posts);
                    setOffset(r.posts.length);
                    setMore(r.posts.length === 10);
                  } else setError(r.error);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy || !storageReady}
            >
              <option value="">전체보기</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <ContentViewToggle
            value={view}
            onChange={setView}
            label="게시글 보기 방식"
          />
        </div>
      )}
      {shown.length ? (
        <div className={view === "album" && !home ? styles.album : styles.list}>
          {(home ? shown.slice(0, 3) : shown).map((post) => (
            <article
              key={post.id}
              className={styles.post}
              data-profile-search-item={publicPost(post) ? "" : undefined}
              data-profile-search-exclude={!publicPost(post) ? "" : undefined}
              data-profile-search-title={
                publicPost(post) ? post.title : undefined
              }
            >
              <Link
                href={
                  owner && !canWrite
                    ? `/my/content/posts/${post.id}`
                    : `/experts/${profileId}/posts/${post.id}`
                }
              >
                {view !== "list" && post.images[0] && (
                  <img
                    src={post.images[0].src}
                    alt=""
                    className={styles.thumbnail}
                    loading="lazy"
                  />
                )}
                <div>
                  <p className={styles.meta}>
                    {post.category}
                    {owner && post.status === "draft"
                      ? " · 임시 저장"
                      : owner && post.visibility === "private"
                        ? " · 나만 보기"
                        : ""}
                  </p>
                  <h3>{post.title || "제목 없는 글"}</h3>
                  {view === "blog" && !home && (
                    <p className={styles.summary}>{post.summary}</p>
                  )}
                  {post.publishedAt && (
                    <time className={styles.meta}>
                      {new Date(post.publishedAt).toLocaleDateString("ko-KR")}
                    </time>
                  )}
                </div>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>아직 올린 글이 없습니다.</p>
      )}
      {!home && more && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await loadProfilePosts(
                profileId,
                owner,
                offset,
                "",
                category,
              );
              if (r.ok) {
                setPosts((p) => [
                  ...p,
                  ...r.posts.filter((n) => !p.some((old) => old.id === n.id)),
                ]);
                setOffset(offset + r.posts.length);
                setMore(r.posts.length === 10);
              } else setError(r.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          더 보기
        </button>
      )}
      <p role="status">{error}</p>
    </div>
  );
}
