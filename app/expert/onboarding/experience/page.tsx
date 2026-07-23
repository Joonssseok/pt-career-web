'use client';

import { useState } from 'react';
import Link from 'next/link';

type Experience = {
  id: string;
  companyName: string;
  position: string;
  startDate: string;
  endDate: string;
  isCurrently: boolean;
};

export default function ExperienceStep() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [newExperience, setNewExperience] = useState({
    companyName: '',
    position: '',
    startDate: '',
    endDate: '',
    isCurrently: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof newExperience | null>(null);
  const [formState, setFormState] = useState<'default' | 'loading' | 'saved'>('default');

  const handleAddExperience = () => {
    if (newExperience.companyName.trim() && newExperience.position.trim()) {
      setExperiences([
        ...experiences,
        {
          id: Date.now().toString(),
          ...newExperience,
        },
      ]);
      setNewExperience({
        companyName: '',
        position: '',
        startDate: '',
        endDate: '',
        isCurrently: false,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormState('loading');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setFormState('saved');
    setTimeout(() => setFormState('default'), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">📋</span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">경력 관리</h2>
          <p className="text-sm text-gray-600">
            과거 경력을 추가해주세요 (선택사항)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
            <input
              type="month"
              placeholder="시작일"
              value={newExperience.startDate}
              onChange={(e) =>
                setNewExperience({
                  ...newExperience,
                  startDate: e.target.value,
                })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="month"
              placeholder="종료일"
              value={newExperience.endDate}
              onChange={(e) =>
                setNewExperience({
                  ...newExperience,
                  endDate: e.target.value,
                })
              }
              disabled={newExperience.isCurrently}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

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

          <button
            type="button"
            onClick={handleAddExperience}
            className="w-full min-h-[44px] px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center"
          >
            + 경력 추가
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
            <p className="text-sm text-green-900 font-medium">✓ 저장되었습니다!</p>
          </div>
        )}

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
                        <p className="font-medium text-gray-900">{exp.companyName}</p>
                        <p className="text-sm text-gray-600">{exp.position}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {exp.startDate && exp.startDate.substring(0, 7)}
                          {exp.endDate
                            ? ` ~ ${exp.endDate.substring(0, 7)}`
                            : ' ~ 현재'}
                        </p>
                      </div>
                      <div className="flex gap-2">
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

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/expert/onboarding/workplace"
            className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            이전
          </Link>
          <button
            type="submit"
            disabled={formState === 'loading'}
            className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 flex items-center justify-center"
          >
            {formState === 'loading' ? '저장 중...' : '다음: 교육'}
          </button>
        </div>
      </form>
    </div>
  );
}
