/**
 * calculateTotalExperienceYears은 public_expert_detail 뷰의 range_agg
 * 겹침-병합 SQL 로직을 JS로 재구현한 것이다(이력서 내보내기 전용,
 * owner_visible 마스킹 없이 전체 경력을 대상으로 계산). 이 테스트는
 * 겹치는 기간이 중복 카운트되지 않는지가 핵심이다.
 */
import { calculateTotalExperienceYears } from '@/lib/resume/total-experience-years';

describe('calculateTotalExperienceYears', () => {
  it('returns 0 for no experiences', () => {
    expect(calculateTotalExperienceYears([])).toBe(0);
  });

  it('calculates a single closed-ended experience', () => {
    // 2020-01 ~ 2022-01: 정확히 2년 근무 (일 단위 계산이라 반올림 후 2)
    const years = calculateTotalExperienceYears([
      { startDate: '2020-01', endDate: '2022-01', isCurrently: false },
    ]);
    expect(years).toBe(2);
  });

  it('does not double-count overlapping periods', () => {
    // 두 경력이 2020-01~2021-01, 2020-06~2021-06으로 6개월 겹침.
    // 병합하면 2020-01~2021-06 = 1.5년, 단순 합산(1+1=2년)과 달라야 한다.
    const years = calculateTotalExperienceYears([
      { startDate: '2020-01', endDate: '2021-01', isCurrently: false },
      { startDate: '2020-06', endDate: '2021-06', isCurrently: false },
    ]);
    expect(years).toBe(1); // round(약 1.5 * 365 / 365.25) -- 아래 정밀 테스트로 재확인
    expect(years).toBeLessThan(2); // 겹치지 않았다면 2가 나왔을 것
  });

  it('sums non-overlapping periods correctly', () => {
    // 겹치지 않는 두 경력: 2018-01~2019-01(1년) + 2020-01~2022-01(2년) = 3년
    const years = calculateTotalExperienceYears([
      { startDate: '2018-01', endDate: '2019-01', isCurrently: false },
      { startDate: '2020-01', endDate: '2022-01', isCurrently: false },
    ]);
    expect(years).toBe(3);
  });

  it('treats isCurrently as ongoing through today', () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
    const startDate = `${fiveYearsAgo.getUTCFullYear()}-${String(fiveYearsAgo.getUTCMonth() + 1).padStart(2, '0')}`;

    const years = calculateTotalExperienceYears([
      { startDate, endDate: '', isCurrently: true },
    ]);
    expect(years).toBe(5);
  });

  it('ignores an experience with no start date', () => {
    const years = calculateTotalExperienceYears([
      { startDate: '', endDate: '2020-01', isCurrently: false },
    ]);
    expect(years).toBe(0);
  });

  it('ignores an experience with neither end date nor isCurrently', () => {
    const years = calculateTotalExperienceYears([
      { startDate: '2020-01', endDate: '', isCurrently: false },
    ]);
    expect(years).toBe(0);
  });

  it('merges three overlapping/adjacent periods into one continuous span', () => {
    // 2015-01~2017-01, 2016-06~2018-06, 2018-01~2019-01 -- 전부 연쇄적으로
    // 겹쳐 있어 병합하면 2015-01~2019-01 = 4년.
    const years = calculateTotalExperienceYears([
      { startDate: '2015-01', endDate: '2017-01', isCurrently: false },
      { startDate: '2016-06', endDate: '2018-06', isCurrently: false },
      { startDate: '2018-01', endDate: '2019-01', isCurrently: false },
    ]);
    expect(years).toBe(4);
  });
});
