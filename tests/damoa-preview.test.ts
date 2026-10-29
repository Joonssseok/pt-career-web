import { Activity, CATEGORIES, STORAGE_LIMIT, fileBytes, validateActivity } from '../lib/damoa/categories';
const activity = (overrides: Partial<Activity> = {}): Activity => ({ owner: 'test', id: 'one', category: 'volunteer', title: '활동', period: '', description: '', learning: '', link: '', memo: '', details: {}, files: [], updated: '', ...overrides });
test('기본 카테고리는 중복 없이 18개 제공', () => { expect(CATEGORIES).toHaveLength(18); expect(new Set(CATEGORIES.map(c => c.id)).size).toBe(18); });
test('빈 기록은 저장하지 않지만 자료만 보관 가능', () => {
 expect(() => validateActivity(activity({ title: '' }))).toThrow();
 expect(() => validateActivity(activity({ title: '', files: [{ id: 'file', name: '확인서.pdf', size: 20, type: 'application/pdf', blob: new Blob(['example']) }] }))).not.toThrow();
});
test('지원하지 않는 분류와 실행 가능한 URL을 거부', () => {
 expect(() => validateActivity(activity({ category: 'unknown' }))).toThrow();
 expect(() => validateActivity(activity({ link: 'javascript:alert(1)' }))).toThrow();
 expect(() => validateActivity(activity({ link: 'https://example.org/activity' }))).not.toThrow();
});
test('파일 합계를 계산하며 설계 용량은 100MiB', () => {
 expect(STORAGE_LIMIT).toBe(104857600);
 expect(fileBytes([activity({ files: [{ id: 'a', name: 'a', size: 12, type: '', blob: new Blob() }, { id: 'b', name: 'b', size: 34, type: '', blob: new Blob() }] })])).toBe(46);
});
