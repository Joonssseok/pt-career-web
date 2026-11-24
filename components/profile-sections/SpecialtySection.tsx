"use client";

import {
  forwardRef,
  useEffect,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  getOwnSelectedSpecialtyIds,
  getSpecialties,
  replaceProfileSpecialties,
} from "@/app/actions/specialties";
import { CommonProfileSaveContext } from "@/components/CommonProfileSaveContext";
import type { SectionSaveHandle } from "./types";
import { SelectionDisclosure } from "./SelectionDisclosure";
import { HOSPITAL_WORK_SELECTION_NOTE, type SpecialtyOption } from "@/lib/specialties/catalog";

type Specialty = SpecialtyOption;

const SpecialtySection = forwardRef<SectionSaveHandle, {
  compact?: boolean;
  medicalTechnician?: boolean;
  previewData?: { specialties: Specialty[]; selected: { specialtyId: string; ownerVisible: boolean }[] };
}>(
  function SpecialtySection({ compact = false, medicalTechnician = false, previewData }, ref) {
    const previewRegistry = useContext(CommonProfileSaveContext);
    const requiredDialog = useRef<HTMLDialogElement>(null);
    const selectionList = useRef<HTMLDetailsElement>(null);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [specialties, setSpecialties] = useState<Specialty[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    // specialty_id -> owner_visible. 항목별 공개 토글 UI는 제거됐지만, 과거에
    // 이미 저장된 값은 재저장 시 조용히 true로 리셋되지 않도록 그대로 보존해
    // replaceProfileSpecialties에 함께 전송한다(3-6절 함정).
    const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(
      {},
    );

    const [showWarning, setShowWarning] = useState(false);

    useEffect(() => {
      (previewData
        ? Promise.resolve([{ ok: true, error: "", specialties: previewData.specialties }, {
            ok: true, error: "", specialtyIds: previewData.selected.map(row => row.specialtyId), specialties: previewData.selected,
          }] as const)
        : Promise.all([getSpecialties(), getOwnSelectedSpecialtyIds()]))
        .then(([specialtiesResult, selectedResult]) => {
          if (!specialtiesResult.ok || !selectedResult.ok) {
            setLoadError(
              "전문분야를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.",
            );
            return;
          }
          setSpecialties(specialtiesResult.specialties);
          if (selectedResult.ok) {
            setSelectedIds(selectedResult.specialtyIds);
            setLoaded(true);
            setVisibilityMap(
              Object.fromEntries(
                selectedResult.specialties.map((s) => [
                  s.specialtyId,
                  s.ownerVisible,
                ]),
              ),
            );
          }
        })
        .catch(() =>
          setLoadError(
            "전문분야를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.",
          ),
        );
    }, [previewData]);

    const unavailableSelections = specialties.filter(row =>
      row.medical_technician_only && !medicalTechnician && selectedIds.includes(row.id),
    );

    useEffect(() => {
      if (!loaded || !previewRegistry.preview) return;
      previewRegistry.preview({
        specialties: selectedIds.flatMap((id, index) => {
          const item = specialties.find((row) => row.id === id);
          if (!item || visibilityMap[id] === false || (item.medical_technician_only && !medicalTechnician)) return [];
          return [{ slug: item.slug, name: item.name, is_primary: index === 0 }];
        }),
      });
    }, [loaded, selectedIds, specialties, visibilityMap, previewRegistry, medicalTechnician]);

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
          setVisibilityMap((prevMap) => ({
            ...prevMap,
            [id]: prevMap[id] ?? true,
          }));
          return [...prev, id];
        }

        // Show warning if over max
        setShowWarning(true);
        return prev;
      });
    };

    const validate = () => {
      if (!loaded)
        return {
          ok: false,
          error:
            loadError || "전문분야를 불러오는 중입니다. 잠시 후 저장해주세요.",
        };
      if (unavailableSelections.length) return {
        ok: false,
        error: "병원 근무는 의료기사 직군만 선택할 수 있습니다. 선택을 해제하거나 직군을 확인해주세요.",
      };
      if (selectedIds.length === 0) {
        setShowWarning(true);
        if (selectionList.current) selectionList.current.open = true;
        requiredDialog.current?.showModal();
        return { ok: false, error: "전문분야를 최소 1개 선택해주세요." };
      }
      return { ok: true };
    };
    const save = async (): Promise<{ ok: boolean; error?: string }> => {
      const checked = validate();
      if (!checked.ok) return checked;
      if (previewData) return { ok: true };
      const result = await replaceProfileSpecialties(
        selectedIds.map((id) => ({
          specialtyId: id,
          ownerVisible: visibilityMap[id] ?? true,
        })),
      );
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    };

    useImperativeHandle(ref, () => ({ save, validate }), [
      selectedIds,
      visibilityMap,
      loaded,
      loadError,
      medicalTechnician,
      specialties,
      previewData,
    ]);

    return (
      <div className={compact ? "space-y-3" : "space-y-6"}>
        <dialog
          ref={requiredDialog}
          aria-labelledby="required-specialty-title"
          className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-red-100 bg-white p-6 shadow-xl backdrop:bg-slate-900/25"
        >
          <h2
            id="required-specialty-title"
            className="font-bold text-slate-900"
          >
            전문분야를 선택해주세요.
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            전문분야는 필수 항목입니다. 1~3개를 선택한 뒤 저장해주세요.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => requiredDialog.current?.close()}
              className="min-h-11 rounded-xl bg-blue-50 px-5 text-sm font-semibold text-primary"
            >
              확인
            </button>
          </div>
        </dialog>
        {loadError && (
          <p role="alert" className="text-sm text-red-600">
            {loadError}
          </p>
        )}
        {showWarning && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-900 font-medium">
              ⚠️ 전문분야는 최소 {MIN_SELECTION}개, 최대 {MAX_SELECTION}
              개까지 선택할 수 있습니다.
            </p>
          </div>
        )}

        <div className={compact ? "space-y-3" : "space-y-5"}>
          <SelectionDisclosure
            ref={selectionList}
            label="전문분야"
            selected={selectedIds
              .map((id) => specialties.find((s) => s.id === id)?.name || "")
              .filter(Boolean)}
            max={MAX_SELECTION}
            scrollable={false}
          >
            <div className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-2">
            {specialties.filter(specialty => !specialty.medical_technician_only || medicalTechnician).map((specialty) => (
              <button
                key={specialty.id}
                type="button"
                data-profile-dirty-control
                aria-pressed={selectedIds.includes(specialty.id)}
                onClick={() => toggleSpecialty(specialty.id)}
                className={`min-h-11 w-full px-2 py-2 text-left transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  selectedIds.includes(specialty.id)
                    ? "bg-blue-50"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedIds.includes(specialty.id)
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedIds.includes(specialty.id) && (
                      <span className="text-white text-sm">✓</span>
                    )}
                  </div>
                  <span
                    className={`${compact ? "text-sm" : ""} text-gray-900 font-medium`}
                  >
                    {specialty.name}
                  </span>
                </div>
              </button>
            ))}
            </div>
          </SelectionDisclosure>
          {unavailableSelections.length > 0 && (
            <div role="alert" className="text-sm leading-6 text-red-700">
              <p>병원 근무는 의료기사 직군만 선택할 수 있습니다. 다른 직군으로 바꾸려면 먼저 선택을 해제해주세요.</p>
              <button type="button" data-profile-dirty-control className="min-h-11 underline underline-offset-4" onClick={() => setSelectedIds(previous => previous.filter(id => !unavailableSelections.some(row => row.id === id)))}>
                병원 근무 선택 해제
              </button>
            </div>
          )}
          {medicalTechnician && <p className="text-xs leading-6 text-slate-500">{HOSPITAL_WORK_SELECTION_NOTE}</p>}
        </div>
      </div>
    );
  },
);

export default SpecialtySection;
