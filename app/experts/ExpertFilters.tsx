'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { REGIONS } from '@/lib/constants/regions';

type Specialty = { id: string; name: string; slug: string };
type Profession = { id: string; name: string; slug: string };

export function ExpertFilters({
  specialties,
  professions,
}: {
  specialties: Specialty[];
  professions: Profession[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 로컬 state를 필터의 단일 소스로 둔다. router.push()는 URL(과
  // useSearchParams())을 동기적으로 갱신하지 않는다 -- 실측 결과 반영까지
  // 수십 ms가 걸린다. 그 사이에 두 번째 필터를 바꾸면 searchParams든
  // window.location.search든 둘 다 아직 첫 번째 변경을 반영하지 못한
  // 상태라, 이를 기준으로 다음 URL을 만들면 첫 번째 필터가 사라진다.
  // setState의 함수형 업데이트는 React가 배치해도 항상 직전 state를
  // 정확히 이어받으므로 이 문제가 없다.
  const [paramsString, setParamsString] = useState(() => searchParams.toString());

  // 뒤로/앞으로 가기 등 외부 요인으로 URL이 바뀐 경우 로컬 상태를 맞춘다.
  useEffect(() => {
    setParamsString(searchParams.toString());
  }, [searchParams]);

  // 로컬 상태가 커밋된 URL과 달라지면(= 사용자가 필터를 바꿨으면) 반영한다.
  useEffect(() => {
    if (paramsString !== searchParams.toString()) {
      router.push(`/experts?${paramsString}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsString]);

  const params = new URLSearchParams(paramsString);
  const profession = params.get('profession') ?? '';
  const region = params.get('region') ?? '';
  const specialty = params.get('specialty') ?? '';
  const committedQuery = params.get('query') ?? '';

  const updateFilter = (key: string, value: string) => {
    setParamsString((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      return next.toString();
    });
  };

  // 검색어 입력은 키 입력마다 라우팅하면 요청이 과도해지므로 디바운스 후
  // 반영한다. queryInput은 입력창의 즉시 값, lastPushedQueryRef는 우리가
  // 마지막으로 URL에 반영한 값 -- 커밋된 query가 이 값과 다르면 뒤로 가기 등
  // 외부 변경이므로 입력창을 동기화하고, 같으면 (디바운스 대기 중인 타이핑을
  // 덮어쓰지 않도록) 건드리지 않는다.
  const [queryInput, setQueryInput] = useState(committedQuery);
  const lastPushedQueryRef = useRef(committedQuery);

  useEffect(() => {
    const committed = new URLSearchParams(searchParams.toString()).get('query') ?? '';
    if (committed !== lastPushedQueryRef.current) {
      lastPushedQueryRef.current = committed;
      setQueryInput(committed);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = queryInput.trim();
      if (trimmed !== lastPushedQueryRef.current) {
        lastPushedQueryRef.current = trimmed;
        updateFilter('query', trimmed);
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  // 상세검색(직군/지역/분야) 펼침 상태 -- 이미 선택된 필터가 있으면 접혀서
  // 안 보이는 게 더 혼란스러우므로 기본 펼침으로 시작한다.
  const [showAdvanced, setShowAdvanced] = useState(
    () => Boolean(profession || region || specialty)
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="이름, 소개로 검색"
          aria-label="전문가 검색"
          className="flex-1 min-w-0 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          aria-expanded={showAdvanced}
          className={`min-h-[44px] px-3 border rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            showAdvanced
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          상세검색
        </button>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-3 gap-2">
          <select
            value={profession}
            onChange={(e) => updateFilter('profession', e.target.value)}
            className="min-h-[44px] px-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
            aria-label="직군 필터"
          >
            <option value="">전체 직군</option>
            {/* custom(직접 입력) 슬롯은 고정 카테고리가 아니므로 필터에서 제외 */}
            {professions
              .filter((p) => p.slug !== 'custom')
              .map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
          </select>

          <select
            value={region}
            onChange={(e) => updateFilter('region', e.target.value)}
            className="min-h-[44px] px-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
            aria-label="지역 필터"
          >
            <option value="">전체 지역</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={specialty}
            onChange={(e) => updateFilter('specialty', e.target.value)}
            className="min-h-[44px] px-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
            aria-label="전문분야 필터"
          >
            <option value="">전체 분야</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
