'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getOwnSelectedSpecialtyIds, getSpecialties, replaceProfileSpecialties } from '@/app/actions/specialties';
import type { SectionSaveHandle } from './types';

type Specialty = { id: string; name: string; sort_order: number };

const SpecialtySection = forwardRef<SectionSaveHandle, object>(function SpecialtySection(_props, ref) {
  const requiredDialog=useRef<HTMLDialogElement>(null);
  const [loaded,setLoaded]=useState(false);
  const [loadError,setLoadError]=useState('');
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
        if (!specialtiesResult.ok || !selectedResult.ok) {setLoadError('전문분야를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');return;}
        setSpecialties(specialtiesResult.specialties);
        if (selectedResult.ok) {
          setSelectedIds(selectedResult.specialtyIds);
          setLoaded(true);
          setVisibilityMap(
            Object.fromEntries(
              selectedResult.specialties.map((s) => [s.specialtyId, s.ownerVisible])
            )
          );
        }
      }
    ).catch(()=>setLoadError('전문분야를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.'));
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

  const validate=()=>{
    if(!loaded) return {ok:false,error:loadError||'전문분야를 불러오는 중입니다. 잠시 후 저장해주세요.'};
    if(selectedIds.length===0) {
      setShowWarning(true);
      requiredDialog.current?.showModal();
      return {ok:false,error:'전문분야를 최소 1개 선택해주세요.'};
    }
    return {ok:true};
  };
  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    const checked=validate();
    if(!checked.ok) return checked;
    const result = await replaceProfileSpecialties(
      selectedIds.map((id) => ({ specialtyId: id, ownerVisible: visibilityMap[id] ?? true }))
    );
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save, validate }), [selectedIds, visibilityMap, loaded, loadError]);

  return (
    <div className="space-y-6">
      <dialog ref={requiredDialog} aria-labelledby="required-specialty-title" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-red-100 bg-white p-6 shadow-xl backdrop:bg-slate-900/25"><h2 id="required-specialty-title" className="font-bold text-slate-900">전문분야를 선택해주세요.</h2><p className="mt-3 text-sm text-slate-500">전문분야는 필수 항목입니다. 1~3개를 선택한 뒤 저장해주세요.</p><div className="mt-5 flex justify-end"><button type="button" autoFocus onClick={()=>requiredDialog.current?.close()} className="min-h-11 rounded-xl bg-blue-50 px-5 text-sm font-semibold text-primary">확인</button></div></dialog>
      {loadError&&<p role="alert" className="text-sm text-red-600">{loadError}</p>}
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
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <p className="text-sm font-medium">
            선택됨: {selectedIds.length}/{MAX_SELECTION}개
          </p>
          {selectedIds.length === 0 && (
            <p className="text-xs text-red-700 mt-1">
              최소 1개를 선택해주세요.
            </p>
          )}
        </div>

        {/* Specialties Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {specialties.map((specialty) => (
            <button
              key={specialty.id}
              type="button"
              data-profile-dirty-control
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
