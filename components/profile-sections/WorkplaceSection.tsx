'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { getOwnWorkplace, saveWorkplace, setOwnWorkplaceVisibility } from '@/app/actions/workplace';
import { REGIONS } from '@/lib/constants/regions';
import { VisibilityToggle } from './VisibilityToggle';
import type { SectionSaveHandle } from './types';

type Props = {
  // 프로필 마스터 토글이 꺼져 있으면 이 섹션 토글을 비활성화한다.
  profileOwnerVisible?: boolean;
};

const WorkplaceSection = forwardRef<SectionSaveHandle, Props>(function WorkplaceSection(
  { profileOwnerVisible = true },
  ref
) {
  const [formData, setFormData] = useState({
    centerName: '',
    websiteUrl: '',
    officialContact: '',
    workplaceRegion: '',
    isLocationPublic: false,
    address: '',
    addressDetail: '',
    phone: '',
    latitude: '',
    longitude: '',
    ownerVisible: true,
  });
  const [togglePending, setTogglePending] = useState(false);

  const regions = REGIONS;

  useEffect(() => {
    getOwnWorkplace().then((result) => {
      if (!result.ok || !result.workplace) return;
      const w = result.workplace;
      setFormData({
        centerName: w.center_name ?? '',
        websiteUrl: w.website_url ?? '',
        officialContact: w.external_contact_url ?? '',
        workplaceRegion: w.region ?? '',
        isLocationPublic: w.is_location_public ?? false,
        address: w.address ?? '',
        addressDetail: w.address_detail ?? '',
        phone: w.phone ?? '',
        latitude: w.latitude != null ? String(w.latitude) : '',
        longitude: w.longitude != null ? String(w.longitude) : '',
        ownerVisible: w.owner_visible ?? true,
      });
    });
  }, []);

  const handleToggleVisibility = async () => {
    const nextVisible = !formData.ownerVisible;
    setTogglePending(true);
    setFormData((prev) => ({ ...prev, ownerVisible: nextVisible }));

    const result = await setOwnWorkplaceVisibility(nextVisible);
    if (!result.ok) {
      setFormData((prev) => ({ ...prev, ownerVisible: !nextVisible }));
      alert(result.error);
    }
    setTogglePending(false);
  };

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

  const [coordError, setCoordError] = useState('');

  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!formData.centerName.trim()) {
      // 근무기관을 아직 입력하지 않은 사용자 — center_name은 DB에서 NOT NULL이지만
      // 빈 문자열은 그대로 통과되므로, 이 가드가 없으면 임시저장할 때마다 이름
      // 없는 근무기관 행이 조용히 생성/유지된다. 아무것도 안 한 것으로 취급한다.
      return { ok: true };
    }

    const latitude = formData.latitude.trim() ? Number(formData.latitude) : undefined;
    const longitude = formData.longitude.trim() ? Number(formData.longitude) : undefined;

    if (
      (latitude !== undefined && Number.isNaN(latitude)) ||
      (longitude !== undefined && Number.isNaN(longitude))
    ) {
      setCoordError('좌표는 숫자로 입력해주세요');
      return { ok: false, error: '좌표는 숫자로 입력해주세요' };
    }
    setCoordError('');

    const result = await saveWorkplace({
      centerName: formData.centerName,
      websiteUrl: formData.websiteUrl || undefined,
      officialContact: formData.officialContact || undefined,
      workplaceRegion: formData.workplaceRegion || undefined,
      isLocationPublic: formData.isLocationPublic,
      address: formData.address || undefined,
      addressDetail: formData.addressDetail || undefined,
      phone: formData.phone || undefined,
      latitude,
      longitude,
      ownerVisible: formData.ownerVisible,
    });

    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save }), [formData]);

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">근무기관 섹션 공개</p>
          {!profileOwnerVisible && (
            <p className="text-xs text-gray-500 mt-1">전체 비공개 상태입니다. 사이드바의 프로필 공개 설정을 켜야 적용됩니다.</p>
          )}
        </div>
        <VisibilityToggle
          visible={formData.ownerVisible}
          onToggle={handleToggleVisibility}
          disabled={!profileOwnerVisible}
          pending={togglePending}
        />
      </div>

      <div className="space-y-5">
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

        {/* Location */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 mb-3">
            💡 개인 연락처는 공개하지 않습니다.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                주소
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="예: 서울특별시 강남구 테헤란로 123"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                type="text"
                name="addressDetail"
                value={formData.addressDetail}
                onChange={handleChange}
                placeholder="상세주소 (선택)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="위도 (선택, 예: 37.3915)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="경도 (선택, 예: 127.1120)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {coordError && <p className="text-xs text-red-500">{coordError}</p>}
          </div>
        </div>

        {/* Institution Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            기관 전화
          </label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="예: 02-1234-5678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            소속기관의 공식 연락처만 입력해주세요
          </p>
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
            카카오톡 오픈채팅 등 문의 링크
          </label>
          <input
            type="url"
            name="officialContact"
            value={formData.officialContact}
            onChange={handleChange}
            placeholder="https://open.kakao.com/o/..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 전화번호가 아닌 http:// 또는 https://로 시작하는 링크만 입력해주세요. 개인 연락처는 항상 비공개입니다.
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
                체크하고 저장하면 별도 검토 없이 즉시 PT Career 검색의 지역 필터에 나타납니다.
              </p>
            </div>
          </label>
        </div>

      </div>
    </div>
  );
});

export default WorkplaceSection;
