import { notFound, redirect } from "next/navigation";
import { ownVideoProfile } from "@/app/actions/profile-videos";
import { getProfilePost } from "@/app/actions/profile-posts";
import { ProfilePostBoard } from "@/components/experts/ProfilePostBoard";
import { AccountSidebar } from "@/components/AccountSidebar";
export const dynamic = "force-dynamic";
export default async function OwnPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const own = await ownVideoProfile();
  if (!own.ok) redirect("/login?next=/my/content");
  if (!own.profileId) notFound();
  const { postId } = await params;
  const result = await getProfilePost(own.profileId, postId, true);
  if (!result.ok || !result.post) notFound();
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F8] md:flex-row">
      <AccountSidebar />
      <main className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-5 py-10">
        <ProfilePostBoard
          profileId={own.profileId}
          initialPosts={[]}
          selectedPost={result.post}
          owner
          canWrite={own.canWrite}
        />
      </main>
    </div>
  );
}
