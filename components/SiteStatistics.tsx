"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { publicPath, trackEvent } from "@/lib/analytics";
export function SiteStatistics() {
  const path = usePathname();
  const last = useRef("");
  useEffect(() => {
    if (!publicPath(path) || last.current === path) return;
    last.current = path;
    trackEvent("pageview");
  }, [path]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a");
      if (!a || !/^\/experts\/[0-9a-f-]{36}$/.test(location.pathname)) return;
      const href = a.getAttribute("href") || "";
      if (!a.closest("[data-profile-contact]")) return;
      if (
        /^(https?:|mailto:|tel:)/.test(href) &&
        !a.hasAttribute("data-ad-campaign")
      )
        trackEvent("contact");
    };
    const submit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if (f.querySelector('input[type="search"],input[name="query"]'))
        trackEvent("search");
    };
    document.addEventListener("click", click);
    document.addEventListener("submit", submit);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("submit", submit);
    };
  }, []);
  return null;
}
