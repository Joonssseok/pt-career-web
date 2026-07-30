'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOwnProfile, saveOwnProfile } from '@/app/actions/profile';
import { OFFICIAL_PROFESSIONS } from '@/lib/constants/professions';
import { createClient } from '@/lib/supabase/client';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';
import ExperienceSection from '@/components/profile-sections/ExperienceSection';
import EducationSection from '@/components/profile-sections/EducationSection';
import CertificationSection from '@/components/profile-sections/CertificationSection';
import WorkplaceSection from '@/components/profile-sections/WorkplaceSection';
import SpecialtySection from '@/components/profile-sections/SpecialtySection';

type FormState = 'default' | 'error' | 'loading' | 'saved';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const EDIT_SECTIONS = [
  { value: 'basic', label: '기본 정보' },
  { value: 'experience', label: '경력' },
  { value: 'education', label: '교육' },
  { value: 'certification', label: '자격·면허' },
  { value: 'workplace', label: '근무기관' },
  { value: 'specialty', label: '전문분야' },
];

// edit 화면에서는 저장 후 페이지 이동 없이 그 자리에 머문다.
const SECTION_SUBMIT_LABEL = '저장 후 재검토 요청';
const SECTION_SAVED_MESSAGE = '✓ 저장되었습니다. 재검토 대기열로 이동했습니다.';

export default function ProfileEditPage() {
  const router = useRouter();
  const [section, setSection] = useState('basic');
  const [formData, setFormData] = useState({
    displayName: '',
    profession: '',
    bio: '',
    description: '',
    profileImagePath: '',
  });

  const [formState, setFormState] = useState<FormState>('default');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    getOwnProfile().then((result) => {
      if (!result.ok || !result.profile) return;
      const p = result.profile;
      setFormData({
        displayName: p.display_name ?? '',
        profession: p.profession ?? '',
        bio: p.headline ?? '',
        description: p.introduction ?? '',
        profileImagePath: p.profile_image_path ?? '',
      });
    });
  }, []);

  const professions = OFFICIAL_PROFESSIONS;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: 'jpg, png, webp 파일만 업로드할 수 있습니다' }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({ ...prev, image: '5MB 이하의 파일만 업로드할 수 있습니다' }));
      return;
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    setImageUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrors((prev) => ({ ...prev, image: '로그인이 필요합니다' }));
        return;
      }

      const ext = EXT_BY_TYPE[file.type];
      const path = `${user.id}/photo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setErrors((prev) => ({ ...prev, image: `업로드에 실패했습니다: ${uploadError.message}` }));
        return;
      }

      setFormData((prev) => ({ ...prev, profileImagePath: path }));
    } finally {
      setImageUploading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
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
        router.push('/my');
      }, 1200);
    } else {
      setErrors({ submit: result.error });
      setFormState('error');
    }
  };

  const getInputClass = (fieldName: string) => {
    const baseClass = 'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2';
    if (errors[fieldName]) {
      return `${baseClass} border-red-500 focus:ring-red-500`;
    }
    return `${baseClass} border-gray-300 focus:ring-blue-500`;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <p className="text-sm font-medium text-blue-600">내 프로필 수정</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">프로필 정보를 수정하세요</h1>
          <p className="text-sm text-gray-600 mt-1">
            항목을 선택해 승인된 정보를 변경할 수 있습니다.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-900 font-medium">확인 필요</p>
          <p className="text-sm text-yellow-800 mt-1">
            수정 후 저장하면 프로필이 다시 관리자 검토 상태로 전환됩니다.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">수정할 항목</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EDIT_SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {section === 'basic' && formState === 'error' && errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900 font-medium">⚠️ {errors.submit}</p>
            </div>
          )}

          {section === 'basic' && formState === 'saved' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-900 font-medium">
                ✓ 저장되었습니다. 재검토 대기열로 이동했습니다.
              </p>
            </div>
          )}

          {section === 'experience' && (
            <ExperienceSection
              submitLabel={SECTION_SUBMIT_LABEL}
              savedMessage={SECTION_SAVED_MESSAGE}
              onSaved={() => {}}
            />
          )}

          {section === 'education' && (
            <EducationSection
              submitLabel={SECTION_SUBMIT_LABEL}
              savedMessage={SECTION_SAVED_MESSAGE}
              onSaved={() => {}}
            />
          )}

          {section === 'certification' && (
            <CertificationSection
              submitLabel={SECTION_SUBMIT_LABEL}
              savedMessage={SECTION_SAVED_MESSAGE}
              onSaved={() => {}}
            />
          )}

          {section === 'workplace' && (
            <WorkplaceSection
              submitLabel={SECTION_SUBMIT_LABEL}
              savedMessage={SECTION_SAVED_MESSAGE}
              onSaved={() => {}}
            />
          )}

          {section === 'specialty' && (
            <SpecialtySection
              submitLabel={SECTION_SUBMIT_LABEL}
              savedMessage={SECTION_SAVED_MESSAGE}
              onSaved={() => {}}
            />
          )}

          {section === 'basic' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                이름/활동명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                maxLength={50}
                disabled={formState === 'loading'}
                className={getInputClass('displayName')}
              />
              {errors.displayName && (
                <p className="text-xs text-red-500 mt-1">{errors.displayName}</p>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 mb-2">프로필 사진</p>
              <label className="block bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors">
                {formData.profileImagePath ? (
                  <div className="flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getProfilePhotoUrl(formData.profileImagePath) ?? undefined}
                      alt="프로필 사진"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    <p className="text-xs text-blue-600 font-medium">
                      {imageUploading ? '⏳ 업로드 중...' : '파일 교체'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    {imageUploading ? '⏳ 업로드 중...' : '📸 프로필 사진 업로드'}
                  </p>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  disabled={imageUploading || formState === 'loading'}
                  className="hidden"
                />
              </label>
              {errors.image && <p className="text-xs text-red-500 mt-2">{errors.image}</p>}
              <p className="text-xs text-gray-500 mt-2">승인 후 공개 프로필에 표시됩니다.</p>
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">한 줄 소개</label>
              <input
                type="text"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                maxLength={100}
                disabled={formState === 'loading'}
                className={getInputClass('bio')}
              />
              {errors.bio && <p className="text-xs text-red-500 mt-1">{errors.bio}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">상세 소개</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                maxLength={500}
                disabled={formState === 'loading'}
                className={getInputClass('description')}
              />
              {errors.description && (
                <p className="text-xs text-red-500 mt-1">{errors.description}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Link
                href="/my"
                className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                변경 취소
              </Link>
              <button
                type="submit"
                disabled={formState === 'loading' || formState === 'saved'}
                className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {formState === 'loading' ? '저장 중...' : '저장 후 재검토 요청'}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
