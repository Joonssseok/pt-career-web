/**
 * @jest-environment jsdom
 *
 * Regression test for a bug found during manual verification (2026-08-13):
 * ExtraLinksSection's "+ 링크 추가" handler guarded the 10-link max by
 * reading the `links` state variable directly (`if (links.length >= MAX)
 * return`). When several clicks land in the same React batch (e.g. a user
 * holding Enter/Space on the focused button, or any rapid-fire input before
 * a re-render commits), every queued handler call sees the same stale
 * `links.length` from before the batch started, so the guard never fires
 * and more than 10 rows get added. Fixed by moving the check inside the
 * functional setState updater (`setLinks((prev) => prev.length >= MAX ? prev
 * : [...])`), which always sees the up-to-date length. This test fires 15
 * clicks inside a single `act()` (forcing them into one batch) and asserts
 * the row count still stops at exactly 10.
 */
import { render, act, fireEvent } from '@testing-library/react';
import ExtraLinksSection from '@/components/profile-sections/ExtraLinksSection';

jest.mock('@/app/actions/extra-links', () => ({
  getOwnExtraLinks: jest.fn().mockResolvedValue({ ok: true, error: '', links: [] }),
  saveExtraLinks: jest.fn().mockResolvedValue({ ok: true }),
}));

describe('ExtraLinksSection max-10 guard', () => {
  it('stops at exactly 10 rows even when many "+ 링크 추가" clicks land in one batch', async () => {
    const { getByText, getAllByPlaceholderText } = render(<ExtraLinksSection />);

    // 마운트 시 getOwnExtraLinks()의 .then(setLinks)가 아직 해결되지
    // 않은 상태에서 클릭을 시작하면, 그 응답(mock: 빈 배열)이 나중에
    // 도착해 클릭으로 추가한 행을 전부 덮어써버린다 -- 먼저 한 틱
    // 흘려보내 초기 로드를 확정시킨다.
    await act(async () => {
      await Promise.resolve();
    });

    const addButton = getByText(/링크 추가/);

    await act(async () => {
      for (let i = 0; i < 15; i++) {
        fireEvent.click(addButton);
      }
    });

    expect(getAllByPlaceholderText('예: 포트폴리오')).toHaveLength(10);
    expect(getByText('최대 10개까지 추가할 수 있어요')).toBeTruthy();
  });
});
