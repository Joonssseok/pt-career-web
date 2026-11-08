export type PublicItemReview = {
  id: string;
  files: { id: string; name: string }[];
};

export function ProfileVerificationMark() {
  return (
    <span
      role="img"
      aria-label="인증완료"
      tabIndex={0}
      className="group/certified relative inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 8 3.2 3.2L13 4.5" />
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-normal text-white opacity-0 transition-opacity group-hover/certified:visible group-hover/certified:opacity-100 group-focus-visible/certified:visible group-focus-visible/certified:opacity-100 motion-reduce:transition-none"
      >
        인증완료
      </span>
    </span>
  );
}

export function ProfileEvidencePublic({
  review,
}: {
  review?: PublicItemReview;
}) {
  if (!review) return null;
  return (
    <span className="ml-1.5 inline-flex max-w-full flex-wrap items-center gap-1.5 align-middle">
      <ProfileVerificationMark />
      {review.files.map((file, index) => (
        <a
          key={file.id}
          href={`/api/profile-evidence/${review.id}/${file.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${file.name} 공개 증빙자료 보기`}
          title={`${file.name} · PT Career 워터마크와 식별 표식이 적용된 공개 사본`}
          className="inline-flex min-h-8 items-center gap-1 text-xs font-normal text-slate-500 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8L15 6" />
          </svg>
          증빙자료{review.files.length > 1 ? ` ${index + 1}` : ""} ↗
        </a>
      ))}
    </span>
  );
}
