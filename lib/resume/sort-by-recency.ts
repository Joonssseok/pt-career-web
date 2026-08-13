// 경력·학력의 "최신순" 정렬 -- public_expert_detail 뷰(PR #68/#69)와 동일한
// 원칙: 현재 재직/재학 중인 항목이 최상단, 그다음 종료일(없으면 시작일)
// 내림차순. 뷰는 SQL의 e.is_current DESC, COALESCE(end_date, start_date) DESC
// 를 쓰지만 이력서 데이터는 이미 JS 배열로 들고 있으므로 동일 원칙을 여기서
// 순수 함수로 재구현한다.
export function sortByRecency<T extends { startDate: string; endDate: string; isCurrently?: boolean }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aCurrent = a.isCurrently ? 1 : 0;
    const bCurrent = b.isCurrently ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    const aKey = a.endDate || a.startDate || '';
    const bKey = b.endDate || b.startDate || '';
    return aKey > bKey ? -1 : aKey < bKey ? 1 : 0;
  });
}
