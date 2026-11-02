"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateFeedback, type FeedbackInput } from "@/lib/feedback";
export async function submitFeedback(id: string, input: FeedbackInput) {
  const invalid = validateFeedback(input);
  if (invalid) return { ok: false as const, error: invalid };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return { ok: false as const, error: "새 접수 화면에서 다시 작성해주세요." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인 후 접수해주세요." };
  const { data, error } = await client.rpc("submit_feedback", {
    p_id: id,
    p_kind: input.kind,
    p_category: input.category,
    p_subject: input.subject,
    p_body: input.body,
    p_page_url: input.page_url,
  });
  if (error)
    return {
      ok: false as const,
      error: /does not exist|schema cache/i.test(error.message)
        ? "접수를 준비 중입니다. 잠시 후 다시 시도해주세요."
        : error.message,
    };
  revalidatePath("/my/feedback");
  revalidatePath("/feedback");
  revalidatePath("/admin");
  return { ok: true as const, id: data as string };
}
export async function updateFeedback(
  id: string,
  status: "reviewing" | "resolved",
  reply: string,
  expected: string,
) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { error } = await client.rpc("update_feedback", {
    p_id: id,
    p_status: status,
    p_reply: reply,
    p_expected: expected,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/my/feedback");
  revalidatePath("/feedback");
  revalidatePath("/admin");
  return { ok: true as const };
}
