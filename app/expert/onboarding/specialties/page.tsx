'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { replaceProfileSpecialties } from '@/app/actions/specialties';

type FormState = 'default' | 'error' | 'loading' | 'saved';

export default function SpecialtiesStep() {
  const router = useRouter();
  // Mock data: 3개 선택
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([
    '필라테스·요가·유연성',
    '자세교정·통증관리',
    '체력향상·컨디셔닝',
  ]);

  const [formState, setFormState] = useState<FormState>('default');
  const [showWarning, setShowWarning] = useState(false);

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

  const MIN_SELECTION = 1;
  const MAX_SELECTION = 3;

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) => {
      if (prev.includes(specialty)) {
        setShowWarning(false);
        return prev.filter((s) => s !== specialty);
      }

      // Try to add if under max
      if (prev.length < MAX_SELECTION) {
        setShowWarning(false);
        return [...prev, specialty];
      }

      // Show warning if over max
      setShowWarning(true);
      return prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSpecialties.length < MIN_SELECTION) {
      setShowWarning(true);
      return;
    }

    setFormState('loading');

    // TODO: Convert specialty names to UUIDs via API lookup
    // For now, use placeholder UUIDs
    const specialtyUUIDs = selectedSpecialties.map(
      (_, i) => `00000000-0000-0000-0000-00000000000${i}`
    );

    const result = await replaceProfileSpecialties(specialtyUUIDs);

    if (result.ok) {
      setFormState('saved');
      setTimeout(() => {
        router.push('/expert/onboarding/complete');
      }, 1000);
    } else {
      setFormState('error');
      setTimeout(() => {
        setFormState('default');
      }, 3000);
    }
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
            당신의 전문 분야를 선택해주세요 ({MIN_SELECTION}~{MAX_SELECTION}개)
          </p>
        </div>
      </div>

      {/* State Messages */}
      {formState === 'loading' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 font-medium">
            ⏳ 저장 중입니다...
          </p>
        </div>
      )}

      {formState === 'saved' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-900 font-medium">
            ✓ 저장되었습니다!
          </p>
        </div>
      )}

      {showWarning && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-900 font-medium">
            ⚠️ 전문분야는 최소 {MIN_SELECTION}개, 최대 {MAX_SELECTION}
            개까지 선택할 수 있습니다.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Selection Count */}
        <div
          className={`border rounded-lg p-4 ${
            selectedSpecialties.length === 0
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <p className="text-sm font-medium">
            선택됨: {selectedSpecialties.length}/{MAX_SELECTION}개
          </p>
          {selectedSpecialties.length === 0 && (
            <p className="text-xs text-yellow-700 mt-1">
              최소 1개를 선택해야 다음 단계로 진행할 수 있습니다.
            </p>
          )}
        </div>

        {/* Specialties Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {specialties.map((specialty) => (
            <button
              key={specialty}
              type="button"
              onClick={() => toggleSpecialty(specialty)}
              disabled={formState === 'loading'}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedSpecialties.includes(specialty)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${
                formState === 'loading'
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
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
            className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            이전
          </Link>
          <button
            type="submit"
            disabled={
              selectedSpecialties.length === 0 ||
              selectedSpecialties.length > MAX_SELECTION ||
              formState === 'loading'
            }
            className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {formState === 'loading'
              ? '저장 중...'
              : '프로필 설정 완료'}
          </button>
        </div>
      </form>
    </div>
  );
}
