// Server configuration only. Legacy values can have a separate line label.
export function normalizeServiceKey(
  value: string | undefined,
): string | undefined {
  const candidate = value?.trim().split(/\r?\n/).pop()?.trim();
  if (!candidate) return undefined;
  if (
    /^sb_secret_[A-Za-z0-9_-]+$/.test(candidate) ||
    /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(candidate)
  )
    return candidate;
  return undefined;
}
