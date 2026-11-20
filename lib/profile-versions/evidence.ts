import { createClient } from "@/lib/supabase/client";
import type { ReviewFile } from "./review-preview";
import { upload } from "@/lib/damoa/server-store";
export type EvidenceReview = {
  item_snapshot?: Record<string, unknown>;
  id: string;
  version_id: string;
  item_key: string;
  title: string;
  file_ids: string[];
  public_file_ids: string[];
  status: "draft" | "pending" | "verified" | "rejected";
  reason: string;
  updated_at: string;
};
export async function loadEvidenceReviews(version: string) {
  const client = createClient();
  const { data, error } = await client
    .from("profile_item_reviews")
    .select(
      "id,version_id,item_key,item_snapshot,title,file_ids,public_file_ids,status,reason,updated_at",
    )
    .eq("version_id", version);
  if (error)
    throw new Error("첨부·심사 내역을 불러오지 못했습니다. 다시 시도해주세요.");
  const rows = data as EvidenceReview[];
  const ids = [...new Set(rows.flatMap((r) => r.file_ids))];
  const files: Record<string, ReviewFile> = {};
  if (ids.length) {
    const result = await client
      .from("damoa_files")
      .select("id,name")
      .in("id", ids);
    if (result.error) throw new Error("첨부파일을 불러오지 못했습니다.");
    for (const f of result.data)
      files[f.id] = { ...f, href: "/api/damoa/files/" + f.id };
  }
  return { rows, files };
}
export async function storeEvidenceFile(
  owner: string,
  version: string,
  file: ReviewFile,
) {
  if (
    !file.maskedCopy ||
    !file.blob ||
    file.blob.type !== "image/jpeg" ||
    !file.blob.size ||
    file.blob.size > 10 * 1024 * 1024
  )
    throw new Error("먼저 개인정보 가리기에서 사본을 확인해주세요.");
  const blob = file.blob;
  const attachment = {
    id: file.id,
    name: file.name,
    size: blob.size,
    type: blob.type,
    blob,
  };
  await upload(owner, version, attachment);
  return attachment.id;
}
