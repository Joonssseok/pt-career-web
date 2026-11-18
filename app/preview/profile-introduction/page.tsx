import { DetailFormatPreview } from "./DetailFormatPreview";
import { getOwnProfileDetailImages } from "@/app/actions/profile-detail-images";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntroductionFormatPreview } from "./IntroductionFormatPreview";

export default async function IntroductionPreview({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string; detail?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=/preview/profile-introduction");
  const { profile, detail } = await searchParams;
  const [{ data: base }, { data: version }] = await Promise.all([
    client
      .from("profiles")
      .select("display_name,introduction")
      .eq("user_id", user.id)
      .maybeSingle(),
    profile && /^[0-9a-f-]{36}$/i.test(profile)
      ? client
          .from("profile_versions")
          .select("id,draft_content")
          .eq("owner_id", user.id)
          .eq("id", profile)
          .maybeSingle()
      : client
          .from("profile_versions")
          .select("id,draft_content")
          .eq("owner_id", user.id)
          .eq("is_representative", true)
          .maybeSingle(),
  ]);
  if (detail === "1") {
    const files = version?.id
      ? await getOwnProfileDetailImages(version.id)
      : { images: [] };
    return (
      <DetailFormatPreview
        initialDocument={version?.draft_content?.detailDocument}
        initialImages={files.images}
      />
    );
  }
  return (
    <IntroductionFormatPreview
      initialText={
        typeof version?.draft_content?.introduction === "string"
          ? version.draft_content.introduction
          : (base?.introduction ?? "")
      }
      name={base?.display_name ?? ""}
    />
  );
}
