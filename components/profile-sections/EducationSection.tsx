'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { getOwnEducations, saveEducation, setOwnEducationVisibility } from '@/app/actions/education';
import { VisibilityToggle } from './VisibilityToggle';
import { YearMonthSelect } from './YearMonthSelect';
import type { SectionSaveHandle } from './types';

type Education = {
  id: string;
  educationName: string;
  organizationName: string;
  startDate: string;
  completionDate: string;
  description: string;
  ownerVisible: boolean;
};

// 최근 이수 순(수료일 내림차순)으로 자동 정렬 -- 수료일이 없는 항목은
// 시작일 내림차순으로 그 아래에 배치한다. 수동 순서 변경 UI는 없다(자동
// 정렬과 충돌하므로 추가하지 않음). 렌더 직전과 save() 페이로드 구성
// 직전 양쪽에서 이 함수 하나로 동일하게 파생시킨다.
function sortEducationsByRecency(items: Education[]): Education[] {
  const withCompletion = items.filter((e) => e.completionDate);
  const withoutCompletion = items.filter((e) => !e.completionDate);
  const byDateDesc = (key: 'completionDate' | 'startDate') => (a: Education, b: Education) =>
    a[key] > b[key] ? -1 : a[key] < b[key] ? 1 : 0;

  return [
    ...[...withCompletion].sort(byDateDesc('completionDate')),
    ...[...withoutCompletion].sort(byDateDesc('startDate')),
  ];
}

type Props = {
  // 프로필 마스터 토글이 꺼져 있으면 항목별 토글을 비활성화한다.
  profileOwnerVisible?: boolean;
};

const EducationSection = forwardRef<SectionSaveHandle, Props>(function EducationSection(
  { profileOwnerVisible = true },
  ref
) {
  const [educations, setEducations] = useState<Education[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    getOwnEducations().then((result) => {
      if (!result.ok) return;
      setEducations(result.educations);
    });
  }, []);

  const handleToggleVisibility = async (id: string) => {
    const target = educations.find((edu) => edu.id === id);
    if (!target) return;

    const nextVisible = !target.ownerVisible;
    setTogglingId(id);
    setEducations((prev) => prev.map((edu) => (edu.id === id ? { ...edu, ownerVisible: nextVisible } : edu)));

    const result = await setOwnEducationVisibility(id, nextVisible);
    if (!result.ok) {
      setEducations((prev) => prev.map((edu) => (edu.id === id ? { ...edu, ownerVisible: !nextVisible } : edu)));
      alert(result.error);
    }
    setTogglingId(null);
  };

  const [newEducation, setNewEducation] = useState({
    educationName: '',
    organizationName: '',
    startDate: '',
    completionDate: '',
    description: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof newEducation | null>(null);

  const handleAddEducation = () => {
    if (newEducation.educationName.trim() && newEducation.organizationName.trim()) {
      setEducations([
        ...educations,
        {
          id: Date.now().toString(),
          ...newEducation,
          ownerVisible: true,
        },
      ]);
      setNewEducation({
        educationName: '',
        organizationName: '',
        startDate: '',
        completionDate: '',
        description: '',
      });
    }
  };

  const handleEditStart = (edu: Education) => {
    setEditingId(edu.id);
    setEditForm({
      educationName: edu.educationName,
      organizationName: edu.organizationName,
      startDate: edu.startDate,
      completionDate: edu.completionDate,
      description: edu.description,
    });
  };

  const handleEditSave = (id: string) => {
    if (editForm) {
      setEducations(
        educations.map((edu) => (edu.id === id ? { ...edu, ...editForm } : edu))
      );
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleDeleteEducation = (id: string) => {
    setEducations(educations.filter((edu) => edu.id !== id));
  };

  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    const result = await saveEducation({
      educations: sortEducationsByRecency(educations).map((edu) => ({
        id: edu.id,
        educationName: edu.educationName,
        organizationName: edu.organizationName,
        startDate: edu.startDate,
        completionDate: edu.completionDate,
        description: edu.description,
        ownerVisible: edu.ownerVisible,
      })),
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save }), [educations]);

  return (
    <div className="space-y-5">
      {!profileOwnerVisible && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            전체 비공개 상태입니다. 사이드바의 프로필 공개 설정을 켜야 항목별 공개 설정이 적용됩니다.
          </p>
        </div>
      )}

      {/* Add New Education */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">교육 이력 추가</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">기관명</label>
            <input
              type="text"
              placeholder="예: 대한필라테스협회"
              value={newEducation.organizationName}
              onChange={(e) =>
                setNewEducation({
                  ...newEducation,
                  organizationName: e.target.value,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">과정명</label>
            <input
              type="text"
              placeholder="예: 필라테스 지도자 과정"
              value={newEducation.educationName}
              onChange={(e) =>
                setNewEducation({
                  ...newEducation,
                  educationName: e.target.value,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">시작일</label>
            <YearMonthSelect
              value={newEducation.startDate}
              onChange={(startDate) => setNewEducation({ ...newEducation, startDate })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">수료일</label>
            <YearMonthSelect
              value={newEducation.completionDate}
              onChange={(completionDate) => setNewEducation({ ...newEducation, completionDate })}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">
            설명 (선택 · 최대 1,000자)
          </label>
          <textarea
            placeholder="예: 필라테스 매트·기구 지도법과 해부학을 6개월간 학습했습니다"
            value={newEducation.description}
            maxLength={1000}
            rows={4}
            onChange={(e) =>
              setNewEducation({
                ...newEducation,
                description: e.target.value,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={handleAddEducation}
          className="w-full min-h-[44px] px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center"
        >
          + 교육 이력 추가
        </button>
      </div>

      {/* List Educations -- 최근 이수 순으로 자동 정렬(수동 순서 변경 없음) */}
      {educations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">추가된 교육 이력 ({educations.length})</h3>
          {sortEducationsByRecency(educations).map((edu) => (
            <div key={edu.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              {editingId === edu.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm?.organizationName || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm!,
                        organizationName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="예: 대한필라테스협회"
                  />
                  <input
                    type="text"
                    value={editForm?.educationName || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm!,
                        educationName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="예: 필라테스 지도자 과정"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditSave(edu.id)}
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{edu.educationName}</p>
                      <p className="text-sm text-gray-600">{edu.organizationName}</p>
                      {(edu.startDate || edu.completionDate) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {edu.startDate}
                          {edu.startDate && edu.completionDate ? ' ~ ' : ''}
                          {edu.completionDate}
                        </p>
                      )}
                      {edu.description && (
                        <p className="text-xs text-gray-500 mt-1">{edu.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditStart(edu)}
                          className="min-h-[44px] px-3 py-2 text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap flex items-center justify-center"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEducation(edu.id)}
                          className="min-h-[44px] px-3 py-2 text-red-500 hover:text-red-700 font-medium whitespace-nowrap flex items-center justify-center"
                        >
                          삭제
                        </button>
                      </div>
                      <VisibilityToggle
                        visible={edu.ownerVisible}
                        onToggle={() => handleToggleVisibility(edu.id)}
                        disabled={!profileOwnerVisible}
                        pending={togglingId === edu.id}
                      />
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

export default EducationSection;
