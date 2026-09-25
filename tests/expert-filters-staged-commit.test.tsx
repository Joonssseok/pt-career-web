/**
 * @jest-environment jsdom
 *
 * ExpertFilters의 다중선택 체크박스가 "클릭 즉시 스테이징만, 돋보기/Enter로만
 * 커밋"되는 동작(PR #63의 검색어 명시적 제출을 직군/지역/분야로 확장)을
 * 검증한다. 이 세션 환경에서는 Browser 패널이 계속 백그라운드
 * (document.visibilityState: hidden) 상태라 React 상태 갱신이 커밋되지
 * 않아 실제 클릭으로 결정적 확인이 불가능했다 -- jsdom에는 이 제약이
 * 없으므로 컴포넌트 테스트로 동일한 보장을 확인한다.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpertFilters } from '@/app/experts/ExpertFilters';

const pushMock = jest.fn();
let currentSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: (url: string) => pushMock(url) }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const professions = [
  { id: '1', name: '물리치료사', slug: 'physical-therapist' },
  { id: '2', name: '퍼스널 트레이너', slug: 'personal-trainer' },
];
const specialties = [{ id: '1', name: '다이어트·체형관리', slug: 'weight-management' }];

describe('ExpertFilters: staged multiselect + explicit commit', () => {
  beforeEach(() => {
    pushMock.mockClear();
    currentSearch = '';
  });

  it('checking a checkbox updates the visible count but does not push a URL change', () => {
    render(<ExpertFilters professions={professions} specialties={specialties} />);

    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));
    fireEvent.click(screen.getByRole('button', { name: '직군' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /물리치료사/ }));

    expect(pushMock).not.toHaveBeenCalled();
    // getByRole throws if the "직군 (1)" count label isn't rendered, so a
    // successful call already proves the staged count is shown.
    screen.getByRole('button', { name: '직군 (1)' });
  });

  it('clicking the magnifier commits the staged checkbox selection', () => {
    render(<ExpertFilters professions={professions} specialties={specialties} />);

    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));
    fireEvent.click(screen.getByRole('button', { name: '직군' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /물리치료사/ }));
    expect(pushMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/experts?profession=physical-therapist');
  });

  it('Enter in the search box also commits staged query + checkbox selections together', () => {
    render(<ExpertFilters professions={professions} specialties={specialties} />);

    fireEvent.change(screen.getByRole('searchbox', { name: '전문가 검색' }), {
      target: { value: '준석' },
    });
    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));
    fireEvent.click(screen.getByRole('button', { name: '직군' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /물리치료사/ }));
    fireEvent.click(screen.getByRole('button', { name: '분야' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /다이어트/ }));
    expect(pushMock).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('searchbox', { name: '전문가 검색' }), { key: 'Enter' });

    expect(pushMock).toHaveBeenCalledTimes(1);
    const url = pushMock.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('query')).toBe('준석');
    expect(params.get('profession')).toBe('physical-therapist');
    expect(params.get('specialty')).toBe('weight-management');
  });

  it('unchecking a committed selection back to zero clears the filter (0 = all)', () => {
    // 이미 커밋된 필터가 있는 상태에서 시작 -- 체크 해제로 0개가 되면
    // 파라미터 자체가 지워져야 한다("0개 선택 = 전체").
    currentSearch = 'profession=physical-therapist';
    render(<ExpertFilters professions={professions} specialties={specialties} />);

    fireEvent.click(screen.getByRole('button', { name: /^직군/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /물리치료사/ }));
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    expect(pushMock).toHaveBeenCalledWith('/experts?');
  });

  it('syncs staged selections to match the committed URL on external change (back/forward)', () => {
    currentSearch = 'profession=physical-therapist';
    const { rerender } = render(<ExpertFilters professions={professions} specialties={specialties} />);

    fireEvent.click(screen.getByRole('button', { name: /^직군/ }));
    expect((screen.getByRole('checkbox', { name: /물리치료사/ }) as HTMLInputElement).checked).toBe(
      true
    );

    // 뒤로가기로 필터가 없는 URL로 돌아간 상황을 흉내낸다.
    currentSearch = '';
    rerender(<ExpertFilters professions={professions} specialties={specialties} />);

    expect((screen.getByRole('checkbox', { name: /물리치료사/ }) as HTMLInputElement).checked).toBe(
      false
    );
  });

  it('profession/specialty option labels render in full (no truncate class)', () => {
    render(<ExpertFilters professions={professions} specialties={specialties} />);

    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));
    fireEvent.click(screen.getByRole('button', { name: '직군' }));
    const label = screen.getByText('물리치료사');
    expect(label.className).not.toContain('truncate');
  });
});
