import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await createClient();
  const { data, error } = await c.rpc("get_active_ad_campaigns");
  return NextResponse.json(
    error ? { error: "광고를 불러오지 못했습니다." } : data,
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
