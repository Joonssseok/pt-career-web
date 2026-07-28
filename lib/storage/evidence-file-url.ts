export function getEvidenceFileUrl(path: string | null): string | null {
  if (!path) return null;
  return `/api/evidence-file/${path}`;
}
