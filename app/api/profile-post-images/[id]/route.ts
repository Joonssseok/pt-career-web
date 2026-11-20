import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_UUID } from "@/lib/profile-videos";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!VIDEO_UUID.test(id)) return new NextResponse(null, { status: 404 });
  try {
    const db = await createClient();
    const { data: path, error } = await db.rpc("profile_post_image_path", {
      p_file: id,
    });
    if (error || typeof path !== "string")
      return new NextResponse(null, { status: 404 });
    const { data: file, error: downloadError } = await db.storage
      .from("profile-post-images")
      .download(path);
    if (
      downloadError ||
      !file ||
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      )
    )
      return new NextResponse(null, { status: 404 });
    return new NextResponse(file.stream(), {
      headers: {
        "Content-Type": file.type,
        "Content-Length": String(file.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
