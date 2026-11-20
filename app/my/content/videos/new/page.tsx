import { redirect } from "next/navigation";
import { ownVideoProfile } from "@/app/actions/profile-videos";
import { ProfileVideoComposer } from "@/components/experts/ProfileVideoLibrary";

export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  const own = await ownVideoProfile();
  if (!own.ok) redirect("/login?next=/my/content/videos/new");
  if (!own.profileId || !own.canWrite) redirect("/my/content");
  return <ProfileVideoComposer profileId={own.profileId} />;
}
