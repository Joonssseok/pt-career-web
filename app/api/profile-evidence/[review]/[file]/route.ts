import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  evidenceHeaders,
  evidenceId,
  publicEvidenceDocument,
} from "@/lib/profile-evidence/public-document";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ review: string; file: string }> },
) {
  const { review, file } = await params;
  if (![review, file].every((v) => evidenceId.test(v)))
    return new NextResponse(null, { status: 404, headers: evidenceHeaders });

  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) {
    // This table's SELECT policy exposes a review only to its owner or an administrator.
    const access = await client
      .from("profile_item_reviews")
      .select("owner_id")
      .eq("id", review)
      .maybeSingle();
    if (access.error)
      return new NextResponse(null, { status: 503, headers: evidenceHeaders });
    if (access.data) {
      const { data, error } = await client.rpc("profile_review_file", {
        p_review: review,
        p_file: file,
      });
      const entry = data?.[0];
      if (error || !entry)
        return new NextResponse(null, {
          status: 404,
          headers: evidenceHeaders,
        });
      const result = await client.storage
        .from("damoa-files")
        .download(entry.path);
      if (result.error || !result.data)
        return new NextResponse(null, {
          status: 404,
          headers: evidenceHeaders,
        });
      const original = Buffer.from(await result.data.arrayBuffer());
      return new NextResponse(new Uint8Array(original), {
        headers: {
          ...evidenceHeaders,
          "Content-Type": entry.mime,
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(entry.name)}`,
        },
      });
    }
  }

  const published = await publicEvidenceDocument(review, file);
  if (published.status === 200) {
    const bytes = published.document.bytes;
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) return controller.close();
        const end = Math.min(offset + 64 * 1024, bytes.length);
        controller.enqueue(new Uint8Array(bytes.subarray(offset, end)));
        offset = end;
      },
    });
    return new NextResponse(stream, {
      headers: {
        ...evidenceHeaders,
        "Content-Type": published.document.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(published.filename)}`,
      },
    });
  }
  if (published.status !== 404)
    return new NextResponse(null, {
      status: published.status,
      headers: evidenceHeaders,
    });

  return new NextResponse(null, { status: 404, headers: evidenceHeaders });
}
