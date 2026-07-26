export function getProfilePhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return `/api/profile-photo/${path}`;
}
