"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { trackEvent, validHttps } from "@/lib/analytics";
import styles from "./SideAdSlots.module.css";
type PublicAd = {
  id: string;
  title: string;
  slot: "left" | "right";
  image_url: string;
  target_url: string;
};
function VisibleAd({ ad }: { ad: PublicAd }) {
  const link = useRef<HTMLAnchorElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const element = link.current;
    if (!element || !loaded) return;
    let timer: ReturnType<typeof setTimeout> | undefined,
      visible = false,
      counted = false;
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const check = () => {
      cancel();
      if (visible && !counted && document.visibilityState === "visible")
        timer = setTimeout(() => {
          counted = true;
          trackEvent("ad_view", ad.id);
        }, 1000);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        check();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancel();
      observer.disconnect();
      document.removeEventListener("visibilitychange", check);
    };
  }, [ad.id, loaded]);
  return (
    <a
      ref={link}
      className={styles.activeBanner}
      href={ad.target_url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      data-ad-campaign={ad.id}
      onClick={() => trackEvent("ad_click", ad.id)}
      aria-label={`광고: ${ad.title}`}
    >
      <span className={styles.label}>광고</span>
      {/* Supplied banners keep their exact 160×600 creative size. */}
      <img
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        src={ad.image_url}
        alt={ad.title}
        width={160}
        height={600}
        referrerPolicy="no-referrer"
      />
    </a>
  );
}
export function SideAdSlots() {
  const pathname = usePathname();
  const rail = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = matchMedia("(min-width: 1680px) and (min-height: 960px)");
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [footerHeight, setFooterHeight] = useState(240),
    [ads, setAds] = useState<PublicAd[]>([]);
  useEffect(() => {
    const footer = rail.current?.parentElement?.querySelector("footer");
    if (!footer) return;
    const measure = () =>
      setFooterHeight(Math.ceil(footer.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    measure();
    return () => observer.disconnect();
  }, [pathname]);
  useEffect(() => {
    const controller = new AbortController();
    setAds([]);
    void fetch("/api/ads", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const data: unknown = await r.json();
        if (Array.isArray(data))
          setAds(
            data.filter(
              (a): a is PublicAd =>
                a &&
                typeof a.id === "string" &&
                typeof a.title === "string" &&
                ["left", "right"].includes(a.slot) &&
                validHttps(a.image_url) &&
                validHttps(a.target_url),
            ),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  return (
    <div
      ref={rail}
      className={`${styles.rails} ${pathname === "/home" ? styles.homeRails : ""}`}
      style={{ "--ad-footer-height": `${footerHeight}px` } as CSSProperties}
    >
      {(["left", "right"] as const).map((side) => {
        const ad = ads.find((a) => a.slot === side);
        return (
          <div
            key={side}
            className={`${styles.rail} ${styles[side]}`}
            aria-hidden={ad ? undefined : true}
          >
            <div className={styles.sticky}>
              <div className={styles.banner}>
                {ad && wide && (
                  <VisibleAd key={`${pathname}:${ad.id}`} ad={ad} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
