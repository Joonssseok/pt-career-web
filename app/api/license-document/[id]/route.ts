import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Content-Disposition": "inline",
  };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return new NextResponse(null, { status: 404, headers });
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc(
    "get_public_license_document",
    { p_license_id: id },
  );
  if (error || typeof path !== "string" || !path)
    return new NextResponse(null, { status: 404, headers });
  const { data, error: downloadError } = await supabase.storage
    .from("evidence-files")
    .download(path);
  if (downloadError || !data)
    return new NextResponse(null, { status: 404, headers });
  const type = ["image/jpeg", "image/png", "application/pdf"].includes(
    data.type,
  )
    ? data.type
    : "application/octet-stream";
  return new NextResponse(await data.arrayBuffer(), {
    headers: { ...headers, "Content-Type": type },
  });
}
