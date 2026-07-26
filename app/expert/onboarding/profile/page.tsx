'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveOwnProfile } from '@/app/actions/profile';

type FormState = 'default' | 'error' | 'loading' | 'saved';

export default function ProfileStep() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    displayName: '홍길동',
    profession: '필라테스 강사',
    bio: '10년 경력의 필라테스 강사입니다',
    description: '소비자 중심의 맞춤형 운동 프로그램 제공',
    profileImagePath: '',
  });

  const [formState, setFormState] = useState<FormState>('default');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const professions = [
    '필라테스 강사',
    '개인 트레이너',
    '스포츠 코치',
    '재활운동 전문가',
    '기타',
  ];

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = '이름을 입력해주세요';
    } else if (formData.displayName.length > 50) {
      newErrors.displayName = '이름은 50자 이내여야 합니다';
    }

    if (!formData.profession) {
      newErrors.profession = '직군을 선택해주세요';
    }

    if (formData.bio.length > 100) {
      newErrors.bio = '한 줄 소개는 100자 이내여야 합니다';
    }

    if (formData.description.length > 500) {
      newErrors.description = '상세 소개는 500자 이내여야 합니다';
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFormState('error');
      return;
    }

    setFormState('loading');
    setErrors({});

    const result = await saveOwnProfile({
      displayName: formData.displayName,
      profession: formData.profession,
      bio: formData.bio,
      description: formData.description,
      profileImagePath: formData.profileImagePath,
    });

    if (result.ok) {
      setFormState('saved');
      setTimeout(() => {
        router.push('/expert/onboarding/workplace');
      }, 1000);
    } else {
      setErrors({ submit: result.error });
      setFormState('error');
    }
  };

  const getInputClass = (fieldName: string) => {
    const baseClass =
      'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2';
    if (errors[fieldName]) {
      return `${baseClass} border-red-500 focus:ring-red-500`;
    }
    return `${baseClass} border-gray-300 focus:ring-blue-500`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">👤</span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            프로필 기본정보
          </h2>
          <p className="text-sm text-gray-600">
            당신의 기본 정보를 입력해주세요
          </p>
        </div>
      </div>

      {/* State Messages */}
      {formState === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-900 font-medium">
            ⚠️ 입력 오류가 있습니다. 아래 항목을 확인해주세요.
          </p>
        </div>
      )}

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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            이름/활동명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            placeholder="홍길동"
            maxLength={50}
            disabled={formState === 'loading'}
            className={getInputClass('displayName')}
          />
          {errors.displayName && (
            <p className="text-xs text-red-500 mt-1">{errors.displayName}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {formData.displayName.length}/50
          </p>
        </div>

        {/* Profession */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            직군 <span className="text-red-500">*</span>
          </label>
          <select
            name="profession"
            value={formData.profession}
            onChange={handleChange}
            disabled={formState === 'loading'}
            className={getInputClass('profession')}
          >
            <option value="">직군을 선택해주세요</option>
            {professions.map((prof) => (
              <option key={prof} value={prof}>
                {prof}
              </option>
            ))}
          </select>
          {errors.profession && (
            <p className="text-xs text-red-500 mt-1">{errors.profession}</p>
          )}
        </div>

        {/* Bio (one-liner) */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            한 줄 소개
          </label>
          <input
            type="text"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="예: 10년 경력의 필라테스 강사입니다"
            maxLength={100}
            disabled={formState === 'loading'}
            className={getInputClass('bio')}
          />
          {errors.bio && (
            <p className="text-xs text-red-500 mt-1">{errors.bio}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {formData.bio.length}/100
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            상세 소개
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="자신의 경력, 전문성, 교육 철학 등을 소개해주세요"
            rows={5}
            maxLength={500}
            disabled={formState === 'loading'}
            className={getInputClass('description')}
          />
          {errors.description && (
            <p className="text-xs text-red-500 mt-1">
              {errors.description}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {formData.description.length}/500
          </p>
        </div>

        {/* Profile Image Upload */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">
            프로필 사진 (선택)
          </p>
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-sm text-gray-600">
              📸 프로필 사진 업로드
            </p>
            <p className="text-xs text-gray-500 mt-2">
              이 기능은 M3-5에서 구현됩니다
            </p>
          </div>
          <input
            type="hidden"
            name="profileImagePath"
            value={formData.profileImagePath}
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/expert/onboarding"
            className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            이전
          </Link>
          <button
            type="submit"
            disabled={formState === 'loading' || formState === 'saved'}
            className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {formState === 'loading' ? '저장 중...' : '다음: 근무기관'}
          </button>
        </div>
      </form>
    </div>
  );
}
