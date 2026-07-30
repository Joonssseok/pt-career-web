export function getGalleryImageUrl(path: string | null): string | null {
  if (!path) return null;
  return `/api/profile-gallery/${path}`;
}
