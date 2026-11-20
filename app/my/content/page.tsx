import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountSidebar } from "@/components/AccountSidebar";
import { ProfileVideoLibrary } from "@/components/experts/ProfileVideoLibrary";
import { ProfilePostBoard } from "@/components/experts/ProfilePostBoard";
import { loadProfilePosts } from "@/app/actions/profile-posts";
import {
  ownVideoProfile,
  loadProfileVideos,
} from "@/app/actions/profile-videos";

export const dynamic = "force-dynamic";

export default async function MyContentPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login?next=/my/content");
  const own = await ownVideoProfile();
  const result =
    own.ok && own.profileId
      ? await loadProfileVideos(own.profileId, true)
      : null;
  const posts =
    own.ok && own.profileId
      ? await loadProfilePosts(own.profileId, true)
      : null;
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F8] md:flex-row">
      <AccountSidebar />
      <main className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-5 py-10">
        <h1 className="mb-8 text-2xl">내 글·영상</h1>
        {!own.ok ? (
          <p role="alert">{own.error}</p>
        ) : !own.profileId ? (
          <p>
            프로필을 만든 뒤 이용할 수 있습니다.{" "}
            <Link href="/my/profiles">프로필 관리</Link>
          </p>
        ) : (
          <>
            {!own.canWrite && (
              <p className="mb-6 text-sm text-slate-600">
                프로필을 공개하면 영상을 추가할 수 있습니다. 기존 영상은
                보관되며 방문자에게 표시되지 않습니다.
              </p>
            )}
            <section aria-label="내 영상">
              <h2 className="mb-5 text-xl">영상</h2>
              {result?.ok ? (
                <ProfileVideoLibrary
                  profileId={own.profileId}
                  initialVideos={result.videos}
                  owner
                  canWrite={own.canWrite}
                />
              ) : (
                <p role="alert">
                  {result && !result.ok
                    ? result.error
                    : "영상을 불러오지 못했습니다."}
                </p>
              )}
            </section>
            <section className="mt-12">
              <h2 className="mb-4 text-xl">게시판</h2>
              <ProfilePostBoard
                key={JSON.stringify(posts)}
                profileId={own.profileId}
                initialPosts={posts?.ok ? posts.posts : []}
                owner
                canWrite={own.canWrite}
                storageReady={!!posts?.ok}
                includeDrafts
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
