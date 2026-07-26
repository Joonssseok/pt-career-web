export const OFFICIAL_PROFESSIONS = [
  '물리치료사',
  '퍼스널 트레이너',
  '건강운동관리사',
  '선수트레이너',
  '필라테스 강사',
  '재활운동 전문가',
] as const;

export type OfficialProfession = (typeof OFFICIAL_PROFESSIONS)[number];
