'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  getOwnSelectedSpecialtyIds,
  getSpecialties,
  replaceProfileSpecialties,
  setOwnSpecialtyVisibility,
} from '@/app/actions/specialties';
import { VisibilityToggle } from './VisibilityToggle';
import type { SectionSaveHandle } from './types';

type Specialty = { id: string; name: string; sort_order: number };

type Props = {
  // 프로필 마스터 토글이 꺼져 있으면 항목별 토글을 비활성화한다.
  profileOwnerVisible?: boolean;
};

const SpecialtySection = forwardRef<SectionSaveHandle, Props>(function SpecialtySection(
  { profileOwnerVisible = true },
  ref
) {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // specialty_id -> owner_visible. 저장 시(replaceProfileSpecialties) 함께
  // 전송해야 3-6절 함정(재저장 시 기본값 true로 리셋)을 피할 수 있다.
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  const handleToggleVisibility = async (id: string) => {
    const nextVisible = !(visibilityMap[id] ?? true);
    setTogglingId(id);
    setVisibilityMap((prev) => ({ ...prev, [id]: nextVisible }));

    const result = await setOwnSpecialtyVisibility(id, nextVisible);
    if (!result.ok) {
      setVisibilityMap((prev) => ({ ...prev, [id]: !nextVisible }));
      alert(result.error);
    }
    setTogglingId(null);
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

      {!profileOwnerVisible && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            전체 비공개 상태입니다. 사이드바의 프로필 공개 설정을 켜야 항목별 공개 설정이 적용됩니다.
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
                    className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm font-medium"
                  >
                    {specialty.name}
                    <VisibilityToggle
                      visible={visibilityMap[specialty.id] ?? true}
                      onToggle={() => handleToggleVisibility(specialty.id)}
                      disabled={!profileOwnerVisible}
                      pending={togglingId === specialty.id}
                    />
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
