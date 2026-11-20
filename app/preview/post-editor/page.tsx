import { notFound, redirect } from "next/navigation";
import { ownVideoProfile } from "@/app/actions/profile-videos";
import { ProfilePostComposer } from "@/components/experts/ProfilePostComposer";
export const dynamic = "force-dynamic";
export default async function PostEditorPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const own = await ownVideoProfile();
  if (!own.ok) redirect("/login?next=/preview/post-editor");
  if (!own.profileId) redirect("/my/profiles");
  return <ProfilePostComposer profileId={own.profileId} storageReady={false} />;
}
