import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ review: string; file: string }> },
) {
  const { review, file } = await params;
  if (![review, file].every((v) => /^[0-9a-f-]{36}$/i.test(v)))
    return new NextResponse(null, { status: 404 });
  const client = await createClient();
  const { data, error } = await client.rpc("profile_review_file", {
    p_review: review,
    p_file: file,
  });
  const entry = data?.[0];
  if (error || !entry) return new NextResponse(null, { status: 404 });
  const result = await client.storage.from("damoa-files").download(entry.path);
  if (result.error || !result.data)
    return new NextResponse(null, { status: 404 });
  return new NextResponse(result.data, {
    headers: {
      "Content-Type": entry.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(entry.name)}`,
    },
  });
}
