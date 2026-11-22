"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  externalLinksValid,
  type SavedExternalLink,
} from "@/lib/external-links";
const unavailable =
  "외부 링크를 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
export async function getOwnExternalLinks(): Promise<
  { ok: true; links: SavedExternalLink[] } | { ok: false; error: string }
> {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, error: "로그인이 필요합니다." };
    const { data, error } = await db.rpc("load_own_external_links");
    if (error || !Array.isArray(data)) return { ok: false, error: unavailable };
    return { ok: true, links: data as SavedExternalLink[] };
  } catch {
    return { ok: false, error: unavailable };
  }
}
export async function saveExternalLinks(
  links: Omit<SavedExternalLink, "id">[],
  expectedLinks: Omit<SavedExternalLink, "id">[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!externalLinksValid(links))
    return {
      ok: false,
      error: "링크 이름·주소와 대표 링크 선택을 확인해주세요.",
    };
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, error: "로그인이 필요합니다." };
    const { data, error } = await db.rpc("save_own_external_links", {
      p_links: links,
      p_expected_links: expectedLinks,
    });
    if (!error && data?.[0]?.error === "External links changed")
      return {
        ok: false,
        error:
          "다른 창에서 외부 링크가 변경되었습니다. 현재 입력을 확인한 뒤 페이지를 새로 열어주세요.",
      };
    if (error || !data?.[0]?.ok) return { ok: false, error: unavailable };
    revalidatePath("/experts");
    revalidatePath("/my/profiles");
    return { ok: true };
  } catch {
    return { ok: false, error: unavailable };
  }
}
