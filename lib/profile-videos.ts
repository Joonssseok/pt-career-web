export type ProfileVideo = {
  id: string;
  videoId: string;
  title: string;
  caption?: string;
  visibility: "public" | "private";
  adminHidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export const PROFILE_VIDEO_PAGE_SIZE = 12;
export const VIDEO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function profileVideoTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim();
  return title &&
    [...title].length <= 80 &&
    !/[\u0000-\u001f\u007f<>]/.test(title)
    ? title
    : null;
}

// Read only the title; never use oEmbed's supplied HTML or thumbnail URL.
export async function youtubeTitle(
  videoId: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return "";
  try {
    const response = await fetcher(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
        cache: "no-store",
      },
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json") ||
      !response.body
    )
      return "";
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 32768) {
          await reader.cancel();
          return "";
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return profileVideoTitle(data?.title) ?? "";
  } catch {
    return "";
  }
}
