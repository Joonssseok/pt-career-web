'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { OFFICIAL_PROFESSIONS } from '@/lib/constants/professions';
import { REGIONS } from '@/lib/constants/regions';

type Specialty = { id: string; name: string; slug: string };

export function ExpertFilters({ specialties }: { specialties: Specialty[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const profession = searchParams.get('profession') ?? '';
  const region = searchParams.get('region') ?? '';
  const specialty = searchParams.get('specialty') ?? '';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/experts?${params.toString()}`);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={profession}
        onChange={(e) => updateFilter('profession', e.target.value)}
        className="min-h-[44px] px-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
        aria-label="직군 필터"
      >
        <option value="">전체 직군</option>
        {OFFICIAL_PROFESSIONS.map((p) => (
          <option key={p} value={p}>
            {p}
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
  );
}
