import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new NextResponse(null, { status: 404 });
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { data: file, error } = await client
    .from("damoa_files")
    .select("path,name,mime")
    .eq("owner", user.id)
    .eq("id", id)
    .eq("ready", true)
    .eq("deleting", false)
    .single();
  if (error || !file) return new NextResponse(null, { status: 404 });
  const { data, error: downloadError } = await client.storage
    .from("damoa-files")
    .download(file.path);
  if (downloadError || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
  });
}
