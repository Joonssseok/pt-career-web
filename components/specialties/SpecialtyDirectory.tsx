import Link from "next/link";
import {
  SPECIALTY_CATALOG,
  canonicalSpecialtySlug,
  hasHospitalWork,
  type SpecialtyOption,
} from "@/lib/specialties/catalog";
import { HospitalWorkNotice } from "./HospitalWorkNotice";
import styles from "@/app/home/home.module.css";

export function SpecialtyDirectory({
  options,
}: {
  options: readonly SpecialtyOption[];
}) {
  return (
    <>
      <div className={styles.specialties}>
        {[...options]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((row) => {
            const slug = canonicalSpecialtySlug(row.slug);
            const metadata = SPECIALTY_CATALOG.find(
              (item) => item.slug === slug,
            );
            return (
              <Link
                key={row.id}
                href={`/experts?specialty=${encodeURIComponent(slug)}`}
                className={styles.specialty}
              >
                <span className={styles.specialtyIcon}>
                  <svg
                    aria-hidden="true"
                    width="27"
                    height="27"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d={
                        metadata?.path ??
                        "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8 12h8m-4-4v8"
                      }
                    />
                  </svg>
                </span>
                <span>
                  <strong>{row.name}</strong>
                  {metadata && (
                    <span className={styles.hint}>{metadata.hint}</span>
                  )}
                </span>
                <span className={styles.specialtyArrow}>
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18 18 6M6 6h12v12" />
                  </svg>
                </span>
              </Link>
            );
          })}
      </div>
      {hasHospitalWork(options) && (
        <HospitalWorkNotice className={styles.disclosure} />
      )}
    </>
  );
}
