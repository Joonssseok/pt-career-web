"use client";

import { useId, useState } from "react";
import { HOSPITAL_WORK_TOOLTIP } from "@/lib/specialties/catalog";
import styles from "./SpecialtyLabel.module.css";

export function SpecialtyLabel({ slug, name }: { slug: string; name: string }) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  if (slug !== "hospital-work") return <span>{name}</span>;
  return (
    <span
      className={styles.badge}
      tabIndex={0}
      aria-describedby={id}
      onFocus={() => setDismissed(false)}
      onMouseEnter={() => setDismissed(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setDismissed(true);
      }}
    >
      {name}
      <span
        id={id}
        role="tooltip"
        className={styles.tooltip}
        hidden={dismissed}
      >
        {HOSPITAL_WORK_TOOLTIP}
      </span>
    </span>
  );
}
