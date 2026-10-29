import Link from "next/link";
export function ProfileVersionLinks({
  versions,
}: {
  versions: { id: string; title: string; is_representative: boolean }[];
}) {
  return (
    <div className="space-y-1">
      <Link
        href="/my/profiles?new=1"
        className="flex min-h-11 items-center px-2 text-sm font-semibold text-primary"
      >
        새 프로필 만들기
      </Link>
      <Link
        href="/my/profiles"
        className="flex min-h-11 items-center px-2 text-sm font-medium text-slate-600"
      >
        기존 프로필 수정
      </Link>
      <div className="ml-3 space-y-1 border-l border-slate-100 pl-2">
        {versions.map((v) => (
          <div
            key={v.id}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-blue-50"
          >
            <Link
              href={`/my/profiles?profile=${v.id}`}
              className="min-w-0 flex-1 py-2 text-sm text-slate-600"
            >
              <span className="block truncate">{v.title}</span>
            </Link>
            {v.is_representative && (
              <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-1 text-[10px] font-semibold text-primary">
                공개프로필
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
