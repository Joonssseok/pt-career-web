"use client";

import { useEffect, useRef, useState } from "react";
import { profileShareUrl, profileQrImage } from "@/lib/profile-sharing/qr";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import styles from "./ProfileSharingTools.module.css";

function qrPngBlob(image: string) {
  const bytes = Uint8Array.from(atob(image.split(",")[1]), (character) =>
    character.charCodeAt(0),
  );
  return new Blob([bytes], { type: "image/png" });
}

export function ProfileSharingTools({
  profileId,
  displayName,
  headline,
  published = false,
  availabilityError = false,
  compact = false,
  preview = false,
}: {
  profileId: string | null;
  displayName: string;
  headline: string;
  published?: boolean;
  availabilityError?: boolean;
  compact?: boolean;
  preview?: boolean;
}) {
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const qrDialog = useRef<HTMLDialogElement>(null);
  const [qr, setQr] = useState({ url: "", image: "", downloadUrl: "" });
  const [qrError, setQrError] = useState("");
  const [qrAttempt, setQrAttempt] = useState(0);
  const [qrRequested, setQrRequested] = useState(false);
  const [copyingQr, setCopyingQr] = useState(false);
  const address = useRef<HTMLInputElement>(null);
  const dialogAddress = useRef<HTMLInputElement>(null);
  const url =
    profileId && published && !availabilityError
      ? profileShareUrl(profileId)
      : "";
  const qrImage = qr.url === url ? qr.image : "";
  useEffect(() => {
    if (!url || !qrRequested) return;
    let cancelled = false;
    let downloadUrl = "";
    setQrError("");
    profileQrImage(url)
      .then((image) => {
        if (!cancelled) {
          downloadUrl = URL.createObjectURL(qrPngBlob(image));
          setQr({ url, image, downloadUrl });
        }
      })
      .catch(() => {
        if (!cancelled)
          setQrError("QR코드를 만들지 못했어요. 다시 시도해주세요.");
      });
    return () => {
      cancelled = true;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [url, qrAttempt, qrRequested]);
  const name = displayName.trim() || "내 프로필";
  const introduction = headline.trim();
  const focusClass =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
  const primaryClass = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${focusClass}`;
  const actionClass = `flex ${compact ? "min-h-14 flex-row" : "min-h-24 flex-col"} items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3 text-caption font-medium text-slate-900 transition-colors enabled:hover:border-blue-300 enabled:hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 motion-reduce:transition-none ${focusClass}`;

  const copyLink = async () => {
    if (preview) {
      setMessage("예시 화면에서는 링크를 복사하지 않습니다.");
      return;
    }
    if (!url) return;
    setMessage("");
    try {
      await navigator.clipboard.writeText(url);
      trackEvent("share");
      setMessage("공유 링크를 복사했어요.");
    } catch {
      const input = dialog.current?.open
        ? dialogAddress.current
        : address.current;
      input?.focus();
      input?.select();
      setMessage(
        "자동으로 복사하지 못했어요. 선택된 주소를 직접 복사해주세요.",
      );
    }
  };

  const shareToKakao = async () => {
    if (preview) {
      setMessage("예시 화면에서는 메시지를 보내지 않습니다.");
      return;
    }
    if (!url || sharing) return;
    setMessage("");
    if (!navigator.share) {
      dialog.current?.showModal();
      return;
    }
    setSharing(true);
    try {
      await navigator.share({
        title: `${name} · PT Career`,
        text: introduction,
        url,
      });
      trackEvent("share");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      dialog.current?.showModal();
    } finally {
      setSharing(false);
    }
  };

  const copyQr = async () => {
    if (preview) {
      setMessage("예시 화면에서는 QR 이미지를 복사하지 않습니다.");
      return;
    }
    if (!qrImage || copyingQr) return;
    setCopyingQr(true);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw new Error("image-copy-unavailable");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": qrPngBlob(qrImage) }),
      ]);
      trackEvent("share");
      setMessage("QR 이미지를 복사했어요.");
    } catch {
      setMessage(
        "이미지 복사를 지원하지 않거나 권한이 없어요. QR 이미지 저장을 이용해주세요.",
      );
    } finally {
      setCopyingQr(false);
    }
  };

  return (
    <section
      id="share"
      aria-labelledby="share-title"
      className={`min-w-0 scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 ${compact ? styles.compact : ""}`}
    >
      <header className="mb-7">
        {!compact && (
          <p className="text-caption font-semibold tracking-widest text-primary">
            SHARE YOUR CAREER
          </p>
        )}
        <h2
          id="share-title"
          className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
        >
          공유 관리
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          내 공개 프로필을 링크와 QR코드로 전해보세요.
        </p>
      </header>

      {!url ? (
        <div
          id="card"
          data-sharing-empty
          className="scroll-mt-28 rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50/60 to-white px-5 py-10 text-center"
        >
          <div
            className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-blue-200 bg-white text-primary"
            aria-hidden="true"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            >
              <rect x="4" y="3" width="16" height="18" rx="3" />
              <circle cx="12" cy="9" r="2" />
              <path d="M8 17v-1a4 4 0 0 1 8 0v1" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-950">
            {availabilityError
              ? "공유 가능 상태를 확인하지 못했어요."
              : !published
                ? "대표 프로필을 게시하면 공유할 수 있어요."
                : "공개 가능한 대표 프로필이 필요해요."}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {availabilityError
              ? "페이지를 새로고침해 다시 확인해주세요. 계속 문제가 생기면 잠시 후 다시 시도해주세요."
              : !published
                ? "프로필을 작성하고 공개 전 확인을 마친 뒤 대표 프로필을 게시해주세요. 게시 후 링크 공유와 QR코드를 이용할 수 있어요."
                : "대표 프로필의 공개 승인과 공개 설정을 확인해주세요."}
          </p>
          {availabilityError ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`mt-6 ${primaryClass}`}
            >
              다시 확인
            </button>
          ) : (
            <Link href="/my/profiles" className={`mt-6 ${primaryClass}`}>
              프로필 관리로 이동
            </Link>
          )}
        </div>
      ) : (
        <>
          <div
            data-sharing-identity
            className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-5 sm:gap-4"
          >
            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl font-semibold text-primary"
            >
              {Array.from(name)[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-lg font-semibold text-slate-950">
                {name}
              </p>
              <p className="mt-1 flex items-center gap-2 text-caption text-slate-500">
                <span
                  className="size-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden="true"
                />
                현재 공개 중인 대표 프로필
              </p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`ml-auto inline-flex min-h-11 items-center gap-1 text-caption text-slate-500 hover:text-primary ${focusClass}`}
            >
              프로필 보기<span className="sr-only"> (새 창)</span>
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M6 18 18 6M6 6h12v12" />
              </svg>
            </a>
          </div>
          <label
            className="mt-5 block text-sm font-medium text-slate-900"
            htmlFor="sharing-profile-url"
          >
            공유 주소
          </label>
          <input
            ref={address}
            id="sharing-profile-url"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className={`mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-caption text-slate-600 ${focusClass}`}
          />
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <button type="button" onClick={copyLink} className={actionClass}>
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                className="text-primary"
              >
                <path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 12a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" />
              </svg>
              링크 복사
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setQrRequested(true);
                qrDialog.current?.showModal();
              }}
              className={actionClass}
            >
              <span aria-hidden="true" className="font-bold">
                QR
              </span>
              <span>QR코드</span>
            </button>
            <button
              type="button"
              onClick={shareToKakao}
              disabled={sharing}
              className={actionClass}
            >
              <svg
                aria-hidden="true"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                className="rounded-lg bg-yellow-300 p-1 text-amber-950"
              >
                <path
                  d="M12 3C6 3 1 6.4 1 10.6c0 2.7 2 5.1 5 6.5l-1.2 4.1c-.1.4.3.7.6.4L10 18h2c6 0 11-3.3 11-7.5S18 3 12 3Z"
                  fill="currentColor"
                />
              </svg>
              {sharing ? "공유 메뉴 열림" : "카카오톡 공유"}
            </button>
          </div>
          <p className="mt-1 text-caption leading-relaxed text-slate-500">
            카카오톡은 기기의 공유 메뉴에서 직접 선택해주세요.
          </p>
        </>
      )}
      <p
        role="status"
        aria-live="polite"
        className="mt-4 text-sm leading-relaxed text-slate-600"
      >
        {message}
      </p>

      {url && (
        <dialog
          ref={qrDialog}
          aria-labelledby="profile-qr-title"
          className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-900/30"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id="profile-qr-title" className="text-lg font-bold">
              프로필 QR코드
            </h3>
            <form method="dialog">
              <button
                type="submit"
                autoFocus
                aria-label="닫기"
                className={`flex size-11 items-center justify-center text-2xl text-slate-500 ${focusClass}`}
              >
                ×
              </button>
            </form>
          </div>
          {qrImage ? (
            <img
              src={qrImage}
              alt="공개 프로필 QR코드"
              width={1024}
              height={1024}
              className="mx-auto mt-3 aspect-square w-full max-w-64 bg-white"
            />
          ) : (
            <p role="status" className="py-8 text-sm text-slate-500">
              {qrError || "QR코드를 준비하고 있어요."}
            </p>
          )}
          {qrError && (
            <button
              type="button"
              onClick={() => setQrAttempt((value) => value + 1)}
              className={primaryClass}
            >
              다시 시도
            </button>
          )}
          <p className="mt-3 break-all text-center text-xs text-slate-500">
            {url}
          </p>
          <p className="mt-2 text-center text-xs leading-5 text-slate-500">
            프로필 내용을 바꿔도 같은 QR을 사용할 수 있어요.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copyQr}
              disabled={!qrImage || copyingQr}
              className={primaryClass}
            >
              {copyingQr ? "복사 중…" : "QR 이미지 복사"}
            </button>
            <a
              href={!preview && qrImage ? qr.downloadUrl : undefined}
              download="pt-career-qr.png"
              aria-disabled={!qrImage || preview}
              onClick={(event) => {
                if (!qrImage || preview) {
                  event.preventDefault();
                  setMessage("예시 화면에서는 QR 파일을 저장하지 않습니다.");
                  return;
                }
                setMessage("QR 이미지 저장을 시작했어요.");
              }}
              className={`flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm aria-disabled:opacity-50 ${focusClass}`}
            >
              QR 이미지 저장
            </a>
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm leading-relaxed text-slate-600"
          >
            {message}
          </p>
        </dialog>
      )}

      {url && (
        <dialog
          ref={dialog}
          aria-labelledby="kakao-share-title"
          aria-describedby="kakao-share-guide"
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-900/30"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id="kakao-share-title" className="text-lg font-bold">
              카카오톡으로 공유하기
            </h3>
            <form method="dialog">
              <button
                type="submit"
                autoFocus
                aria-label="닫기"
                className={`flex size-11 items-center justify-center rounded-full bg-slate-50 text-2xl text-slate-500 ${focusClass}`}
              >
                ×
              </button>
            </form>
          </div>
          <p
            id="kakao-share-guide"
            className="mt-4 text-sm leading-relaxed text-slate-500"
          >
            링크를 복사한 뒤 카카오톡 대화창에 붙여넣어 주세요. 보낼 대화와
            내용을 직접 확인하고 전송해주세요.
          </p>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-primary">PT Career</p>
            <p className="mt-3 break-words font-semibold">{name}</p>
            <p className="mt-1 break-words text-sm text-slate-500">
              {introduction}
            </p>
          </div>
          <label
            htmlFor="kakao-profile-url"
            className="mt-4 block text-caption text-slate-500"
          >
            공유 주소
          </label>
          <input
            ref={dialogAddress}
            id="kakao-profile-url"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className={`mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-caption text-slate-600 ${focusClass}`}
          />
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-slate-600"
          >
            {message}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className={`mt-5 w-full ${primaryClass}`}
          >
            링크 복사
          </button>
        </dialog>
      )}
    </section>
  );
}
