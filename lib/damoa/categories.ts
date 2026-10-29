export const CATEGORIES = [
  [
    "academic",
    "학력",
    "배우고 준비한 경험",
    "학교명|학과·전공|학위 과정|재학·휴학·수료·졸업 상태|부·복수전공",
  ],
  [
    "education",
    "교육·연수",
    "배우고 준비한 경험",
    "교육 기관|교육 유형|국가·지역|교육시간|참여·수료 상태",
  ],
  [
    "license",
    "자격·면허",
    "배우고 준비한 경험",
    "발급 기관|자격 유형|취득일|유효기간|취득·갱신 상태",
  ],
  [
    "study",
    "스터디·학습활동",
    "배우고 준비한 경험",
    "학습 주제|모임명|개인·그룹 여부|참여 방식|학습 결과물",
  ],
  [
    "career",
    "경력",
    "일하고 실천한 경험",
    "기관·회사명|부서|직무·직책|근무 형태|담당 업무",
  ],
  [
    "intern",
    "실습·인턴십",
    "일하고 실천한 경험",
    "실습 기관|실습 유형|부서·분야|총시간|참여 업무·관찰 내용",
  ],
  [
    "project",
    "프로젝트",
    "일하고 실천한 경험",
    "수업·기관명|개인·팀 여부|본인 역할|수행 내용|결과물",
  ],
  [
    "volunteer",
    "봉사활동",
    "참여하고 기여한 경험",
    "주관 기관|활동 대상|장소|본인 역할|확인된 활동시간",
  ],
  [
    "external",
    "대외활동",
    "참여하고 기여한 경험",
    "주최 기관|기수|본인 역할|주요 활동",
  ],
  [
    "club",
    "동아리·학생활동",
    "참여하고 기여한 경험",
    "단체명|활동 성격|소속|역할·직책|참여·운영 내용",
  ],
  [
    "association",
    "협회·전문단체 활동",
    "참여하고 기여한 경험",
    "단체명|회원·위원·운영진 구분|직책|수행 활동",
  ],
  [
    "lecture",
    "강의·발표·출강",
    "전하고 만들어낸 경험",
    "주최 기관|대상|강의·발표 형태|진행 시간|회차",
  ],
  [
    "mentor",
    "멘토링·지도",
    "전하고 만들어낸 경험",
    "프로그램명|기관|멘토·멘티·지도자 역할|대상|회차·시간|지도 내용",
  ],
  [
    "research",
    "연구·논문·저술",
    "전하고 만들어낸 경험",
    "활동 유형|연구·발행 기관|본인 역할|진행·발표·게재 상태|원문 링크",
  ],
  [
    "content",
    "콘텐츠 제작·운영",
    "전하고 만들어낸 경험",
    "콘텐츠·채널명|매체|주제|본인 역할|대표 결과물 링크",
  ],
  [
    "award",
    "수상 경력",
    "도전한 경험",
    "대회·행사명|주최 기관|상명·등위|부문|개인·팀 여부|본인 역할",
  ],
  [
    "contest",
    "대회·공모전 참가",
    "도전한 경험",
    "주최 기관|분야·부문|개인·팀 여부|본인 역할|출품작·기록",
  ],
  [
    "other",
    "기타 활동",
    "새로운 경험",
    "희망 카테고리명|기존 분류로 표현하기 어려운 이유",
  ],
].map(([id, name, group, fields]) => ({
  id,
  name,
  group,
  fields: fields.split("|"),
}));
export const STORAGE_LIMIT = 100 * 1024 * 1024;
export type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  blob?: Blob;
  path?: string;
};
export type Activity = {
  owner: string;
  id: string;
  category: string;
  title: string;
  period: string;
  description: string;
  learning: string;
  link: string;
  memo: string;
  details: Record<string, string>;
  files: Attachment[];
  updated: string;
  revision?: string;
};
export function fileBytes(rows: Activity[]) {
  return rows.reduce((n, r) => n + r.files.reduce((s, f) => s + f.size, 0), 0);
}
export function validateActivity(a: Activity) {
  if (!a.title.trim() && !a.files.length)
    throw new Error("활동 이름을 적거나 자료를 첨부해주세요.");
  if (!CATEGORIES.some((c) => c.id === a.category))
    throw new Error("카테고리를 선택해주세요.");
  if (a.link && !/^https?:\/\//i.test(a.link))
    throw new Error("관련 링크는 https:// 또는 http://로 시작해주세요.");
}
