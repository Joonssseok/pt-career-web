import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new NextResponse(null, { status: 404 });
  const client = await createClient();
  const { data: path, error } = await client.rpc("profile_detail_image_path", {
    p_file: id,
  });
  if (error || !path) return new NextResponse(null, { status: 404 });
  const file = await client.storage
    .from("profile-detail-images")
    .download(path);
  if (file.error || !file.data) return new NextResponse(null, { status: 404 });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.data.type))
    return new NextResponse(null, { status: 404 });
  return new NextResponse(file.data.stream(), {
    headers: {
      "Content-Type": file.data.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
