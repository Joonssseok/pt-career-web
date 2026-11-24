"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./AdaptiveHomeCareer.module.css";

export function AdaptiveHomeCareer({
  summary,
  full,
}: {
  summary: ReactNode;
  full: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const summarySize = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const section = root.current;
    const summaryElement = summarySize.current;
    const template = section?.closest("[data-profile-template]");
    const identity = template?.querySelector<HTMLElement>(
      "[data-profile-identity]",
    );
    const read = template?.querySelector<HTMLElement>("[data-profile-read]");
    const home = section?.closest<HTMLElement>('[data-profile-panel="home"]');
    if (!section || !summaryElement || !identity || !read || !home) return;

    function measure() {
      if (home!.hidden) return;
      const card = identity!.getBoundingClientRect();
      const content = read!.getBoundingClientRect();
      const panel = home!.getBoundingClientRect();
      const current = section!.getBoundingClientRect();
      const compact = summaryElement!.getBoundingClientRect();
      const sideBySide =
        content.width > 0 && card.width > 0 && content.left >= card.right - 1;
      // Compare the same summary height in both states so expanding cannot flip the decision back.
      const summaryBottom =
        panel.bottom - content.top - current.height + compact.height;
      const next =
        sideBySide && compact.height > 0 && summaryBottom + 1 < card.height;
      setExpanded((previous) => (previous === next ? previous : next));
    }

    let frame = 0;
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    [identity, read, home, summaryElement].forEach((element) =>
      observer?.observe(element),
    );
    const navigation = read.querySelector("[data-profile-navigation]");
    if (navigation) observer?.observe(navigation);
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div
      ref={root}
      className={styles.layout}
      data-adaptive-career={expanded ? "full" : "summary"}
    >
      <div
        ref={summarySize}
        data-career-summary
        className={expanded ? styles.probe : undefined}
        aria-hidden={expanded || undefined}
        inert={expanded || undefined}
      >
        <h2>주요 이력</h2>
        {summary}
      </div>
      {expanded && (
        <div data-profile-search-exclude>
          <h2>이력</h2>
          {full}
        </div>
      )}
    </div>
  );
}
