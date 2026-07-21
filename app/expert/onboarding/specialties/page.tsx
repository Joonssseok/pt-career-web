'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SpecialtiesStep() {
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  // From database specialties migration
  const specialties = [
    '근력강화·바디프로필',
    '다이어트·체형관리',
    '만성질환·특수집단 운동',
    '산전·산후 운동',
    '소아·청소년 운동',
    '스포츠 퍼포먼스',
    '시니어·낙상예방',
    '자세교정·통증관리',
    '재활운동·수술 후 회복',
    '종목별 트레이닝',
    '체력향상·컨디셔닝',
    '필라테스·요가·유연성',
  ];

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Selected specialties:', selectedSpecialties);
    // TODO: Save to database
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">⭐</span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            전문분야 선택
          </h2>
          <p className="text-sm text-gray-600">
            당신의 전문 분야를 선택해주세요 (최소 1개)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Selection Count */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 font-medium">
            선택됨: {selectedSpecialties.length}개
          </p>
        </div>

        {/* Specialties Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {specialties.map((specialty) => (
            <button
              key={specialty}
              type="button"
              onClick={() => toggleSpecialty(specialty)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedSpecialties.includes(specialty)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedSpecialties.includes(specialty)
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedSpecialties.includes(specialty) && (
                    <span className="text-white text-sm">✓</span>
                  )}
                </div>
                <span className="text-gray-900 font-medium">{specialty}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Summary */}
        {selectedSpecialties.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900 mb-2">
              선택된 전문분야:
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedSpecialties.map((specialty) => (
                <span
                  key={specialty}
                  className="px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm font-medium"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/expert/onboarding/education"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            이전
          </Link>
          <button
            type="submit"
            disabled={selectedSpecialties.length === 0}
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            프로필 설정 완료
          </button>
        </div>
      </form>

      {/* Completion Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 hidden">
        <p className="text-sm text-green-900 font-medium">
          ✓ 프로필 설정이 완료되었습니다!
        </p>
        <p className="text-xs text-green-800 mt-1">
          마이페이지에서 언제든 수정할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
