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
    const footer = main?.nextElementSibling;
    if (!search || !(footer instanceof HTMLElement)) return;
    const root = document.documentElement;
    const properties = ["--home-search-height", "--home-footer-height"];
    const previous = properties.map((name) =>
      root.style.getPropertyValue(name),
    );
    let observer: IntersectionObserver | undefined;
    const measure = () => {
      const top = Math.ceil(search.getBoundingClientRect().height);
      const bottom = Math.ceil(footer.getBoundingClientRect().height);
      root.style.setProperty(properties[0], `${top}px`);
      root.style.setProperty(properties[1], `${bottom}px`);
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
          rootMargin: `-${96 + top}px 0px -${bottom}px 0px`,
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
    resize.observe(footer);
    measure();
    return () => {
      resize.disconnect();
      observer?.disconnect();
      properties.forEach((name, index) =>
        previous[index]
          ? root.style.setProperty(name, previous[index])
          : root.style.removeProperty(name),
      );
    };
  }, []);
  return (
    <nav className={styles.sectionNav} aria-label="홈 섹션 이동">
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={active === section.id ? "step" : undefined}
          aria-label={`${section.label} 섹션으로 이동`}
        >
          <span className={styles.navLabel}>{section.label}</span>
          <span className={styles.navDot} aria-hidden />
        </a>
      ))}
    </nav>
  );
}
