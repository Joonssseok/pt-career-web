import { sortByRecency } from '@/lib/resume/sort-by-recency';

describe('sortByRecency', () => {
  it('places the currently-ongoing item first even if others end later on paper', () => {
    const result = sortByRecency([
      { label: 'old-closed', startDate: '2010-01', endDate: '2012-01', isCurrently: false },
      { label: 'current', startDate: '2023-01', endDate: '', isCurrently: true },
      { label: 'recent-closed', startDate: '2020-01', endDate: '2022-01', isCurrently: false },
    ]);
    expect(result.map((r) => r.label)).toEqual(['current', 'recent-closed', 'old-closed']);
  });

  it('sorts closed items by end date descending', () => {
    const result = sortByRecency([
      { label: 'a', startDate: '2015-01', endDate: '2016-01', isCurrently: false },
      { label: 'b', startDate: '2019-01', endDate: '2020-01', isCurrently: false },
      { label: 'c', startDate: '2017-01', endDate: '2018-01', isCurrently: false },
    ]);
    expect(result.map((r) => r.label)).toEqual(['b', 'c', 'a']);
  });

  it('falls back to startDate when endDate is missing and not marked current (e.g. academic records)', () => {
    const result = sortByRecency([
      { label: 'no-end-old', startDate: '2015-01', endDate: '' },
      { label: 'no-end-new', startDate: '2021-01', endDate: '' },
    ]);
    expect(result.map((r) => r.label)).toEqual(['no-end-new', 'no-end-old']);
  });

  it('does not mutate the original array', () => {
    const input = [
      { label: 'a', startDate: '2015-01', endDate: '2016-01', isCurrently: false },
      { label: 'b', startDate: '2019-01', endDate: '2020-01', isCurrently: false },
    ];
    const copy = [...input];
    sortByRecency(input);
    expect(input).toEqual(copy);
  });
});
