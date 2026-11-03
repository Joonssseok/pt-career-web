export const ANALYTICS_COOKIE = "pt_visit";
export const EXCLUDE_COOKIE = "pt_stats_excluded";
export const EVENT_KINDS = [
  "pageview",
  "search",
  "contact",
  "share",
  "ad_view",
  "ad_click",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export function publicPath(path: string) {
  return (
    /^\/(?:home|experts|about)?$/.test(path) ||
    /^\/experts\/[0-9a-f-]{36}$/.test(path)
  );
}
export function validHttps(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function trackEvent(kind: EventKind, campaign_id?: string) {
  if (
    typeof window === "undefined" ||
    !publicPath(location.pathname) ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl
  )
    return;
  let referrer = "";
  try {
    const u = new URL(document.referrer);
    if (u.hostname !== location.hostname) referrer = u.hostname;
  } catch {}
  const payload = {
    id: crypto.randomUUID(),
    kind,
    path: location.pathname,
    referrer,
    campaign_id,
    device:
      innerWidth < 768 ? "mobile" : innerWidth < 1024 ? "tablet" : "desktop",
  };
  void fetch("/api/statistics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
