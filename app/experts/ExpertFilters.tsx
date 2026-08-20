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

function sameArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function MultiSelectField({
  label,
  options,
  selected,
  onToggle,
  layout = 'grid',
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  layout?: 'grid' | 'list';
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`w-full min-h-[44px] px-3 border rounded-lg text-sm font-medium text-left transition-colors ${
          selected.length > 0
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : open
              ? 'border-gray-400 bg-gray-50 text-gray-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        {label}
        {selected.length > 0 ? ` (${selected.length})` : ''}
      </button>

      {open && (
        <div
          className={`mt-1 p-2 border border-gray-200 rounded-lg bg-white max-h-56 overflow-y-auto ${
            // 직군/분야는 이름이 길어 grid+truncate로는 잘려 보이는 문제가 있어
            // 세로 리스트로 항상 전체 이름이 보이게 한다. 지역(2~3글자)은
            // 잘림 문제가 없어 기존 grid 유지.
            layout === 'list' ? 'flex flex-col gap-0.5' : 'grid grid-cols-2 sm:grid-cols-3 gap-1.5'
          }`}
        >
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-1.5 py-1.5 rounded hover:bg-gray-50 cursor-pointer ${
                layout === 'list' ? 'text-sm text-gray-700' : 'text-xs text-gray-700'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="flex-shrink-0"
              />
              <span className={layout === 'list' ? '' : 'truncate'}>{opt.label}</span>
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

  const committedParams = new URLSearchParams(paramsString);
  const committedProfessions = parseMulti(committedParams, 'profession');
  const committedRegions = parseMulti(committedParams, 'region');
  const committedSpecialties = parseMulti(committedParams, 'specialty');
  const committedQuery = committedParams.get('query') ?? '';

  // 검색어(PR #63)와 직군/지역/분야 체크박스(이번 변경) 전부 "스테이징 ->
  // 명시적 커밋" 방식으로 통일한다. 체크박스 클릭/텍스트 입력은 로컬
  // staged state만 바꾸고, 돋보기 클릭 또는 Enter를 눌러야 한꺼번에
  // paramsString(URL)에 반영된다. lastCommittedRef는 우리가 마지막으로
  // 커밋(반영)한 값 -- 커밋된 URL이 이 값과 다르면 뒤로/앞으로 가기 등
  // 외부 변경이므로 staged state를 동기화하고, 같으면 (아직 커밋하지
  // 않은 조작을 덮어쓰지 않도록) 건드리지 않는다.
  const [queryInput, setQueryInput] = useState(committedQuery);
  const [stagedProfessions, setStagedProfessions] = useState(committedProfessions);
  const [stagedRegions, setStagedRegions] = useState(committedRegions);
  const [stagedSpecialties, setStagedSpecialties] = useState(committedSpecialties);
  const lastCommittedRef = useRef({
    query: committedQuery,
    professions: committedProfessions,
    regions: committedRegions,
    specialties: committedSpecialties,
  });

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    const cQuery = p.get('query') ?? '';
    const cProfessions = parseMulti(p, 'profession');
    const cRegions = parseMulti(p, 'region');
    const cSpecialties = parseMulti(p, 'specialty');
    const last = lastCommittedRef.current;

    if (cQuery !== last.query) {
      setQueryInput(cQuery);
    }
    if (!sameArray(cProfessions, last.professions)) {
      setStagedProfessions(cProfessions);
    }
    if (!sameArray(cRegions, last.regions)) {
      setStagedRegions(cRegions);
    }
    if (!sameArray(cSpecialties, last.specialties)) {
      setStagedSpecialties(cSpecialties);
    }
    lastCommittedRef.current = {
      query: cQuery,
      professions: cProfessions,
      regions: cRegions,
      specialties: cSpecialties,
    };
  }, [searchParams]);

  // 돋보기 클릭 또는 Enter -- 검색어와 직군/지역/분야 staged 선택을
  // 한꺼번에 커밋한다. "0개 선택 = 전체"는 파라미터를 지우는 것으로 유지.
  const commitAll = () => {
    const trimmedQuery = queryInput.trim();

    setParamsString((prev) => {
      const next = new URLSearchParams(prev);
      const applyMulti = (key: string, values: string[]) => {
        const joined = values.join(',');
        if (joined) {
          next.set(key, joined);
        } else {
          next.delete(key);
        }
      };
      applyMulti('profession', stagedProfessions);
      applyMulti('region', stagedRegions);
      applyMulti('specialty', stagedSpecialties);
      if (trimmedQuery) {
        next.set('query', trimmedQuery);
      } else {
        next.delete('query');
      }
      return next.toString();
    });

    lastCommittedRef.current = {
      query: trimmedQuery,
      professions: stagedProfessions,
      regions: stagedRegions,
      specialties: stagedSpecialties,
    };
  };

  const toggleStaged = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  // 상세검색(직군/지역/분야) 펼침 상태 -- 이미 선택된 필터가 있으면 접혀서
  // 안 보이는 게 더 혼란스러우므로 기본 펼침으로 시작한다.
  const [showAdvanced, setShowAdvanced] = useState(
    () => committedProfessions.length > 0 || committedRegions.length > 0 || committedSpecialties.length > 0
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitAll();
          }}
          placeholder="이름, 소개로 검색"
          aria-label="전문가 검색"
          className="flex-1 min-w-0 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={commitAll}
          aria-label="검색"
          title="검색"
          className="min-h-[44px] min-w-[44px] px-3 border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          🔍
        </button>
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
          <MultiSelectField
            label="직군"
            layout="list"
            selected={stagedProfessions}
            onToggle={(v) => toggleStaged(setStagedProfessions, v)}
            options={professions
              // custom(직접 입력) 슬롯은 고정 카테고리가 아니므로 필터에서 제외
              .filter((p) => p.slug !== 'custom')
              .map((p) => ({ value: p.slug, label: p.name }))}
          />

          <MultiSelectField
            label="지역"
            selected={stagedRegions}
            onToggle={(v) => toggleStaged(setStagedRegions, v)}
            options={REGIONS.map((r) => ({ value: r, label: r }))}
          />

          <MultiSelectField
            label="분야"
            layout="list"
            selected={stagedSpecialties}
            onToggle={(v) => toggleStaged(setStagedSpecialties, v)}
            options={specialties.map((s) => ({ value: s.slug, label: s.name }))}
          />
        </div>
      )}
    </div>
  );
}
