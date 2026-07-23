'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function WorkplaceStep() {
  const [formData, setFormData] = useState({
    centerName: '',
    websiteUrl: '',
    officialContact: '',
    workplaceRegion: '',
    isLocationPublic: false,
  });

  const regions = [
    '서울',
    '부산',
    '대구',
    '인천',
    '광주',
    '대전',
    '울산',
    '세종',
    '경기',
    '강원',
    '충북',
    '충남',
    '전북',
    '전남',
    '경북',
    '경남',
    '제주',
  ];

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const [formState, setFormState] = useState<'default' | 'loading' | 'saved'>('default');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.centerName.trim()) {
      return;
    }

    setFormState('loading');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setFormState('saved');

    setTimeout(() => {
      setFormState('default');
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">🏢</span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            현재 근무기관
          </h2>
          <p className="text-sm text-gray-600">
            근무 중인 센터 정보를 입력해주세요
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Center Name */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            센터명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="centerName"
            value={formData.centerName}
            onChange={handleChange}
            placeholder="예: 피티케어 강남센터"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Website URL */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            공식 홈페이지
          </label>
          <input
            type="url"
            name="websiteUrl"
            value={formData.websiteUrl}
            onChange={handleChange}
            placeholder="https://example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Official Contact */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            공식 문의처
          </label>
          <input
            type="text"
            name="officialContact"
            value={formData.officialContact}
            onChange={handleChange}
            placeholder="예: 02-1234-5678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 개인 연락처: 항상 비공개 / 공식 연락처: M3-A에서는 비공개 저장 (M4에서 공개 정책 적용)
          </p>
        </div>

        {/* Workplace Region */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            주요 근무지역
          </label>
          <select
            name="workplaceRegion"
            value={formData.workplaceRegion}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">근무지역을 선택해주세요 (선택사항)</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            ⏳ 근무지역 공개 정책은 운영팀 검토 중입니다 (AD-05B)
          </p>
        </div>

        {/* Location Public Flag */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="isLocationPublic"
              checked={formData.isLocationPublic}
              onChange={handleChange}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">
                근무지역을 공개합니다
              </p>
              <p className="text-xs text-gray-600 mt-1">
                체크하면 PT Career 내 검색 시 지역 필터에 나타납니다. (운영팀 승인 후 공개)
              </p>
            </div>
          </label>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/expert/onboarding/profile"
            className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            이전
          </Link>
          <button
            type="submit"
            className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
          >
            다음: 경력
          </button>
        </div>
      </form>
    </div>
  );
}
