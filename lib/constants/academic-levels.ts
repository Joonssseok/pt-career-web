import type { AcademicLevel } from '@/app/actions/academic-record';

// AcademicSection.tsx(프로필 편집)와 이력서 내보내기(build-resume-docx.ts)가
// 공유하는 학력 구분 한글 라벨. 새로 만들지 않고 여기서 재사용한다.
export const ACADEMIC_LEVEL_LABELS: Record<AcademicLevel, string> = {
  graduate: '대학원',
  university: '대학교',
  high_school: '고등학교',
  middle_school: '중학교',
};
