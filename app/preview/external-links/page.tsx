import { notFound } from "next/navigation";
import { getOwnProfile } from "@/app/actions/profile";
import { getOwnExternalLinks } from "@/app/actions/external-links";
import { ExternalLinksPreview } from "@/components/profile-editor/ExternalLinksPreview";

export const dynamic = "force-dynamic";

export default async function ExternalLinksPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const [result, saved] = await Promise.all([
    getOwnProfile(),
    getOwnExternalLinks(),
  ]);
  const profile = result.profile;
  return (
    <ExternalLinksPreview
      displayName={profile?.display_name || "내 프로필"}
      headline={profile?.headline ?? undefined}
      initialLinks={saved.ok ? saved.links : []}
    />
  );
}
