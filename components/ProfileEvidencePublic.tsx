import { createClient } from "@/lib/supabase/server";
export async function ProfileEvidencePublic({
  profileId,
}: {
  profileId: string;
}) {
  const client = await createClient();
  const { data, error } = await client.rpc("public_profile_item_reviews", {
    p_profile: profileId,
  });
  if (error || !data?.length) return null;
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
      <h2 className="font-bold">인증 내역</h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        방문자에게 제공되는 사본에는 PT Career 워터마크와 보이지 않는 식별
        표식이 포함됩니다.
      </p>
      <div className="mt-3 space-y-3">
        {data.map(
          (row: {
            id: string;
            title: string;
            files: { id: string; name: string }[];
          }) => (
            <div key={row.id}>
              <p className="text-sm font-semibold">
                {row.title}{" "}
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  관리자 인증
                </span>
              </p>
              {row.files.map((f) => (
                <a
                  key={f.id}
                  href={`/api/profile-evidence/${row.id}/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-xs text-primary"
                >
                  {f.name} ↗
                </a>
              ))}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
