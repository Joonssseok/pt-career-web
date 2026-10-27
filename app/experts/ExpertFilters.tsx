'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { REGIONS } from '@/lib/constants/regions';

type Specialty = { id: string; name: string; slug: string };
type Profession = { id: string; name: string; slug: string };

// 콤마 구분 단일 파라미터로 다중값을 encode한다 -- 반복 키(profession=a&profession=b)
// 대신 이 방식을 택해 기존 paramsString/URLSearchParams.set 기반 로컬 상태
// 아키텍처(PR #56의 경쟁 상태 방지 패턴)를 값 파싱만 바꿔 그대로 재사용한다.
function parseMulti(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  return raw ? raw.split(',').filter(Boolean) : [];
}

function MultiSelectField({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`flex w-full min-h-tap items-center justify-between rounded-xl border px-3 text-sm font-medium text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
          selected.length > 0
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : open
              ? 'border-gray-400 bg-gray-50 text-gray-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'
        }`}
      >
        {label}
        {selected.length > 0 ? ` (${selected.length})` : ''}
        <span aria-hidden className={`ml-auto text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {open && (
        <div className="mt-2 grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2 sm:grid-cols-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex min-h-tap cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-600 hover:bg-blue-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="size-4 shrink-0 accent-blue-600"
              />
              <span className="min-w-0 leading-relaxed">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const selectedProfessions = parseMulti(params, 'profession');
  const selectedRegions = parseMulti(params, 'region');
  const selectedSpecialties = parseMulti(params, 'specialty');
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

  // 체크박스 토글: 선택 0개가 되면 파라미터 자체를 지운다(= 전체, NULL로
  // 서버에 전달돼 필터 없음으로 해석된다 -- 빈 배열과는 다른 의미).
  const toggleMulti = (key: string, current: string[], value: string) => {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key, next.join(','));
  };

  // 검색어는 입력 중에는 결과에 반영하지 않고, 돋보기 버튼 클릭 또는 Enter로
  // 명시적으로 제출했을 때만 커밋한다. queryInput은 입력창의 즉시 값,
  // lastPushedQueryRef는 우리가 마지막으로 URL에 반영한 값 -- 커밋된 query가
  // 이 값과 다르면 뒤로/앞으로 가기 등 외부 변경이므로 입력창을 동기화하고,
  // 같으면 (아직 제출하지 않은 타이핑을 덮어쓰지 않도록) 건드리지 않는다.
  const [queryInput, setQueryInput] = useState(committedQuery);
  const lastPushedQueryRef = useRef(committedQuery);

  useEffect(() => {
    const committed = new URLSearchParams(searchParams.toString()).get('query') ?? '';
    if (committed !== lastPushedQueryRef.current) {
      lastPushedQueryRef.current = committed;
      setQueryInput(committed);
    }
  }, [searchParams]);

  const commitQuery = () => {
    const trimmed = queryInput.trim();
    if (trimmed !== lastPushedQueryRef.current) {
      lastPushedQueryRef.current = trimmed;
      updateFilter('query', trimmed);
    }
  };

  // 상세검색(직군/지역/분야) 펼침 상태 -- 이미 선택된 필터가 있으면 접혀서
  // 안 보이는 게 더 혼란스러우므로 기본 펼침으로 시작한다.
  const [showAdvanced, setShowAdvanced] = useState(
    () => selectedProfessions.length > 0 || selectedRegions.length > 0 || selectedSpecialties.length > 0
  );

  return (
    <div className="space-y-4 rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50/60 via-white to-white p-4 sm:p-6">
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          type="search"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitQuery();
          }}
          placeholder="이름·소개로 검색"
          aria-label="전문가 검색"
          className="min-h-14 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={commitQuery}
          aria-label="검색"
          title="검색"
          className="flex min-h-14 min-w-14 items-center justify-center rounded-xl bg-primary px-4 text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <svg aria-hidden width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          aria-expanded={showAdvanced}
          className={`flex min-h-14 items-center gap-2 rounded-xl border px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            showAdvanced
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'
          }`}
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="white" /><circle cx="15" cy="17" r="2" fill="white" /></svg>
          필터
        </button>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 gap-3 border-t border-blue-100/70 pt-4 sm:grid-cols-3">
          <MultiSelectField
            label="직군"
            selected={selectedProfessions}
            onToggle={(v) => toggleMulti('profession', selectedProfessions, v)}
            options={professions
              // custom(직접 입력) 슬롯은 고정 카테고리가 아니므로 필터에서 제외
              .filter((p) => p.slug !== 'custom')
              .map((p) => ({ value: p.slug, label: p.name }))}
          />

          <MultiSelectField
            label="지역"
            selected={selectedRegions}
            onToggle={(v) => toggleMulti('region', selectedRegions, v)}
            options={REGIONS.map((r) => ({ value: r, label: r }))}
          />

          <MultiSelectField
            label="분야"
            selected={selectedSpecialties}
            onToggle={(v) => toggleMulti('specialty', selectedSpecialties, v)}
            options={specialties.map((s) => ({ value: s.slug, label: s.name }))}
          />
        </div>
      )}
    </div>
  );
}
