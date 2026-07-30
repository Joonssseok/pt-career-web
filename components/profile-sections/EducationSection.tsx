'use client';

import { useEffect, useState } from 'react';
import { getOwnEducations, saveEducation } from '@/app/actions/education';

type Education = {
  id: string;
  educationName: string;
  organizationName: string;
  completionDate: string;
  description: string;
};

type Props = {
  // 저장 성공 시 호출. 다음 단계로 이동할지, 그 자리에 머물지는 호출부가 결정한다.
  onSaved: () => void;
  submitLabel: string;
  savedMessage?: string;
  leftNav?: React.ReactNode;
  // 전달하면 "건너뛰기" 버튼을 노출한다. 목록이 비어있을 때만 호출되고,
  // 목록에 항목이 있으면 저장 후 onSaved()로 이어진다(온보딩 기존 동작).
  onSkip?: () => void;
};

export default function EducationSection({
  onSaved,
  submitLabel,
  savedMessage = '✓ 저장되었습니다!',
  leftNav,
  onSkip,
}: Props) {
  const [educations, setEducations] = useState<Education[]>([]);

  useEffect(() => {
    getOwnEducations().then((result) => {
      if (!result.ok) return;
      setEducations(result.educations);
    });
  }, []);

  const [newEducation, setNewEducation] = useState({
    educationName: '',
    organizationName: '',
    completionDate: '',
    description: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof newEducation | null>(null);
  const [formState, setFormState] = useState<'default' | 'loading' | 'saved'>('default');

  const handleAddEducation = () => {
    if (newEducation.educationName.trim() && newEducation.organizationName.trim()) {
      setEducations([
        ...educations,
        {
          id: Date.now().toString(),
          ...newEducation,
        },
      ]);
      setNewEducation({
        educationName: '',
        organizationName: '',
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

  const saveAndNotify = async () => {
    setFormState('loading');

    const result = await saveEducation({
      educations: educations.map((edu) => ({
        id: edu.id,
        educationName: edu.educationName,
        organizationName: edu.organizationName,
        completionDate: edu.completionDate,
        description: edu.description,
      })),
    });

    if (result.ok) {
      setFormState('saved');
      onSaved();
    } else {
      setFormState('default');
      alert(result.error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAndNotify();
  };

  const handleSkip = async () => {
    if (educations.length > 0) {
      await saveAndNotify();
      return;
    }
    onSkip?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">수료일</label>
          <input
            type="month"
            value={newEducation.completionDate}
            onChange={(e) =>
              setNewEducation({
                ...newEducation,
                completionDate: e.target.value,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">
            설명 (선택 · 최대 1,000자)
          </label>
          <textarea
            placeholder="교육 내용을 간단히 소개해주세요"
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

      {/* State Messages */}
      {formState === 'loading' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 font-medium">⏳ 저장 중입니다...</p>
        </div>
      )}

      {formState === 'saved' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-900 font-medium">{savedMessage}</p>
        </div>
      )}

      {/* List Educations */}
      {educations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">추가된 교육 이력 ({educations.length})</h3>
          {educations.map((edu) => (
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
                    placeholder="기관명"
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
                    placeholder="과정명"
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
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{edu.educationName}</p>
                      <p className="text-sm text-gray-600">{edu.organizationName}</p>
                      {edu.completionDate && (
                        <p className="text-xs text-gray-500 mt-1">{edu.completionDate}</p>
                      )}
                      {edu.description && (
                        <p className="text-xs text-gray-500 mt-1">{edu.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditStart(edu)}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 text-blue-500 hover:text-blue-700 font-medium flex items-center justify-center"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEducation(edu.id)}
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

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        {leftNav}
        {onSkip && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={formState === 'loading'}
            className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            건너뛰기
          </button>
        )}
        <button
          type="submit"
          disabled={formState === 'loading'}
          className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 flex items-center justify-center"
        >
          {formState === 'loading' ? '저장 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
