import { createClient } from "@/lib/supabase/client";
import { Activity, Attachment, validateActivity } from "./categories";
export const FILE_LIMIT = 10 * 1024 * 1024;
const BUCKET = "damoa-files";
type Row = {
  owner: string;
  id: string;
  content: Omit<Activity, "owner" | "id" | "updated" | "revision">;
  updated_at: string;
};
function activity(row: Row): Activity {
  return {
    ...row.content,
    owner: row.owner,
    id: row.id,
    updated: row.updated_at,
    revision: row.updated_at,
  };
}
function failure(error: { message: string }) {
  if (
    /damoa_|schema cache|does not exist/i.test(error.message) &&
    !/[가-힣]/.test(error.message)
  )
    return new Error(
      "서버 저장소 연결이 준비되지 않았습니다. 브라우저 원본은 그대로 유지됩니다.",
    );
  return new Error(error.message);
}
export async function loadActivities(owner: string): Promise<Activity[]> {
  const client = createClient();
  // Page explicitly: the API's default row limit must not silently hide older records.
  const rows: Activity[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await client
      .from("damoa_activities")
      .select("*")
      .eq("owner", owner)
      .order("id")
      .range(from, from + 499);
    if (error) throw failure(error);
    rows.push(...(data as Row[]).map(activity));
    if (data.length < 500) break;
  }
  return rows.sort((a, b) => b.updated.localeCompare(a.updated));
}
type StoredFile = { id: string; activity_id: string; bytes: number };
async function loadFiles(owner: string): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await createClient()
      .from("damoa_files")
      .select("id,activity_id,bytes")
      .eq("owner", owner)
      .order("id")
      .range(from, from + 499);
    if (error) throw failure(error);
    files.push(...(data as StoredFile[]));
    if (data.length < 500) return files;
  }
}
export async function loadFileUsage(owner: string): Promise<number> {
  return (await loadFiles(owner)).reduce(
    (sum, file) => sum + Number(file.bytes),
    0,
  );
}
async function upload(owner: string, activityId: string, file: Attachment) {
  const client = createClient();
  if (file.path) return;
  if (!file.blob || file.blob.size !== file.size || file.blob.size > FILE_LIMIT)
    throw new Error(
      "파일은 한 개당 10MB 이하로 첨부해주세요. 브라우저 원본은 유지됩니다.",
    );
  const { data: reservation, error: reserveError } = await client.rpc(
    "damoa_reserve_file",
    {
      p_id: file.id,
      p_activity: activityId,
      p_name: file.name,
      p_mime: file.type,
    },
  );
  if (reserveError) throw failure(reserveError);
  if (!reservation.ready) {
    const { error } = await client.storage
      .from(BUCKET)
      .upload(reservation.path, file.blob, {
        contentType: file.type,
        upsert: false,
        cacheControl: "0",
      });
    // A lost response may have left the immutable object in storage. Verify it before retrying.
    if (error && !("statusCode" in error && String(error.statusCode) === "409"))
      throw failure(error);
  }
  const { data: confirmed, error } = await client.rpc("damoa_finish_file", {
    p_id: file.id,
  });
  if (error) throw failure(error);
  file.path = confirmed.path;
  file.size = Number(confirmed.bytes);
  if (!file.path?.startsWith(owner + "/"))
    throw new Error("첨부 자료의 소유자를 확인하지 못했습니다.");
}
export async function saveActivity(
  row: Activity,
  createOnly = false,
): Promise<Activity> {
  validateActivity(row);
  const files = row.files.map((file) => ({ ...file }));
  for (const file of files) await upload(row.owner, row.id, file);
  const { owner, id, updated, revision, files: originalFiles, ...fields } = row;
  const content = { ...fields, files: files.map(({ id }) => ({ id })) };
  const { data, error } = await createClient().rpc("damoa_save_activity", {
    p_id: id,
    p_content: content,
    p_expected: revision ?? null,
    p_create_only: createOnly,
  });
  if (error) throw failure(error);
  return activity(data as Row);
}
export async function deleteActivity(
  owner: string,
  id: string,
  revision?: string,
): Promise<void> {
  if (!revision) throw new Error("기록을 다시 불러와주세요.");
  const { error } = await createClient().rpc("damoa_delete_activity", {
    p_id: id,
    p_expected: revision,
  });
  if (error) throw failure(error);
}
export async function cleanupUnusedFiles(
  owner: string,
  activityId?: string,
): Promise<void> {
  const client = createClient();
  const files = await loadFiles(owner);
  for (const file of files) {
    if (activityId && file.activity_id !== activityId) continue;
    const { data: path, error: claimError } = await client.rpc(
      "damoa_claim_file_delete",
      { p_id: file.id },
    );
    if (claimError) throw failure(claimError);
    if (!path) continue;
    const { error: removeError } = await client.storage
      .from(BUCKET)
      .remove([path]);
    if (removeError) throw failure(removeError);
    const { error: releaseError } = await client.rpc("damoa_release_file", {
      p_id: file.id,
    });
    if (releaseError) throw failure(releaseError);
  }
}
export async function importBrowserActivities(
  owner: string,
  rows: Activity[],
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    if (row.owner !== owner)
      throw new Error("다른 계정의 기록은 옮길 수 없습니다.");
    const current = await createClient()
      .from("damoa_activities")
      .select("id")
      .eq("owner", owner)
      .eq("id", row.id)
      .maybeSingle();
    if (current.error) throw failure(current.error);
    // The create-only RPC records a receipt even if another tab already imported this ID.
    if (current.data) {
      const { error } = await createClient().rpc("damoa_save_activity", {
        p_id: row.id,
        p_content: {},
        p_create_only: true,
      });
      if (error) throw failure(error);
      continue;
    }
    const saved = await saveActivity({ ...row, revision: undefined }, true);
    const { data, error } = await createClient()
      .from("damoa_activities")
      .select("id,updated_at")
      .eq("owner", owner)
      .eq("id", saved.id)
      .single();
    if (error || !data)
      throw new Error(
        "서버 저장 확인에 실패했습니다. 브라우저 원본은 유지됩니다.",
      );
    count++;
  }
  return count;
}

export async function pendingBrowserActivities(
  owner: string,
  rows: Activity[],
): Promise<Activity[]> {
  if (!rows.length) return [];
  const seen = new Set<string>();
  for (let from = 0; from < rows.length; from += 100) {
    const { data, error } = await createClient()
      .from("damoa_browser_imports")
      .select("id")
      .eq("owner", owner)
      .in(
        "id",
        rows.slice(from, from + 100).map((r) => r.id),
      );
    if (error) throw failure(error);
    data.forEach((row) => seen.add(row.id));
  }
  return rows.filter((row) => !seen.has(row.id));
}
