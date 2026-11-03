import { normalizeServiceKey } from "@/lib/supabase/service-key";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  ANALYTICS_COOKIE,
  EXCLUDE_COOKIE,
  EVENT_KINDS,
  publicPath,
} from "@/lib/analytics";
export async function POST(request: NextRequest) {
  const skip = () => new NextResponse(null, { status: 204 });
  if (
    process.env.VERCEL_ENV !== "production" ||
    request.headers.get("origin") !== request.nextUrl.origin ||
    request.cookies.has(EXCLUDE_COOKIE) ||
    request.headers.get("dnt") === "1" ||
    request.headers.get("sec-gpc") === "1"
  )
    return skip();
  if (
    /bot|crawler|spider|headless|preview/i.test(
      request.headers.get("user-agent") || "",
    )
  )
    return skip();
  if (Number(request.headers.get("content-length") || 0) > 4096)
    return new NextResponse(null, { status: 413 });
  const text = await request.text();
  if (text.length > 4096) return new NextResponse(null, { status: 413 });
  let p;
  try {
    p = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !p ||
    typeof p.id !== "string" ||
    !uuid.test(p.id) ||
    !EVENT_KINDS.includes(p.kind) ||
    typeof p.path !== "string" ||
    !publicPath(p.path) ||
    !["mobile", "tablet", "desktop"].includes(p.device) ||
    typeof p.referrer !== "string" ||
    p.referrer.length > 200 ||
    !/^[a-zA-Z0-9.-]*$/.test(p.referrer) ||
    (p.campaign_id && !uuid.test(p.campaign_id))
  )
    return new NextResponse(null, { status: 400 });
  const session = await createClient();
  const {
    data: { user },
    error: authError,
  } = await session.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") return skip();
  if (user) {
    const role = await session.rpc("is_admin");
    if (role.error) return skip();
    if (role.data) {
      const r = skip();
      r.cookies.set(EXCLUDE_COOKIE, "1", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 31536000,
        path: "/",
      });
      return r;
    }
  }
  const secret = normalizeServiceKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!secret) {
    console.error("[statistics] server credential missing");
    return new NextResponse(null, { status: 503 });
  }
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const existing = request.cookies.get(ANALYTICS_COOKIE)?.value;
  const visitor_id =
    existing && uuid.test(existing) ? existing : crypto.randomUUID();
  const { error } = await service.rpc("collect_site_event", {
    p: {
      id: p.id,
      kind: p.kind,
      path: p.path,
      referrer: p.referrer,
      device: p.device,
      campaign_id: p.campaign_id,
      visitor_id,
    },
  });
  if (error) {
    // SDK messages can contain invalid header values; log only the error code.
    console.error("[statistics] collection failed", {
      code: error.code || "unknown",
    });
    return new NextResponse(null, { status: 503 });
  }
  const response = skip();
  response.cookies.set(ANALYTICS_COOKIE, visitor_id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 2592000,
    path: "/",
  });
  return response;
}
