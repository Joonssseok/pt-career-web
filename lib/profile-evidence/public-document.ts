import { createClient as createStorageClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeServiceKey } from "@/lib/supabase/service-key";
import { watermarkEvidence } from "./watermark";

export const evidenceHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "sandbox; default-src 'none'",
};
export const evidenceId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function publicEvidenceDocument(review: string, file: string) {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("public_profile_evidence_file", {
      p_review: review,
      p_file: file,
    });
    if (error) return { status: 503 as const };
    const source = data?.[0];
    if (!source) return { status: 404 as const };
    if (!source.revision || Number(source.bytes) > 10 * 1024 * 1024)
      return { status: 422 as const };

    // The public resolver checks consent and the current published item before privileged storage access.
    const secret = normalizeServiceKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const storage = secret
      ? createStorageClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : client;
    const download = await storage.storage
      .from("damoa-files")
      .download(source.path);
    if (download.error || !download.data) return { status: 503 as const };
    const original = Buffer.from(await download.data.arrayBuffer());
    try {
      const document = await watermarkEvidence(original, source.mime, {
        reviewId: review,
        fileId: file,
      });
      // Rendering may take time; consent or approval can be withdrawn while it runs.
      const current = await client.rpc("public_profile_evidence_file", {
        p_review: review,
        p_file: file,
      });
      if (current.error) return { status: 503 as const };
      const latest = current.data?.[0];
      if (
        !latest ||
        latest.path !== source.path ||
        latest.revision !== source.revision
      )
        return { status: 404 as const };
      const stem = String(source.name)
        .replace(/\.[^.]*$/, "")
        .replace(/[\r\n]/g, "");
      return {
        status: 200 as const,
        document,
        filename: `${stem}.pt-career.${document.extension}`,
      };
    } catch {
      // An unsupported document must never fall back to the unwatermarked original.
      return { status: 422 as const };
    }
  } catch {
    return { status: 503 as const };
  }
}
