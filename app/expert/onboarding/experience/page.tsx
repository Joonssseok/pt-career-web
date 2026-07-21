'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ExperienceStep() {
  const [experiences, setExperiences] = useState<Array<{
    id: string;
    companyName: string;
    position: string;
    startDate: string;
    endDate: string;
    isCurrently: boolean;
  }>>([]);

  const [newExperience, setNewExperience] = useState({
    companyName: '',
    position: '',
    startDate: '',
    endDate: '',
    isCurrently: false,
  });

  const handleAddExperience = () => {
    if (newExperience.companyName && newExperience.position) {
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

  const handleDeleteExperience = (id: string) => {
    setExperiences(experiences.filter((exp) => exp.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Experience data:', experiences);
    // TODO: Save to database
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
            className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            + 경력 추가
          </button>
        </div>

        {/* List Experiences */}
        {experiences.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">추가된 경력</h3>
            {experiences.map((exp) => (
              <div
                key={exp.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
              >
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
                <button
                  type="button"
                  onClick={() => handleDeleteExperience(exp.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/expert/onboarding/workplace"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            이전
          </Link>
          <button
            type="submit"
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            다음: 교육
          </button>
        </div>
      </form>
    </div>
  );
}
