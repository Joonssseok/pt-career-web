import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { PublicItemReview } from "@/components/ProfileEvidencePublic";

export async function publicItemReviews(
  profileId: string,
  visibleKeys: Set<string>,
): Promise<Map<string, PublicItemReview> | undefined> {
  const result = new Map<string, PublicItemReview>();
  if (!visibleKeys.size) return result;
  const client = await createClient();
  const { data, error } = await client.rpc("public_profile_item_review_marks", {
    p_profile: profileId,
  });
  if (error) return undefined;
  if (!data?.length) return result;
  const keys = new Map(
    [...visibleKeys].map((key) => [
      createHash("sha256").update(key).digest("hex"),
      key,
    ]),
  );
  for (const review of data as (PublicItemReview & { item_ref: string })[]) {
    const key = keys.get(review.item_ref);
    if (key) result.set(key, { id: review.id, files: review.files });
  }
  return result;
}
