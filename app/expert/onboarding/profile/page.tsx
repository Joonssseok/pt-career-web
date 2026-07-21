'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ProfileStep() {
  const [formData, setFormData] = useState({
    displayName: '',
    profession: '',
    bio: '',
    description: '',
    profileImagePath: '',
  });

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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Profile data:', formData);
    // TODO: Save to database
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
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">직군을 선택해주세요</option>
            {professions.map((prof) => (
              <option key={prof} value={prof}>
                {prof}
              </option>
            ))}
          </select>
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.description.length}/500
          </p>
        </div>

        {/* Profile Image Path */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            프로필 사진 (Storage 경로)
          </label>
          <input
            type="text"
            name="profileImagePath"
            value={formData.profileImagePath}
            onChange={handleChange}
            placeholder="profile-images/{user_id}/avatar.jpg"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Storage 업로드는 향후 구현됩니다
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/expert/onboarding"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            이전
          </Link>
          <button
            type="submit"
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            다음: 근무기관
          </button>
        </div>
      </form>
    </div>
  );
}
