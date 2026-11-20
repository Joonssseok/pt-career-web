import { redirect } from "next/navigation";
import { ownVideoProfile } from "@/app/actions/profile-videos";
import { loadProfilePosts } from "@/app/actions/profile-posts";
import { ProfilePostComposer } from "@/components/experts/ProfilePostComposer";
export const dynamic = "force-dynamic";
export default async function NewPostPage() {
  const own = await ownVideoProfile();
  if (!own.ok) redirect("/login?next=/my/content/posts/new");
  if (!own.profileId || !own.canWrite) redirect("/my/content");
  const ready = await loadProfilePosts(own.profileId, true);
  return (
    <ProfilePostComposer profileId={own.profileId} storageReady={ready.ok} />
  );
}
