'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { saveSpecialties, getSpecialties, getAllSpecialties } from '@/actions/specialties';

type FormState = 'default' | 'error' | 'loading' | 'saved';

export default function SpecialtiesStep() {
  const [selectedSpecialties, setSelectedSpecialties] = useState<number[]>([]);
  const [specialtyOptions, setSpecialtyOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [formState, setFormState] = useState<FormState>('default');
  const [showWarning, setShowWarning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [serverError, setServerError] = useState<string>('');

  const MIN_SELECTION = 1;
  const MAX_SELECTION = 3;

  // Load specialties list and user's selected specialties
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load all specialty options
        const optionsResult = await getAllSpecialties();
        if (optionsResult.ok) {
          setSpecialtyOptions(optionsResult.data);
        }

        // Load user's selected specialties
        const selectedResult = await getSpecialties();
        if (selectedResult.ok) {
          setSelectedSpecialties(selectedResult.data.map((s) => s.specialtyId));
        }
      } catch (error) {
        console.error('Failed to load specialties:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    loadData();
  }, []);

  const toggleSpecialty = (specialtyId: number) => {
    setSelectedSpecialties((prev) => {
      if (prev.includes(specialtyId)) {
        setShowWarning(false);
        return prev.filter((s) => s !== specialtyId);
      }

      // Try to add if under max
      if (prev.length < MAX_SELECTION) {
        setShowWarning(false);
        return [...prev, specialtyId];
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
    setServerError('');

    try {
      const result = await saveSpecialties(selectedSpecialties);

      if (result.ok) {
        setFormState('saved');

        // Reset to default after 2 seconds
        setTimeout(() => {
          setFormState('default');
        }, 2000);
      } else {
        setServerError(result.error.message);
        setFormState('default');
      }
    } catch (error) {
      console.error('Save specialties error:', error);
      setServerError('전문분야 저장 실패');
      setFormState('default');
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
        {/* State Messages */}
        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-900 font-medium">
              ⚠️ {serverError}
            </p>
          </div>
        )}

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
          {specialtyOptions.map((specialty) => (
            <button
              key={specialty.id}
              type="button"
              onClick={() => toggleSpecialty(specialty.id)}
              disabled={formState === 'loading'}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedSpecialties.includes(specialty.id)
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
                    selectedSpecialties.includes(specialty.id)
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedSpecialties.includes(specialty.id) && (
                    <span className="text-white text-sm">✓</span>
                  )}
                </div>
                <span className="text-gray-900 font-medium">{specialty.name}</span>
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
              {selectedSpecialties.map((specialtyId) => {
                const specialty = specialtyOptions.find((s) => s.id === specialtyId);
                return (
                  <span
                    key={specialtyId}
                    className="px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm font-medium"
                  >
                    {specialty?.name || `Specialty ${specialtyId}`}
                  </span>
                );
              })}
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
