export type SpecialtyOption = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  medical_technician_only?: boolean;
};

export const HOSPITAL_WORK_NOTICE =
  '"병원 근무"는 지금 의료기관에서 일하는 의료기사를 소개합니다. 진료와 치료는 소속 의료기관에서 이뤄지며, PT Career는 진료를 예약하거나 알선하지 않습니다.';
export const HOSPITAL_WORK_SELECTION_NOTE =
  '현재 병원에서 근무 중인 경우에만 선택해주세요.';
export const HOSPITAL_WORK_TOOLTIP = '현재 병원에서 일하고 있어요.';

export const SPECIALTY_CATALOG = [
  {
    slug: "weight-management",
    name: "체중·체형관리",
    hint: "건강한 일상의 시작",
    path: "M7 4h10l2 16H5L7 4Zm2 4a3 3 0 0 1 6 0m-3-1v3",
    medical_technician_only: false,
  },
  {
    slug: "strength-body-profile",
    name: "근력·체력 향상",
    hint: "꾸준히, 더 단단하게",
    path: "M7 8v8m10-8v8M4 10v4m16-4v4M7 12h10",
    medical_technician_only: false,
  },
  {
    slug: "posture-pain-management",
    name: "자세·움직임 개선",
    hint: "편안한 움직임을 위해",
    path: "M12 3v3m0 3v3m0 3v6M7 7l5 2 5-2M6 18l6-3 6 3",
    medical_technician_only: false,
  },
  {
    slug: "rehab-post-surgery",
    name: "부상 후 리커버리",
    hint: "차근차근, 다시 일상으로",
    path: "M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z",
    medical_technician_only: false,
  },
  {
    slug: "sports-performance",
    name: "스포츠·컨디셔닝",
    hint: "나의 종목에 맞는 훈련",
    path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c-5 5-5 13 0 18m0-18c5 5 5 13 0 18M3 12h18",
    medical_technician_only: false,
  },
  {
    slug: "pilates-yoga-flexibility",
    name: "필라테스·요가",
    hint: "몸의 균형을 찾는 시간",
    path: "M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 3v5m-6-5 6 2 6-2M4 20l8-4 8 4H4Z",
    medical_technician_only: false,
  },
  {
    slug: "prenatal-postnatal",
    name: "산전·산후",
    hint: "변화하는 몸을 위한 움직임",
    path: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3 4 3-2 3 3a4 4 0 0 1 0 7h-3m-2-6-2 5-1 4m5-3 3 3",
    medical_technician_only: false,
  },
  {
    slug: "youth-exercise",
    name: "소아·청소년",
    hint: "건강하게 자라는 시간",
    path: "M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 3v6m-5-5 5 2 5-2m-5 5-4 5m4-5 4 5",
    medical_technician_only: false,
  },
  {
    slug: "senior-fall-prevention",
    name: "시니어",
    hint: "안정적인 일상의 걸음",
    path: "M10 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 3-2 5 4 2 1 5m-5-7-3 7m5-12 4 4h4m0 0v8",
    medical_technician_only: false,
  },
  {
    slug: "chronic-special-populations",
    name: "만성질환 운동",
    hint: "나의 상태에 맞춘 운동",
    path: "M20 5c-3-3-6-1-8 1C10 4 7 2 4 5c-4 4 1 9 8 15 7-6 12-11 8-15ZM5 12h4l2-4 2 7 2-3h4",
    medical_technician_only: false,
  },
  {
    slug: "hospital-work",
    name: "병원 근무",
    hint: "병원·의원에서 일하는 의료기사",
    path: "M4 21V5h16v16M2 21h20M9 21v-5h6v5M12 7v6M9 10h6",
    medical_technician_only: true,
  },
] as const;

// Fixtures are for the isolated design preview, never a replacement for DB rows.
export const SPECIALTY_PREVIEW_OPTIONS: SpecialtyOption[] =
  SPECIALTY_CATALOG.map((row, index) => ({
    id: `preview-${row.slug}`,
    slug: row.slug,
    name: row.name,
    sort_order: index + 1,
    medical_technician_only: row.medical_technician_only,
  }));

export function canonicalSpecialtySlug(slug: string): string {
  const value = slug.trim();
  return value === "conditioning" || value === "sport-specific-training"
    ? "sports-performance"
    : value;
}

export function canonicalSpecialtySlugs(
  value: string | null | undefined,
): string[] {
  return [
    ...new Set(
      (value ?? "").split(",").map(canonicalSpecialtySlug).filter(Boolean),
    ),
  ];
}

export function hasHospitalWork(rows: readonly { slug: string }[]): boolean {
  return rows.some((row) => row.slug === "hospital-work");
}
