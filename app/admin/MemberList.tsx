import Link from "next/link";
export type Member = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  profile_id: string | null;
  is_public: boolean | null;
  suspended_at: string | null;
  deletion_requested_at: string | null;
};
export function MemberList({
  rows,
  query,
  offset,
}: {
  rows: Member[];
  query: string;
  offset: number;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold">전체 가입 계정</h3>
      <form className="flex gap-2" action="/admin">
        <input type="hidden" name="view" value="profiles" />
        <input
          name="member"
          defaultValue={query}
          maxLength={100}
          aria-label="회원 이메일·활동명 검색"
          placeholder="이메일·활동명 검색"
          className="min-h-12 min-w-0 flex-1 rounded-lg border px-3 text-sm"
        />
        <button className="rounded-lg bg-blue-50 px-4 text-sm text-primary">
          회원 검색
        </button>
      </form>
      {rows.slice(0, 50).map((u) => (
        <div key={u.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="min-w-0 break-all text-sm font-semibold">
              {u.display_name || "프로필 미작성"} · {u.email || "이메일 없음"}
            </p>
            {u.profile_id && (
              <Link
                className="text-sm text-primary"
                href={`/admin/${u.profile_id}`}
              >
                프로필 관리 ↗
              </Link>
            )}
          </div>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            가입{" "}
            {new Date(u.created_at).toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}{" "}
            · 최근 로그인{" "}
            {u.last_sign_in_at
              ? new Date(u.last_sign_in_at).toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })
              : "기록 없음"}{" "}
            ·{" "}
            {u.deletion_requested_at
              ? "탈퇴 요청"
              : u.suspended_at
                ? "임시조치"
                : u.is_public
                  ? "공개 설정"
                  : "비공개·미작성"}
          </p>
        </div>
      ))}
      {!rows.length && (
        <p className="text-sm text-slate-500">조건에 맞는 회원이 없습니다.</p>
      )}
      <div className="flex justify-between text-sm text-primary">
        {offset > 0 ? (
          <Link
            href={`/admin?view=profiles&member=${encodeURIComponent(query)}&offset=${Math.max(0, offset - 50)}`}
          >
            이전 50명
          </Link>
        ) : (
          <span />
        )}
        {rows.length > 50 && (
          <Link
            href={`/admin?view=profiles&member=${encodeURIComponent(query)}&offset=${offset + 50}`}
          >
            다음 50명
          </Link>
        )}
      </div>
    </section>
  );
}
