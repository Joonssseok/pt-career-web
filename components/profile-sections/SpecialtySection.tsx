'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { getOwnSelectedSpecialtyIds, getSpecialties, replaceProfileSpecialties } from '@/app/actions/specialties';
import type { SectionSaveHandle } from './types';

type Specialty = { id: string; name: string; sort_order: number };

const SpecialtySection = forwardRef<SectionSaveHandle, object>(function SpecialtySection(_props, ref) {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // specialty_id -> owner_visible. 항목별 공개 토글 UI는 제거됐지만, 과거에
  // 이미 저장된 값은 재저장 시 조용히 true로 리셋되지 않도록 그대로 보존해
  // replaceProfileSpecialties에 함께 전송한다(3-6절 함정).
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});

  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    Promise.all([getSpecialties(), getOwnSelectedSpecialtyIds()]).then(
      ([specialtiesResult, selectedResult]) => {
        if (!specialtiesResult.ok) return;
        setSpecialties(specialtiesResult.specialties);
        if (selectedResult.ok) {
          setSelectedIds(selectedResult.specialtyIds);
          setVisibilityMap(
            Object.fromEntries(
              selectedResult.specialties.map((s) => [s.specialtyId, s.ownerVisible])
            )
          );
        }
      }
    );
  }, []);

  const MIN_SELECTION = 1;
  const MAX_SELECTION = 3;

  const toggleSpecialty = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        setShowWarning(false);
        return prev.filter((s) => s !== id);
      }

      // Try to add if under max
      if (prev.length < MAX_SELECTION) {
        setShowWarning(false);
        setVisibilityMap((prevMap) => ({ ...prevMap, [id]: prevMap[id] ?? true }));
        return [...prev, id];
      }

      // Show warning if over max
      setShowWarning(true);
      return prev;
    });
  };

  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    if (selectedIds.length === 0) {
      // 전문분야를 아직 선택하지 않은 사용자 — 아래 "선택됨: 0/3개" 안내가 이미
      // 상시 노출되므로, replaceProfileSpecialties가 항상 실패할 이 케이스는
      // 굳이 호출하지 않고 조용히 건너뛴다(중복된 실패 알림 방지).
      return { ok: true };
    }

    const result = await replaceProfileSpecialties(
      selectedIds.map((id) => ({ specialtyId: id, ownerVisible: visibilityMap[id] ?? true }))
    );
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save }), [selectedIds, visibilityMap]);

  return (
    <div className="space-y-6">
      {showWarning && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-900 font-medium">
            ⚠️ 전문분야는 최소 {MIN_SELECTION}개, 최대 {MAX_SELECTION}
            개까지 선택할 수 있습니다.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Selection Count */}
        <div
          className={`border rounded-lg p-4 ${
            selectedIds.length === 0
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <p className="text-sm font-medium">
            선택됨: {selectedIds.length}/{MAX_SELECTION}개
          </p>
          {selectedIds.length === 0 && (
            <p className="text-xs text-yellow-700 mt-1">
              최소 1개를 선택해야 다음 단계로 진행할 수 있습니다.
            </p>
          )}
        </div>

        {/* Specialties Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {specialties.map((specialty) => (
            <button
              key={specialty.id}
              type="button"
              onClick={() => toggleSpecialty(specialty.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all cursor-pointer ${
                selectedIds.includes(specialty.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedIds.includes(specialty.id)
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedIds.includes(specialty.id) && (
                    <span className="text-white text-sm">✓</span>
                  )}
                </div>
                <span className="text-gray-900 font-medium">
                  {specialty.name}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Summary */}
        {selectedIds.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900 mb-2">
              선택된 전문분야:
            </p>
            <div className="flex flex-wrap gap-2">
              {specialties
                .filter((s) => selectedIds.includes(s.id))
                .map((specialty) => (
                  <span
                    key={specialty.id}
                    className="px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm font-medium"
                  >
                    {specialty.name}
                  </span>
                ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
});

export default SpecialtySection;
