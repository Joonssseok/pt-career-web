import { normalizeServiceKey } from "@/lib/supabase/service-key";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function GET(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secret = normalizeServiceKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!secret)
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.rpc("purge_expired_site_events");
  return NextResponse.json(
    error ? { error: "Retention cleanup failed" } : { removed: data },
    { status: error ? 503 : 200 },
  );
}
