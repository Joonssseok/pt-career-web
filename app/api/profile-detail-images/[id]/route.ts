import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DETAIL_IMAGE_MIME_TYPES } from "@/lib/profile-versions/detail-images";
export const dynamic = "force-dynamic";

function byteRange(
  value: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    start > end
  )
    return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new NextResponse(null, { status: 404 });
  try {
    const client = await createClient();
    const { data: path, error } = await client.rpc(
      "profile_detail_image_path",
      {
        p_file: id,
      },
    );
    if (error || !path) return new NextResponse(null, { status: 404 });
    const file = await client.storage
      .from("profile-detail-images")
      .download(path);
    if (file.error || !file.data)
      return new NextResponse(null, { status: 404 });
    if (!DETAIL_IMAGE_MIME_TYPES.includes(file.data.type))
      return new NextResponse(null, { status: 404 });
    const blob = file.data;
    const headers = new Headers({
      "Content-Type": blob.type,
      "Content-Length": String(blob.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    });
    // Without a matching validator, If-Range requires the complete representation.
    const requestedRange = request.headers.has("if-range")
      ? null
      : request.headers.get("range");
    if (requestedRange !== null) {
      const range = byteRange(requestedRange, blob.size);
      if (!range) {
        headers.set("Content-Range", `bytes */${blob.size}`);
        headers.set("Content-Length", "0");
        return new NextResponse(null, { status: 416, headers });
      }
      headers.set(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${blob.size}`,
      );
      headers.set("Content-Length", String(range.end - range.start + 1));
      return new NextResponse(
        blob.slice(range.start, range.end + 1, blob.type).stream(),
        {
          status: 206,
          headers,
        },
      );
    }
    return new NextResponse(blob.stream(), { headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
