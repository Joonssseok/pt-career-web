"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient as createAuthClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  personalGateSecret,
  personalSessionBinding,
  PERSONAL_GATE_COOKIE,
} from "@/lib/auth/personal-info-gate";
import {
  signPersonalTicket,
  PERSONAL_TICKET_SECONDS,
} from "@/lib/auth/personal-info-ticket";
export async function confirmPersonalPassword(password: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "로그인이 필요합니다." };
  if (!password || password.length > 256)
    return { ok: false, error: "현재 비밀번호를 입력해주세요." };
  const secret = personalGateSecret();
  if (!secret)
    return {
      ok: false,
      error: "본인 확인 연결을 준비하고 있습니다. 현재는 이용할 수 없습니다.",
    };
  const verifier = createAuthClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { data, error } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (error || data.user?.id !== user.id)
    return {
      ok: false,
      error:
        "비밀번호를 확인하지 못했습니다. 이메일 로그인 비밀번호를 확인해주세요.",
    };
  await verifier.auth.signOut({ scope: "local" });
  const binding = await personalSessionBinding(supabase);
  if (!binding)
    return {
      ok: false,
      error: "로그인 상태가 만료되었습니다. 다시 로그인해주세요.",
    };
  const cookieStore = await cookies();
  cookieStore.set(
    PERSONAL_GATE_COOKIE,
    signPersonalTicket(user.id, binding, secret),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/my/personal",
      maxAge: PERSONAL_TICKET_SECONDS,
    },
  );
  revalidatePath("/my/personal");
  return { ok: true, error: "" };
}
