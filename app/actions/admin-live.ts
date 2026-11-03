"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EXCLUDE_COOKIE, validHttps } from "@/lib/analytics";
async function admin() {
  const c = await createClient();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const r = await c.rpc("is_admin");
  if (r.error || !r.data) throw new Error("관리자 권한이 필요합니다.");
  return c;
}
export async function setStatisticsExclusion(exclude: boolean) {
  await admin();
  const jar = await cookies();
  if (exclude)
    jar.set(EXCLUDE_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 31536000,
      path: "/",
    });
  else jar.delete(EXCLUDE_COOKIE);
  revalidatePath("/admin");
  return { ok: true as const };
}
export async function saveCampaign(p: Record<string, unknown>) {
  try {
    const c = await admin();
    if (!validHttps(p.image_url) || !validHttps(p.target_url))
      throw new Error("이미지와 이동 주소는 올바른 HTTPS 주소여야 합니다.");
    if (
      typeof p.advertiser !== "string" ||
      !p.advertiser.trim() ||
      p.advertiser.length > 100 ||
      typeof p.title !== "string" ||
      !p.title.trim() ||
      p.title.length > 100 ||
      !["left", "right"].includes(String(p.slot)) ||
      typeof p.amount !== "number" ||
      !Number.isSafeInteger(p.amount) ||
      p.amount < 0 ||
      p.amount > 1000000000 ||
      typeof p.active !== "boolean" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(p.starts_on)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(p.ends_on)) ||
      String(p.ends_on) < String(p.starts_on)
    )
      throw new Error("광고 입력 내용을 확인해주세요.");
    const r = await c.rpc("save_ad_campaign", { p });
    if (r.error) throw new Error(r.error.message);
    revalidatePath("/admin");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "저장하지 못했습니다.",
    };
  }
}
export async function addOperatingEntry(p: Record<string, unknown>) {
  try {
    const c = await admin();
    if (
      !["payment", "expense", "backup_check"].includes(String(p.kind)) ||
      typeof p.label !== "string" ||
      !p.label.trim() ||
      p.label.length > 200 ||
      typeof p.amount !== "number" ||
      !Number.isSafeInteger(p.amount) ||
      p.amount < 0 ||
      p.amount > 1000000000 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(p.occurred_on)) ||
      typeof p.note !== "string" ||
      p.note.length > 2000
    )
      throw new Error("운영 기록 입력 내용을 확인해주세요.");
    const r = await c.rpc("add_operating_entry", { p });
    if (r.error) throw new Error(r.error.message);
    revalidatePath("/admin");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "기록하지 못했습니다.",
    };
  }
}
