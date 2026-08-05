'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  getOwnSelectedProfessions,
  getProfessions,
  replaceProfileProfessions,
} from '@/app/actions/professions';
import type { SectionSaveHandle } from './types';

type Profession = { id: string; name: string; slug: string; sort_order: number };

const MIN_SELECTION = 1;
const MAX_SELECTION = 5;
const CUSTOM_LABEL_MAX = 20;

// SpecialtySection과 동일한 체크박스 그리드 패턴. 차이는 "직접 입력" 슬롯
// (slug='custom') 하나가 있고, 체크 시 자유입력 텍스트 필드가 나타난다는 점.
const ProfessionSection = forwardRef<SectionSaveHandle, object>(function ProfessionSection(
  _props,
  ref
) {
  const [professions, setProfessions] = useState<Profession[]>([]);
  // 선택 순서를 보존한다 -- 첫 번째 항목이 is_primary가 된다.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  // 항목별 owner_visible: 토글 UI는 없지만 저장 시 리셋을 막기 위해 보존
  // (SpecialtySection의 visibilityMap과 같은 함정 대응).
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
  const [showWarning, setShowWarning] = useState(false);
  const [customLabelError, setCustomLabelError] = useState('');

  const customProfession = professions.find((p) => p.slug === 'custom');

  useEffect(() => {
    Promise.all([getProfessions(), getOwnSelectedProfessions()]).then(
      ([professionsResult, selectedResult]) => {
        if (!professionsResult.ok) return;
        setProfessions(professionsResult.professions);
        if (selectedResult.ok) {
          setSelectedIds(selectedResult.professions.map((p) => p.professionId));
          setVisibilityMap(
            Object.fromEntries(
              selectedResult.professions.map((p) => [p.professionId, p.ownerVisible])
            )
          );
          const custom = selectedResult.professions.find((p) => p.customLabel);
          if (custom?.customLabel) setCustomLabel(custom.customLabel);
        }
      }
    );
  }, []);

  const toggleProfession = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        setShowWarning(false);
        return prev.filter((p) => p !== id);
      }
      if (prev.length < MAX_SELECTION) {
        setShowWarning(false);
        setVisibilityMap((prevMap) => ({ ...prevMap, [id]: prevMap[id] ?? true }));
        return [...prev, id];
      }
      setShowWarning(true);
      return prev;
    });
  };

  const customSelected = customProfession != null && selectedIds.includes(customProfession.id);

  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    if (selectedIds.length === 0) {
      // 아직 직군을 선택하지 않은 사용자 -- "선택됨: 0/5개" 안내가 이미 상시
      // 노출되므로, 항상 실패할 RPC 호출은 조용히 건너뛴다(SpecialtySection과
      // 동일한 처리).
      return { ok: true };
    }

    if (customSelected) {
      const trimmed = customLabel.trim();
      if (trimmed.length < 1 || trimmed.length > CUSTOM_LABEL_MAX) {
        const msg = `직접 입력 직군명을 1~${CUSTOM_LABEL_MAX}자로 입력해주세요`;
        setCustomLabelError(msg);
        return { ok: false, error: msg };
      }
    }
    setCustomLabelError('');

    const result = await replaceProfileProfessions(
      selectedIds.map((id) => ({
        professionId: id,
        customLabel:
          customProfession && id === customProfession.id ? customLabel.trim() : undefined,
        ownerVisible: visibilityMap[id] ?? true,
      }))
    );
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save }), [selectedIds, customLabel, visibilityMap]);

  return (
    <div className="space-y-5">
      {showWarning && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-900 font-medium">
            ⚠️ 직군은 최소 {MIN_SELECTION}개, 최대 {MAX_SELECTION}개까지 선택할 수 있습니다.
          </p>
        </div>
      )}

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
          <p className="text-xs text-yellow-700 mt-1">최소 1개를 선택해주세요.</p>
        )}
      </div>

      {/* Professions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {professions.map((profession) => (
          <div key={profession.id}>
            <button
              type="button"
              onClick={() => toggleProfession(profession.id)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                selectedIds.includes(profession.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedIds.includes(profession.id)
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedIds.includes(profession.id) && (
                    <span className="text-white text-sm">✓</span>
                  )}
                </div>
                <span className="text-sm text-gray-900 font-medium">{profession.name}</span>
              </div>
            </button>

            {/* 직접 입력 슬롯: 체크하면 바로 아래 자유입력 필드가 나타난다 */}
            {profession.slug === 'custom' && selectedIds.includes(profession.id) && (
              <div className="mt-2">
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => {
                    setCustomLabel(e.target.value);
                    setCustomLabelError('');
                  }}
                  maxLength={CUSTOM_LABEL_MAX}
                  placeholder={`직군명을 직접 입력 (예: 영상사, ${CUSTOM_LABEL_MAX}자 이내)`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {customLabelError && (
                  <p className="text-xs text-red-500 mt-1">{customLabelError}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {selectedIds.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">선택된 직군:</p>
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id) => {
              const profession = professions.find((p) => p.id === id);
              if (!profession) return null;
              const label =
                profession.slug === 'custom'
                  ? customLabel.trim() || profession.name
                  : profession.name;
              return (
                <span
                  key={id}
                  className="px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm font-medium"
                >
                  {label}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">첫 번째로 선택한 직군이 대표 직군으로 표시됩니다.</p>
        </div>
      )}
    </div>
  );
});

export default ProfessionSection;
