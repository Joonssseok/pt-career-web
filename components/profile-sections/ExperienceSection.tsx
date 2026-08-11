'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  getOwnExperiences,
  saveExperience,
  setOwnExperienceVisibility,
  setOwnExperiencePeriodVisibility,
} from '@/app/actions/experience';
import { VisibilityToggle } from './VisibilityToggle';
import { YearMonthSelect } from './YearMonthSelect';
import type { SectionSaveHandle } from './types';

type Experience = {
  id: string;
  companyName: string;
  position: string;
  startDate: string;
  endDate: string;
  isCurrently: boolean;
  ownerVisible: boolean;
  // 이 항목의 근무기간을 공개 프로필에 표시할지. 마스터 토글(periodVisible)이
  // 켜져 있을 때만 유효하다(최종 노출 = 마스터 AND 항목별).
  periodVisible: boolean;
};

type Props = {
  // 프로필 마스터 토글이 꺼져 있으면 항목별 토글을 비활성화한다.
  profileOwnerVisible?: boolean;
};

const ExperienceSection = forwardRef<SectionSaveHandle, Props>(function ExperienceSection(
  { profileOwnerVisible = true },
  ref
) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // 경력 섹션 전체 마스터 스위치 -- 항목별 owner_visible(항목 자체를 보이거나
  // 숨김)과 별개로, 보이는 항목에서 근무기간(시작~종료일)만 가릴지를 결정한다.
  const [periodVisible, setPeriodVisible] = useState(true);
  const [periodTogglePending, setPeriodTogglePending] = useState(false);

  useEffect(() => {
    getOwnExperiences().then((result) => {
      if (!result.ok) return;
      setExperiences(result.experiences);
      setPeriodVisible(result.periodVisible);
    });
  }, []);

  const handleTogglePeriodVisibility = async () => {
    const nextVisible = !periodVisible;
    setPeriodTogglePending(true);
    setPeriodVisible(nextVisible);

    const result = await setOwnExperiencePeriodVisibility(nextVisible);
    if (!result.ok) {
      setPeriodVisible(!nextVisible);
      alert(result.error);
    }
    setPeriodTogglePending(false);
  };

  const handleToggleVisibility = async (id: string) => {
    const target = experiences.find((exp) => exp.id === id);
    if (!target) return;

    const nextVisible = !target.ownerVisible;
    setTogglingId(id);
    // 낙관적 업데이트 — 즉시 반영하고, 실패 시 되돌린다.
    setExperiences((prev) => prev.map((exp) => (exp.id === id ? { ...exp, ownerVisible: nextVisible } : exp)));

    const result = await setOwnExperienceVisibility(id, nextVisible);
    if (!result.ok) {
      setExperiences((prev) => prev.map((exp) => (exp.id === id ? { ...exp, ownerVisible: !nextVisible } : exp)));
      alert(result.error);
    }
    setTogglingId(null);
  };
  const [newExperience, setNewExperience] = useState({
    companyName: '',
    position: '',
    startDate: '',
    endDate: '',
    isCurrently: false,
    periodVisible: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof newExperience | null>(null);

  const handleAddExperience = () => {
    if (newExperience.companyName.trim() && newExperience.position.trim()) {
      setExperiences([
        ...experiences,
        {
          id: Date.now().toString(),
          ...newExperience,
          ownerVisible: true,
        },
      ]);
      setNewExperience({
        companyName: '',
        position: '',
        startDate: '',
        endDate: '',
        isCurrently: false,
        periodVisible: true,
      });
    }
  };

  const handleEditStart = (exp: Experience) => {
    setEditingId(exp.id);
    setEditForm({
      companyName: exp.companyName,
      position: exp.position,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isCurrently: exp.isCurrently,
      periodVisible: exp.periodVisible,
    });
  };

  const handleEditSave = (id: string) => {
    if (editForm) {
      setExperiences(
        experiences.map((exp) =>
          exp.id === id ? { ...exp, ...editForm } : exp
        )
      );
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleDeleteExperience = (id: string) => {
    setExperiences(experiences.filter((exp) => exp.id !== id));
  };

  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    const result = await saveExperience({
      experiences: experiences.map((exp) => ({
        id: exp.id,
        companyName: exp.companyName,
        position: exp.position,
        startDate: exp.startDate,
        endDate: exp.endDate,
        isCurrentlyWorking: exp.isCurrently,
        ownerVisible: exp.ownerVisible,
        periodVisible: exp.periodVisible,
      })),
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save }), [experiences]);

  return (
    <div className="space-y-5">
      {!profileOwnerVisible && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            전체 비공개 상태입니다. 사이드바의 프로필 공개 설정을 켜야 항목별 공개 설정이 적용됩니다.
          </p>
        </div>
      )}

      {/* 경력 섹션 전체 마스터 스위치 -- 항목별 공개/비공개(VisibilityToggle)와
          별개로, 공개된 경력 항목에서 근무기간만 가릴지를 한 번에 제어한다. */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">근무기간 공개</p>
          <p className="text-xs text-gray-500 mt-1">
            {periodVisible
              ? '공개 프로필에 경력 항목의 근무기간(시작~종료일)이 표시됩니다.'
              : '공개 프로필에서 경력 항목의 근무기간이 표시되지 않습니다. (항목 자체와 기관명·직책은 그대로 노출)'}
          </p>
        </div>
        <VisibilityToggle
          visible={periodVisible}
          onToggle={handleTogglePeriodVisibility}
          disabled={!profileOwnerVisible}
          pending={periodTogglePending}
        />
      </div>

      {/* Add New Experience */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">경력 추가</h3>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="기관명"
            value={newExperience.companyName}
            onChange={(e) =>
              setNewExperience({
                ...newExperience,
                companyName: e.target.value,
              })
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="직책"
            value={newExperience.position}
            onChange={(e) =>
              setNewExperience({
                ...newExperience,
                position: e.target.value,
              })
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">시작일</label>
            <YearMonthSelect
              value={newExperience.startDate}
              onChange={(startDate) => setNewExperience({ ...newExperience, startDate })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">종료일</label>
            <YearMonthSelect
              value={newExperience.endDate}
              onChange={(endDate) => setNewExperience({ ...newExperience, endDate })}
              disabled={newExperience.isCurrently}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newExperience.isCurrently}
              onChange={(e) =>
                setNewExperience({
                  ...newExperience,
                  isCurrently: e.target.checked,
                })
              }
            />
            <span className="text-sm text-gray-700">현재 근무 중</span>
          </label>

          {/* 항목별 기간 표시 -- 마스터 토글이 꺼져 있으면 잠긴다(통합형).
              profileOwnerVisible이 꺼졌을 때 VisibilityToggle이 disabled되는
              기존 패턴과 동일한 방식. */}
          <label
            className={`flex items-center gap-2 ${
              !profileOwnerVisible || !periodVisible ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={newExperience.periodVisible}
              disabled={!profileOwnerVisible || !periodVisible}
              onChange={(e) =>
                setNewExperience({
                  ...newExperience,
                  periodVisible: e.target.checked,
                })
              }
            />
            <span className="text-sm text-gray-700">근무기간 표시</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleAddExperience}
          className="w-full min-h-[44px] px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center"
        >
          + 경력 추가
        </button>
      </div>

      {/* List Experiences */}
      {experiences.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">추가된 경력 ({experiences.length})</h3>
          {experiences.map((exp) => (
            <div key={exp.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              {editingId === exp.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm?.companyName || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm!,
                        companyName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="기관명"
                  />
                  <input
                    type="text"
                    value={editForm?.position || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm!,
                        position: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="직책"
                  />
                  <label
                    className={`flex items-center gap-2 ${
                      !profileOwnerVisible || !periodVisible
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editForm?.periodVisible ?? true}
                      disabled={!profileOwnerVisible || !periodVisible}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm!,
                          periodVisible: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm text-gray-700">근무기간 표시</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditSave(exp.id)}
                      className="min-h-[44px] px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center justify-center"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={handleEditCancel}
                      className="min-h-[44px] px-4 py-2 bg-gray-300 text-gray-900 text-sm rounded hover:bg-gray-400 flex items-center justify-center"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      {/* 공개 프로필의 (전)/(현) 표기와 일관성 유지 */}
                      <p className="font-medium text-gray-900">
                        {exp.isCurrently ? '(현) ' : '(전) '}
                        {exp.companyName}
                      </p>
                      <p className="text-sm text-gray-600">{exp.position}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {exp.startDate && exp.startDate.substring(0, 7)}
                        {exp.endDate
                          ? ` ~ ${exp.endDate.substring(0, 7)}`
                          : ' ~ 현재'}
                      </p>
                      {/* 항목별 기간 표시 -- 여기서 바꾼 값은 "임시저장" 시 함께
                          저장된다. 마스터 토글이 꺼져 있으면 잠긴다(통합형). */}
                      <label
                        className={`mt-2 flex items-center gap-2 ${
                          !profileOwnerVisible || !periodVisible
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={exp.periodVisible}
                          disabled={!profileOwnerVisible || !periodVisible}
                          onChange={(e) =>
                            setExperiences((prev) =>
                              prev.map((item) =>
                                item.id === exp.id
                                  ? { ...item, periodVisible: e.target.checked }
                                  : item
                              )
                            )
                          }
                        />
                        <span className="text-xs text-gray-600">
                          근무기간 표시
                          {!periodVisible && ' (섹션 전체 근무기간 공개가 꺼져 있어 적용되지 않음)'}
                        </span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <VisibilityToggle
                        visible={exp.ownerVisible}
                        onToggle={() => handleToggleVisibility(exp.id)}
                        disabled={!profileOwnerVisible}
                        pending={togglingId === exp.id}
                      />
                      <button
                        type="button"
                        onClick={() => handleEditStart(exp)}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 text-blue-500 hover:text-blue-700 font-medium flex items-center justify-center"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExperience(exp.id)}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 text-red-500 hover:text-red-700 font-medium flex items-center justify-center"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
});

export default ExperienceSection;
