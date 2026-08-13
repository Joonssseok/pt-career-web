// public_expert_detail 뷰(20260807020000_threads_kakao_social_links.sql)의
// total_experience_years 계산과 동일한 원칙을 순수 JS로 재구현한다:
//   range_agg(daterange(start_date, COALESCE(end_date, CURRENT_DATE) + 1))
// 로 겹치는 구간을 하나로 병합한 뒤 합산 일수 / 365.25를 반올림.
//
// 뷰와의 차이(의도된 차이): 뷰는 owner_visible = true인 경력만 계산한다
// (공개 프로필 기준, 마스킹 적용). 이력서 내보내기는 본인이 내려받는
// 사적인 문서이므로 owner_visible과 무관하게 등록된 모든 경력을
// 포함해야 한다 -- 그래서 이 함수는 마스킹 필터 없이 넘겨받은 배열을
// 그대로 계산한다(호출부에서 이미 전체 목록을 넘기면 됨).

export type ExperienceRangeInput = {
  // 'YYYY-MM' (또는 빈 문자열). getOwnExperiences()가 이 형식으로 내려준다.
  startDate: string;
  endDate: string;
  isCurrently: boolean;
};

function monthStringToUTCDays(value: string): number {
  const [y, m] = value.split('-').map(Number);
  return Date.UTC(y, m - 1, 1) / 86_400_000;
}

function todayUTCDays(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000;
}

export function calculateTotalExperienceYears(experiences: ExperienceRangeInput[]): number {
  const today = todayUTCDays();

  const intervals: Array<[number, number]> = [];
  for (const exp of experiences) {
    if (!exp.startDate) continue;
    if (!exp.endDate && !exp.isCurrently) continue;

    const start = monthStringToUTCDays(exp.startDate);
    const effectiveEnd = exp.isCurrently ? today : monthStringToUTCDays(exp.endDate);
    if (start > effectiveEnd) continue; // start_date <= COALESCE(end_date, CURRENT_DATE)

    // daterange 상한은 배타적이라 +1일(뷰의 `+ 1`과 동일).
    intervals.push([start, effectiveEnd + 1]);
  }

  if (intervals.length === 0) return 0;

  intervals.sort((a, b) => a[0] - b[0]);

  let totalDays = 0;
  let curStart = intervals[0][0];
  let curEnd = intervals[0][1];

  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      totalDays += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  totalDays += curEnd - curStart;

  return Math.round(totalDays / 365.25);
}
