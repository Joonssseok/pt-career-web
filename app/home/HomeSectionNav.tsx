"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";

const SECTIONS = [
  { id: "home-intro", label: "전문가 검색" },
  { id: "home-fields", label: "분야 탐색" },
  { id: "home-experts", label: "전문가 프로필" },
  { id: "home-create", label: "프로필 만들기" },
];

export function HomeSectionNav() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const main = document.getElementById("home-intro")?.closest("main");
    const search = main?.querySelector<HTMLElement>("[data-home-search]");
    const anchor = document.getElementById("home-search-anchor");
    if (!search || !anchor) return;
    const root = document.documentElement;
    const property = "--home-search-height";
    const previous = root.style.getPropertyValue(property);
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    // Move the same search form so typed text and focus survive docking.
    const positionSearch = () => {
      const offset = Math.max(0, anchor.getBoundingClientRect().top - 96);
      search.style.setProperty("--home-search-offset", `${offset}px`);
      search.dataset.docked = String(offset === 0);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        positionSearch();
      });
    };
    const measure = () => {
      const top = Math.ceil(search.getBoundingClientRect().height);
      root.style.setProperty(property, `${top}px`);
      positionSearch();
      observer?.disconnect();
      const visibility = new Map<string, number>();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            visibility.set(
              entry.target.id,
              entry.isIntersecting ? entry.intersectionRatio : 0,
            );
          const visible = [...visibility].sort((a, b) => b[1] - a[1])[0];
          if (visible?.[1] > 0) setActive(visible[0]);
        },
        {
          rootMargin: `-${96 + top}px 0px 0px 0px`,
          threshold: [0, 0.15, 0.35, 0.6, 0.85, 1],
        },
      );
      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (element) observer.observe(element);
      }
    };
    const resize = new ResizeObserver(measure);
    resize.observe(search);
    if (anchor.parentElement) resize.observe(anchor.parentElement);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      resize.disconnect();
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
      if (previous) root.style.setProperty(property, previous);
      else root.style.removeProperty(property);
    };
  }, []);
  return (
    <nav className={styles.sectionNav} aria-label="홈 섹션 이동">
      <span className={styles.progressTrack} aria-hidden="true">
        <span
          className={styles.progressFill}
          style={{
            height: `${((SECTIONS.findIndex((section) => section.id === active) + 1) / SECTIONS.length) * 100}%`,
          }}
        />
      </span>
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={active === section.id ? "step" : undefined}
          aria-label={`${section.label} 섹션으로 이동`}
        />
      ))}
    </nav>
  );
}
