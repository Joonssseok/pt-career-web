"use client";

import styles from "./ContentViewToggle.module.css";

export function ContentViewToggle({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className={styles.toggle} role="group" aria-label={label}>
      {[
        ["blog", "요약보기", "M3 4h6v6H3zM13 5h8M13 9h8M3 14h18M3 19h14"],
        ["list", "한줄보기", "M3 5h2M9 5h12M3 12h2M9 12h12M3 19h2M9 19h12"],
        [
          "album",
          "앨범보기",
          "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
        ],
      ].map(([id, name, path]) => (
        <button
          key={id}
          type="button"
          aria-label={name}
          title={name}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={path} />
          </svg>
        </button>
      ))}
    </div>
  );
}
