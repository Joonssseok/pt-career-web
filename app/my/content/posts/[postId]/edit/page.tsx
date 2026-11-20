import { notFound, redirect } from "next/navigation";
import { ownVideoProfile } from "@/app/actions/profile-videos";
import { getProfilePost } from "@/app/actions/profile-posts";
import { ProfilePostComposer } from "@/components/experts/ProfilePostComposer";
export const dynamic = "force-dynamic";
export default async function EditPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const own = await ownVideoProfile();
  if (!own.ok) redirect("/login?next=/my/content");
  if (!own.profileId || !own.canWrite) redirect("/my/content");
  const { postId } = await params;
  const result = await getProfilePost(own.profileId, postId, true);
  if (!result.ok || !result.post) notFound();
  return (
    <ProfilePostComposer
      profileId={own.profileId}
      storageReady
      post={result.post}
    />
  );
}
