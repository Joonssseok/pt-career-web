"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const COOKIE = "pt-career-skip-landing-until";

export function LandingVisitTracker() {
  const router = useRouter();
  const recorded = useRef(false);
  useEffect(() => {
    // Strict Mode replays effects; the first display must remain visible.
    if (recorded.current) return;
    recorded.current = true;
    const stored = document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${COOKIE}=`));
    const until = Number(stored?.slice(COOKIE.length + 1));
    if (Number.isFinite(until) && until > Date.now()) {
      router.replace("/home");
      return;
    }
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${expiresAt}; Max-Age=86400; Path=/; SameSite=Lax${secure}`;
  }, [router]);
  return null;
}
