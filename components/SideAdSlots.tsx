"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./SideAdSlots.module.css";

export function SideAdSlots() {
  const pathname = usePathname();
  const enabled = pathname === "/home" || pathname === "/experts";
  const rail = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(240);

  useEffect(() => {
    if (!enabled) return;
    const footer = rail.current?.parentElement?.querySelector("footer");
    if (!footer) return;
    const measure = () => setFooterHeight(Math.ceil(footer.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    measure();
    return () => observer.disconnect();
  }, [enabled, pathname]);

  if (!enabled) return null;
  return (
    <div aria-hidden="true" ref={rail} className={`${styles.rails} ${pathname === "/home" ? styles.homeRails : ""}`} style={{ "--ad-footer-height": `${footerHeight}px` } as CSSProperties}>
      {(["left", "right"] as const).map((side) => (
        <div key={side} className={`${styles.rail} ${styles[side]}`}>
          <div className={styles.sticky}>
            <div className={styles.banner} />
          </div>
        </div>
      ))}
    </div>
  );
}
