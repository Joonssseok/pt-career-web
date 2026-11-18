import { createHash } from "node:crypto";

export type ShareProfile = {
  id: string;
  display_name: string | null;
  profile_image_path: string | null;
  professions: { name: string; is_primary: boolean }[];
};

export function shareImageText(profile: ShareProfile) {
  return {
    name: profile.display_name?.trim() || "PT Career 전문가",
    role: (profile.professions.find((p) => p.is_primary) || profile.professions[0])?.name || "",
  };
}

export function getProfileShareImageUrl(profile: ShareProfile) {
  const revision = createHash("sha256")
    .update(JSON.stringify(["name-role-v1", shareImageText(profile), profile.profile_image_path]))
    .digest("hex")
    .slice(0, 20);
  return `/api/profile-share-image/${profile.id}?v=${revision}`;
}
