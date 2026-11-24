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
  getOwnSelectedProfessions,
  getProfessions,
  replaceProfileProfessions,
} from "@/app/actions/professions";
import { CommonProfileSaveContext } from "@/components/CommonProfileSaveContext";
import type { SectionSaveHandle } from "./types";
import { SelectionDisclosure } from "./SelectionDisclosure";

type Profession = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_medical_technician?: boolean;
};

const MIN_SELECTION = 1;
const MAX_SELECTION = 5;
const CUSTOM_LABEL_MAX = 20;

// 첫 선택의 대표 직군 순서와 직접 입력 슬롯을 보존한다.
const ProfessionSection = forwardRef<SectionSaveHandle, {
  compact?: boolean;
  onMedicalTechnicianChange?: (value: boolean) => void;
  previewData?: { professions: Profession[]; selected: { professionId: string; customLabel: string | null; ownerVisible: boolean }[] };
}>(
  function ProfessionSection({ compact = false, onMedicalTechnicianChange, previewData }, ref) {
    const previewRegistry = useContext(CommonProfileSaveContext);
    const requiredDialog = useRef<HTMLDialogElement>(null);
    const selectionList = useRef<HTMLDetailsElement>(null);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [professions, setProfessions] = useState<Profession[]>([]);
    // 선택 순서를 보존한다 -- 첫 번째 항목이 is_primary가 된다.
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [customLabel, setCustomLabel] = useState("");
    // 항목별 owner_visible: 토글 UI는 없지만 저장 시 리셋을 막기 위해 보존
    // (SpecialtySection의 visibilityMap과 같은 함정 대응).
    const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(
      {},
    );
    const [showWarning, setShowWarning] = useState(false);
    const [customLabelError, setCustomLabelError] = useState("");

    const customProfession = professions.find((p) => p.slug === "custom");

    useEffect(() => {
      (previewData
        ? Promise.resolve([{ ok: true, error: "", professions: previewData.professions }, { ok: true, error: "", professions: previewData.selected }] as const)
        : Promise.all([getProfessions(), getOwnSelectedProfessions()]))
        .then(([professionsResult, selectedResult]) => {
          if (!professionsResult.ok || !selectedResult.ok) {
            setLoadError(
              "직군을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.",
            );
            return;
          }
          setProfessions(professionsResult.professions);
          if (selectedResult.ok) {
            setSelectedIds(
              selectedResult.professions.map((p) => p.professionId),
            );
            setVisibilityMap(
              Object.fromEntries(
                selectedResult.professions.map((p) => [
                  p.professionId,
                  p.ownerVisible,
                ]),
              ),
            );
            const custom = selectedResult.professions.find(
              (p) => p.customLabel,
            );
            if (custom?.customLabel) setCustomLabel(custom.customLabel);
            setLoaded(true);
          }
        })
        .catch(() =>
          setLoadError(
            "직군을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.",
          ),
        );
    }, [previewData]);

    useEffect(() => {
      if (loaded) onMedicalTechnicianChange?.(professions.some(
        row => selectedIds.includes(row.id) && row.is_medical_technician === true,
      ));
    }, [loaded, professions, selectedIds, onMedicalTechnicianChange]);

    useEffect(() => {
      if (!loaded || !previewRegistry.preview) return;
      previewRegistry.preview({
        professions: selectedIds.flatMap((id, index) => {
          const item = professions.find((row) => row.id === id);
          if (!item || visibilityMap[id] === false) return [];
          return [
            {
              slug: item.slug,
              name:
                item.slug === "custom"
                  ? customLabel.trim() || item.name
                  : item.name,
              is_primary: index === 0,
            },
          ];
        }),
      });
    }, [
      loaded,
      selectedIds,
      professions,
      customLabel,
      visibilityMap,
      previewRegistry,
    ]);

    const toggleProfession = (id: string) => {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          setShowWarning(false);
          return prev.filter((p) => p !== id);
        }
        if (prev.length < MAX_SELECTION) {
          setShowWarning(false);
          setVisibilityMap((prevMap) => ({
            ...prevMap,
            [id]: prevMap[id] ?? true,
          }));
          return [...prev, id];
        }
        setShowWarning(true);
        return prev;
      });
    };

    const customSelected =
      customProfession != null && selectedIds.includes(customProfession.id);

    const validate = (): { ok: boolean; error?: string } => {
      if (!loaded)
        return {
          ok: false,
          error: loadError || "직군을 불러오는 중입니다. 잠시 후 저장해주세요.",
        };
      if (selectedIds.length === 0) {
        setShowWarning(true);
        if (selectionList.current) selectionList.current.open = true;
        requiredDialog.current?.showModal();
        return { ok: false, error: "직군을 최소 1개 선택해주세요." };
      }
      if (customSelected) {
        const trimmed = customLabel.trim();
        if (trimmed.length < 1 || trimmed.length > CUSTOM_LABEL_MAX) {
          const msg = `직접 입력 직군명을 1~${CUSTOM_LABEL_MAX}자로 입력해주세요`;
          setCustomLabelError(msg);
          if (selectionList.current) selectionList.current.open = true;
          return { ok: false, error: msg };
        }
      }
      setCustomLabelError("");
      return { ok: true };
    };
    const save = async (): Promise<{ ok: boolean; error?: string }> => {
      const checked = validate();
      if (!checked.ok) return checked;
      if (previewData) return { ok: true };
      const result = await replaceProfileProfessions(
        selectedIds.map((id) => ({
          professionId: id,
          customLabel:
            customProfession && id === customProfession.id
              ? customLabel.trim()
              : undefined,
          ownerVisible: visibilityMap[id] ?? true,
        })),
      );
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    };

    useImperativeHandle(ref, () => ({ save, validate }), [
      selectedIds,
      customLabel,
      visibilityMap,
      loaded,
      loadError,
    ]);

    return (
      <div className={compact ? "space-y-3" : "space-y-5"}>
        {loadError && (
          <p role="alert" className="text-sm text-red-600">
            {loadError}
          </p>
        )}
        <dialog
          ref={requiredDialog}
          aria-labelledby="required-profession-title"
          className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-red-100 bg-white p-6 shadow-xl backdrop:bg-slate-900/25"
        >
          <h2
            id="required-profession-title"
            className="font-bold text-slate-900"
          >
            직군을 선택해주세요.
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            직군은 필수 항목입니다. 최소 1개를 선택한 뒤 저장해주세요.
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
        {showWarning && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-900 font-medium">
              ⚠️ 직군은 최소 {MIN_SELECTION}개, 최대 {MAX_SELECTION}개까지
              선택할 수 있습니다.
            </p>
          </div>
        )}

        <SelectionDisclosure
          ref={selectionList}
          label="직군"
          selected={selectedIds
            .map((id) => {
              const item = professions.find((p) => p.id === id);
              return item?.slug === "custom"
                ? customLabel.trim() || item.name
                : item?.name || "";
            })
            .filter(Boolean)}
          max={MAX_SELECTION}
        >
          {professions.map((profession) => (
            <div key={profession.id}>
              <button
                type="button"
                data-profile-dirty-control
                aria-pressed={selectedIds.includes(profession.id)}
                onClick={() => toggleProfession(profession.id)}
                className={`min-h-11 w-full px-2 py-2 text-left transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  selectedIds.includes(profession.id)
                    ? "bg-blue-50"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedIds.includes(profession.id)
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedIds.includes(profession.id) && (
                      <span className="text-white text-sm">✓</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-900 font-medium">
                    {profession.name}
                  </span>
                </div>
              </button>

              {/* 직접 입력 슬롯: 체크하면 바로 아래 자유입력 필드가 나타난다 */}
              {profession.slug === "custom" &&
                selectedIds.includes(profession.id) && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={customLabel}
                      onChange={(e) => {
                        setCustomLabel(e.target.value);
                        setCustomLabelError("");
                      }}
                      maxLength={CUSTOM_LABEL_MAX}
                      placeholder={`직군명을 직접 입력 (예: 영상사, ${CUSTOM_LABEL_MAX}자 이내)`}
                      className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {customLabelError && (
                      <p className="text-xs text-red-500 mt-1">
                        {customLabelError}
                      </p>
                    )}
                  </div>
                )}
            </div>
          ))}
        </SelectionDisclosure>

        {/* Summary */}
        <p className="text-xs leading-5 text-slate-400">
          처음 선택한 직군이 대표로 표시됩니다. 최대 {MAX_SELECTION}개까지
          선택할 수 있어요.
        </p>
      </div>
    );
  },
);

export default ProfessionSection;
