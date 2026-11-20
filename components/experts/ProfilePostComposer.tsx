"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gowun_Dodum } from "next/font/google";
import { PostDocumentContent } from "@/components/profile-editor/PostDocumentContent";
import { introductionFromText } from "@/lib/profile-versions/introduction-format";
import { type EditableDetailImage } from "@/lib/profile-versions/detail-images";
import {
  type PostContent,
  type ProfilePost,
  uploadPostImage,
  validatePostContent,
} from "@/lib/profile-posts";
import {
  createProfilePost,
  saveProfilePost,
} from "@/app/actions/profile-posts";
import styles from "./ProfilePostComposer.module.css";

const Editor = dynamic(
  () =>
    import("@/components/profile-editor/IntroductionEditor").then(
      (m) => m.IntroductionEditor,
    ),
  { ssr: false, loading: () => <p>편집기를 불러오는 중입니다.</p> },
);
const postDisplayFont = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--post-gowun",
});
export function ProfilePostComposer({
  profileId,
  post,
  storageReady,
}: {
  profileId: string;
  post?: ProfilePost;
  storageReady: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState<PostContent>(
    post
      ? {
          title: post.title,
          document: post.document,
          category: post.category,
          tags: post.tags,
        }
      : {
          title: "",
          document: introductionFromText(""),
          category: "",
          tags: [],
        },
  );
  const [images, setImages] = useState<EditableDetailImage[]>(
    post?.images ?? [],
  );
  const [visibility, setVisibility] = useState<"public" | "private">(
    post?.adminHidden ? "private" : (post?.visibility ?? "private"),
  );
  const [tag, setTag] = useState("");
  const [message, setMessage] = useState(
    storageReady ? "" : "현재 미리보기에서는 저장되지 않습니다.",
  );
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const identity = useRef(
    post ? { id: post.id, updatedAt: post.updatedAt } : null,
  );
  const current = useRef({ content, images, visibility });
  current.current = { content, images, visibility };
  const saved = useRef(JSON.stringify(content));
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const mounted = useRef(true);
  const serial = JSON.stringify(content);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    function prevent(event: BeforeUnloadEvent) {
      if (JSON.stringify(current.current.content) !== saved.current) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);
  async function persist(publish: boolean) {
    if (!storageReady) {
      setMessage("현재 미리보기에서는 저장되지 않습니다.");
      return false;
    }
    if (publish) setBusy(true);
    const task = async () => {
      const snapshot = current.current;
      const checked = validatePostContent(snapshot.content, publish);
      if (!checked.ok) {
        if (mounted.current) setMessage(checked.error);
        if (publish && mounted.current) setBusy(false);
        return false;
      }
      if (publish && mounted.current) setBusy(true);
      try {
        if (!identity.current) {
          const created = await createProfilePost();
          if (!created.ok) throw new Error(created.error);
          identity.current = { id: created.id, updatedAt: created.updatedAt };
        }
        const needed = new Set(
          checked.content.document.content
            .filter((n) => n.type === "profileMedia")
            .map((n) => String(n.attrs?.fileId)),
        );
        for (const image of snapshot.images.filter((i) => needed.has(i.id)))
          await uploadPostImage(identity.current.id, image);
        const result = await saveProfilePost({
          id: identity.current.id,
          content: checked.content,
          publish,
          visibility: post?.adminHidden ? "private" : snapshot.visibility,
          expected: identity.current.updatedAt,
        });
        if (!result.ok) throw new Error(result.error);
        identity.current = { id: result.id, updatedAt: result.updatedAt };
        saved.current = JSON.stringify(snapshot.content);
        if (!post && mounted.current)
          window.history.replaceState(
            window.history.state,
            "",
            `/my/content/posts/${result.id}/edit`,
          );
        if (mounted.current) {
          setMessage(
            publish
              ? "발행했습니다."
              : `임시 저장됨 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`,
          );
          if (publish) {
            router.push(`/experts/${profileId}/posts/${result.id}`);
            router.refresh();
          }
        }
        return true;
      } catch (error) {
        if (mounted.current)
          setMessage(
            error instanceof Error
              ? error.message
              : "저장하지 못했습니다. 다시 시도해주세요.",
          );
        return false;
      } finally {
        if (publish && mounted.current) setBusy(false);
      }
    };
    queue.current = queue.current.then(task, task);
    return await queue.current;
  }
  useEffect(() => {
    if (
      !storageReady ||
      post?.status === "published" ||
      serial === saved.current
    )
      return;
    const timer = window.setTimeout(() => void persist(false), 1500);
    return () => window.clearTimeout(timer);
  }, [serial, storageReady]);
  function addTag() {
    const next = tag.trim().replace(/^#+/, "");
    if (
      next &&
      [...next].length <= 20 &&
      !content.tags.includes(next) &&
      content.tags.length < 10
    ) {
      setContent((c) => ({ ...c, tags: [...c.tags, next] }));
      setTag("");
    }
  }
  return (
    <main className={`${postDisplayFont.variable} ${styles.page}`}>
      <header className={styles.toolbar}>
        <button
          disabled={busy}
          onClick={async () => {
            if (JSON.stringify(current.current.content) !== saved.current) {
              if (
                !window.confirm(
                  !storageReady
                    ? "저장되지 않은 내용이 사라집니다. 나갈까요?"
                    : post?.status === "published"
                      ? "수정 내용을 발행하지 않고 나갈까요?"
                      : "작성한 내용을 임시 저장하고 나갈까요?",
                )
              )
                return;
              if (storageReady && post?.status !== "published") {
                setBusy(true);
                try {
                  if (!(await persist(false))) return;
                } finally {
                  setBusy(false);
                }
              }
            }
            router.push(`/experts/${profileId}?tab=board`);
          }}
        >
          ← 나가기
        </button>
        <div>
          {post?.status !== "published" && (
            <button
              disabled={busy || !storageReady}
              onClick={() => void persist(false)}
            >
              임시 저장
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => {
              const checked = validatePostContent(content, true);
              if (!checked.ok) setMessage(checked.error);
              else setPublishOpen(!publishOpen);
            }}
          >
            {post?.status === "published" ? "수정 발행" : "발행"}
          </button>
        </div>
      </header>
      <fieldset disabled={busy} className={styles.paper}>
        <label className={styles.titleLabel}>
          제목
          <input
            value={content.title}
            maxLength={80}
            placeholder="제목을 입력해주세요"
            disabled={busy}
            onChange={(e) =>
              setContent((c) => ({ ...c, title: e.target.value }))
            }
          />
        </label>
        <div className={styles.previewTools}>
          <button onClick={() => setPreview(!preview)}>
            {preview ? "편집하기" : "내용 미리보기"}
          </button>
          <p role="status">{message}</p>
        </div>
        {preview ? (
          <div className={styles.preview}>
            <PostDocumentContent document={content.document} images={images} />
          </div>
        ) : (
          <Editor
            postMode
            disabled={busy}
            label="게시글 본문"
            document={content.document}
            onChange={(document) => setContent((c) => ({ ...c, document }))}
            mediaImages={images}
            onMediaImagesChange={setImages}
          />
        )}
        {publishOpen && (
          <section className={styles.publish} aria-label="발행 설정">
            <h2>발행 설정</h2>
            <label>
              카테고리
              <input
                value={content.category}
                maxLength={12}
                placeholder="분류 이름 입력"
                onChange={(e) =>
                  setContent((c) => ({ ...c, category: e.target.value }))
                }
              />
            </label>
            <label>
              공개 설정
              <select
                disabled={post?.adminHidden}
                value={visibility}
                onChange={(e) =>
                  setVisibility(
                    e.target.value === "public" ? "public" : "private",
                  )
                }
              >
                <option value="private">나만 보기</option>
                <option value="public">전체 공개</option>
              </select>
            </label>
            <label>
              태그
              <input
                value={tag}
                maxLength={20}
                placeholder="입력 후 Enter (최대 10개)"
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
            </label>
            <div className={styles.tags}>
              {content.tags.map((t) => (
                <button
                  key={t}
                  onClick={() =>
                    setContent((c) => ({
                      ...c,
                      tags: c.tags.filter((v) => v !== t),
                    }))
                  }
                >
                  #{t} ×
                </button>
              ))}
            </div>
            <p>
              글은 심사 없이 바로 공개됩니다. 치료 효과를 보장하거나 타인의
              권리를 침해하는 내용, 환자 얼굴·개인정보가 담긴 사진은 올리지
              말아주세요.
            </p>
            <button
              disabled={busy || !storageReady}
              onClick={() => void persist(true)}
            >
              {busy ? "발행 중…" : "발행하기"}
            </button>
          </section>
        )}
      </fieldset>
    </main>
  );
}
