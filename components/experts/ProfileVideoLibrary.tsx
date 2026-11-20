"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProfileVideo } from "@/lib/profile-videos";
import {
  loadProfileVideos,
  previewProfileVideo,
  removeProfileVideo,
  saveProfileVideo,
} from "@/app/actions/profile-videos";
import { YoutubeVideo } from "@/components/profile-editor/YoutubeVideo";
import { ContentViewToggle } from "./ContentViewToggle";
import styles from "./ProfileVideoLibrary.module.css";
import boardStyles from "./ProfilePostBoard.module.css";
import composerStyles from "./ProfilePostComposer.module.css";

export type ProfileVideoLibraryProps = {
  profileId: string;
  initialVideos: ProfileVideo[];
  owner?: boolean;
  canWrite?: boolean;
  home?: boolean;
};

const PAGE_SIZE = 12;
const videoUrl = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;
const isPublic = (video: ProfileVideo) =>
  video.visibility === "public" && !video.adminHidden;

export function ProfileVideoLibrary(props: ProfileVideoLibraryProps) {
  return (
    <VideoLibrary
      key={`${props.profileId}:${!!props.owner}:${JSON.stringify(props.initialVideos)}`}
      {...props}
    />
  );
}

function VideoLibrary({
  profileId,
  initialVideos,
  owner = false,
  canWrite = false,
  home = false,
}: ProfileVideoLibraryProps) {
  const router = useRouter();
  const [videos, setVideos] = useState(initialVideos);
  const [offset, setOffset] = useState(initialVideos.length);
  const [hasMore, setHasMore] = useState(initialVideos.length >= PAGE_SIZE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<ProfileVideo | null>(null);
  const [view, setView] = useState("blog");
  const [playing, setPlaying] = useState<ProfileVideo | null>(null);
  const writable = owner && canWrite && !home;
  const shown = home
    ? initialVideos.filter(isPublic).slice(0, 3)
    : owner
      ? videos
      : videos.filter(isPublic);

  async function refresh() {
    const next: ProfileVideo[] = [];
    let nextOffset = 0;
    let more = false;
    do {
      const result = await loadProfileVideos(profileId, owner, nextOffset);
      if (!result.ok) throw new Error(result.error);
      next.push(...result.videos);
      nextOffset += result.videos.length;
      more = result.videos.length === PAGE_SIZE;
    } while (more && nextOffset < Math.max(PAGE_SIZE, offset));
    setVideos(next);
    setOffset(nextOffset);
    setHasMore(more);
  }

  async function afterSave() {
    setBusy(true);
    setEditing(null);
    router.refresh();
    try {
      await refresh();
      setMessage("영상을 저장했습니다.");
    } catch {
      setMessage(
        "저장했지만 목록을 새로 불러오지 못했습니다. 목록 새로고침을 눌러 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    setBusy(true);
    setMessage("");
    try {
      const result = await loadProfileVideos(profileId, owner, offset);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setVideos((current) => [
        ...current,
        ...result.videos.filter(
          (video) => !current.some((item) => item.id === video.id),
        ),
      ]);
      setOffset(offset + result.videos.length);
      setHasMore(result.videos.length === PAGE_SIZE);
    } catch {
      setMessage("영상을 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function changeVideo(video: ProfileVideo, remove: boolean) {
    if (!writable || busy || (!remove && video.adminHidden)) return;
    const visibility = video.visibility === "public" ? "private" : "public";
    if (
      !window.confirm(
        remove
          ? `‘${video.title}’ 영상을 삭제할까요? 삭제한 영상은 복구할 수 없습니다.`
          : `‘${video.title}’ 영상을 ${visibility === "public" ? "전체 공개" : "나만 보기"}로 변경할까요?`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const result = remove
        ? await removeProfileVideo(video.id)
        : await saveProfileVideo({
            id: video.id,
            url: videoUrl(video.videoId),
            title: video.title,
            caption: video.caption ?? "",
            visibility,
            expectedUpdatedAt: video.updatedAt,
          });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.refresh();
      try {
        await refresh();
        setMessage(
          remove ? "영상을 삭제했습니다." : "공개 설정을 변경했습니다.",
        );
      } catch {
        setMessage(
          "변경했지만 목록을 새로 불러오지 못했습니다. 목록 새로고침을 눌러 주세요.",
        );
      }
    } catch {
      setMessage("변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (home && shown.length === 0) return null;

  return (
    <div className={styles.library} aria-busy={busy}>
      {!home && owner && (
        <div className={styles.toolbar}>
          {writable ? (
            <button
              type="button"
              className={`${boardStyles.writeIcon} ${styles.addIcon}`}
              aria-label="영상 추가"
              title="영상 추가"
              disabled={busy}
              onClick={() => {
                router.push("/my/content/videos/new");
              }}
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
            </button>
          ) : (
            <p>
              현재 읽기 전용입니다. 기존 영상은 보관되며, 공개 가능한 대표
              프로필에서 추가·수정할 수 있습니다.
            </p>
          )}
        </div>
      )}
      {!home && (
        <div className={styles.viewToolbar}>
          <ContentViewToggle
            value={view}
            onChange={setView}
            label="영상 보기 방식"
          />
        </div>
      )}
      {!home && (
        <p role="status" className={styles.status}>
          {message}
        </p>
      )}
      {shown.length ? (
        <div
          className={
            home
              ? styles.grid
              : view === "album"
                ? styles.album
                : view === "list"
                  ? styles.list
                  : styles.summaryList
          }
        >
          {shown.map((video) => (
            <article
              key={video.id}
              className={styles.card}
              data-profile-search-item={isPublic(video) ? "" : undefined}
              data-profile-search-title={
                isPublic(video) ? video.title : undefined
              }
              data-profile-search-exclude={!isPublic(video) ? "" : undefined}
            >
              {(home || view !== "list") && (
                <div className={styles.player}>
                  <YoutubeVideo key={video.videoId} videoId={video.videoId} />
                </div>
              )}
              <div className={styles.cardContent}>
                <h3>
                  {!home && view === "list" ? (
                    <button
                      className={styles.titleButton}
                      onClick={() => setPlaying(video)}
                      aria-label={`${video.title} 재생`}
                    >
                      {video.title}
                    </button>
                  ) : (
                    video.title
                  )}
                </h3>
                {(home || view !== "list") && (video.caption ?? "") && (
                  <p className={styles.caption}>{video.caption ?? ""}</p>
                )}
                {!home && owner && (
                  <p className={styles.meta}>
                    {video.visibility === "public" ? "전체 공개" : "나만 보기"}
                  </p>
                )}
                {!home && owner && video.adminHidden && (
                  <p className={styles.notice}>
                    관리자가 숨긴 영상입니다. 다시 공개할 수 없습니다.
                  </p>
                )}
                {writable && (
                  <div className={styles.controls}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditing(video)}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      disabled={busy || video.adminHidden}
                      onClick={() => void changeVideo(video, false)}
                    >
                      {video.visibility === "public"
                        ? "나만 보기로 변경"
                        : "전체 공개로 변경"}
                    </button>
                    <button
                      type="button"
                      className={styles.danger}
                      disabled={busy}
                      onClick={() => void changeVideo(video, true)}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>등록된 영상이 없습니다.</p>
      )}
      {!home && (
        <div className={styles.footer}>
          {hasMore && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadMore()}
            >
              더 보기
            </button>
          )}
          <button
            type="button"
            className={styles.refreshIcon}
            aria-label="목록 새로고침"
            title="목록 새로고침"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                await refresh();
              } catch {
                setMessage(
                  "목록을 새로 불러오지 못했습니다. 다시 시도해 주세요.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3" />
            </svg>
          </button>
        </div>
      )}
      {writable && editing && (
        <ProfileVideoEditor
          video={editing}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
        />
      )}
      {playing && (
        <VideoPlayerDialog video={playing} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}

function VideoPlayerDialog({
  video,
  onClose,
}: {
  video: ProfileVideo;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.playerHeading}>
        <h3 id={id}>{video.title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="영상 닫기"
          autoFocus
        >
          닫기
        </button>
      </div>
      <YoutubeVideo videoId={video.videoId} />
      {video.caption && <p className={styles.caption}>{video.caption}</p>}
    </dialog>
  );
}

export function ProfileVideoEditor({
  video,
  onClose,
  onSaved,
  page = false,
}: {
  video?: ProfileVideo;
  onClose: () => void;
  onSaved: () => Promise<void>;
  page?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [url, setUrl] = useState(video ? videoUrl(video.videoId) : "");
  const [title, setTitle] = useState(video?.title ?? "");
  const [caption, setCaption] = useState(video?.caption ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(
    video?.adminHidden ? "private" : (video?.visibility ?? "private"),
  );
  const [preview, setPreview] = useState(video?.videoId ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = useRef(false);
  const dirty =
    url !== (video ? videoUrl(video.videoId) : "") ||
    title !== (video?.title ?? "") ||
    caption !== (video?.caption ?? "") ||
    visibility !==
      (video?.adminHidden ? "private" : (video?.visibility ?? "private"));
  useEffect(() => {
    if (!page) dialog.current?.showModal();
  }, [page]);
  useEffect(() => {
    if (!page || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (saved.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [page, dirty]);
  function leave() {
    if (busy) return;
    if (
      !page ||
      !dirty ||
      saved.current ||
      window.confirm("작성한 내용을 저장하지 않고 나갈까요?")
    )
      onClose();
  }

  async function previewUrl() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await previewProfileVideo(url.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.videoId);
      if (!title.trim()) setTitle(result.title.slice(0, 80));
    } catch {
      setError(
        "미리보기를 불러오지 못했습니다. 주소와 제목을 확인한 뒤 저장할 수 있습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saved.current) return;
    if (!url.trim() || !title.trim() || title.length > 80) {
      setError("유튜브 주소와 80자 이내의 제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await saveProfileVideo({
        ...(video ? { id: video.id, expectedUpdatedAt: video.updatedAt } : {}),
        url: url.trim(),
        title: title.trim(),
        caption,
        visibility: video?.adminHidden ? "private" : visibility,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      saved.current = true;
      await onSaved();
    } catch {
      setError("저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form
      id={`${id}-form`}
      onSubmit={save}
      aria-busy={busy}
      aria-label={video ? "영상 수정" : "영상 추가"}
    >
      <h3 id={`${id}-heading`}>{video ? "영상 수정" : "영상 추가"}</h3>
      <fieldset disabled={busy} className={styles.fields}>
        <label htmlFor={`${id}-url`}>유튜브 주소</label>
        <input
          id={`${id}-url`}
          type="url"
          required
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setPreview("");
          }}
        />
        <button
          type="button"
          disabled={!url.trim()}
          onClick={() => void previewUrl()}
        >
          미리보기
        </button>
        {preview ? (
          <YoutubeVideo key={preview} videoId={preview} />
        ) : (
          page && (
            <div className={styles.videoPlaceholder}>
              유튜브 영상을 먼저 넣어주세요.
            </div>
          )
        )}
        <label htmlFor={`${id}-title`}>제목 (최대 80자)</label>
        <input
          id={`${id}-title`}
          required
          maxLength={80}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor={`${id}-caption`}>영상 설명 (선택)</label>
        <textarea
          id={`${id}-caption`}
          rows={page ? 10 : 4}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
        <label htmlFor={`${id}-visibility`}>공개 설정</label>
        <select
          id={`${id}-visibility`}
          value={visibility}
          disabled={video?.adminHidden}
          onChange={(event) =>
            setVisibility(
              event.target.value === "public" ? "public" : "private",
            )
          }
        >
          <option value="private">나만 보기</option>
          <option value="public">전체 공개</option>
        </select>
        {video?.adminHidden && (
          <p className={styles.notice}>
            관리자가 숨긴 영상입니다. 다시 공개할 수 없습니다.
          </p>
        )}
        <p className={styles.meta}>
          유튜브에서 재생을 제한하거나 삭제한 영상은 재생되지 않을 수 있습니다.
        </p>
      </fieldset>
      <p role="status" className={styles.status}>
        {error}
      </p>
      {!page && (
        <div className={styles.controls}>
          <button type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button type="submit" disabled={busy}>
            {busy ? "처리 중…" : "저장"}
          </button>
        </div>
      )}
    </form>
  );
  if (page)
    return (
      <main className={`${composerStyles.page} ${styles.composerPage}`}>
        <div className={composerStyles.toolbar}>
          <button type="button" disabled={busy} onClick={leave}>
            ← 나가기
          </button>
          <div>
            <button type="submit" form={`${id}-form`} disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
        <div className={composerStyles.paper}>{form}</div>
      </main>
    );
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={`${id}-heading`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {form}
    </dialog>
  );
}

export function ProfileVideoComposer({ profileId }: { profileId: string }) {
  const router = useRouter();
  const backTo = `/experts/${profileId}?tab=video`;
  return (
    <ProfileVideoEditor
      page
      onClose={() => router.push(backTo)}
      onSaved={async () => {
        router.replace(backTo);
        router.refresh();
      }}
    />
  );
}
