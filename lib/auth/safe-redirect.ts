/**
 * Validates and sanitizes redirect URLs to prevent open redirect attacks.
 * Only allows internal relative paths starting with '/'.
 * Blocks: external URLs, protocols, double slashes, encoded attacks.
 */
export function validateRedirectUrl(url: string | null): boolean {
  if (!url) return false

  // Block if not a string
  if (typeof url !== 'string') return false

  // Block empty string
  if (url.length === 0) return false

  // Block if starts with // (protocol-relative URLs)
  if (url.startsWith('//')) return false

  // Block if contains :// (protocol URLs like https://evil.com)
  if (url.includes('://')) return false

  // Block if starts with backslash (Windows path escape)
  if (url.startsWith('\\')) return false

  // Block if not starting with / (must be relative path)
  if (!url.startsWith('/')) return false

  // Block if contains backslash
  if (url.includes('\\')) return false

  // Block if contains null byte
  if (url.includes('\0')) return false

  // Block if contains control characters
  if (/[\x00-\x1F\x7F]/g.test(url)) return false

  // Block if contains URL-encoded dangerous characters: %2F (/) or %5C (\)
  if (/%2[fF]|%5[cC]/g.test(url)) return false

  // Allow only internal paths
  return true
}

/**
 * Gets safe redirect URL, defaulting to fallback if validation fails.
 */
export function getSafeRedirectUrl(
  nextUrl: string | null,
  fallback: string = '/my'
): string {
  if (validateRedirectUrl(nextUrl)) {
    return nextUrl as string
  }
  return fallback
}
