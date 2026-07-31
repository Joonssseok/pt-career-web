'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getOwnProfile,
  saveOwnProfile,
  getOwnRejectionReason,
  submitProfile,
} from '@/app/actions/profile';
import { agreeToTerms, getOwnTermsAgreedAt } from '@/app/actions/terms';
import { OFFICIAL_PROFESSIONS } from '@/lib/constants/professions';
import { createClient } from '@/lib/supabase/client';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';
import ExperienceSection from '@/components/profile-sections/ExperienceSection';
import EducationSection from '@/components/profile-sections/EducationSection';
import CertificationSection from '@/components/profile-sections/CertificationSection';
import WorkplaceSection from '@/components/profile-sections/WorkplaceSection';
import SpecialtySection from '@/components/profile-sections/SpecialtySection';
import GallerySection from '@/components/profile-sections/GallerySection';

type FormState = 'default' | 'error' | 'loading' | 'saved';
type ProfileMeta = {
  id: string;
  verificationStatus: string;
  ownerVisible: boolean;
  hasBasicInfo: boolean;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// 저장 후 페이지 이동 없이 그 자리에 머문다(연속 스크롤 페이지이므로 "다음 단계"가 없다).
const SECTION_SUBMIT_LABEL = '저장 후 재검토 요청';
const SECTION_SAVED_MESSAGE = '✓ 저장되었습니다. 재검토 대기열로 이동했습니다.';
// 갤러리는 demote_profile_if_approved_trigger가 붙지 않아 재검토를 유발하지
// 않고 즉시 공개되므로(CTO 확정 사항), 다른 섹션과 같은 문구를 쓰면 안 된다.
const GALLERY_SUBMIT_LABEL = '저장';
const GALLERY_SAVED_MESSAGE = '✓ 저장되었습니다. 바로 공개 프로필에 반영됩니다.';

const SUBMIT_ERROR_MESSAGE_MAP: Record<string, string> = {
  'Not authenticated': '로그인이 필요합니다.',
  'Profile not found': '프로필을 찾을 수 없습니다.',
  'Profile status does not allow submission': '이미 제출되었거나 공개된 프로필입니다.',
  'Profile image is required for submission': '제출하려면 프로필 사진을 등록해주세요.',
  'At least one experience or license is required for submission':
    '제출하려면 경력 또는 자격/면허를 최소 1개 이상 입력해주세요.',
};

function toSubmitMessage(rawError: string): string {
  return SUBMIT_ERROR_MESSAGE_MAP[rawError] ?? '제출 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

export default function EditForm({ evidenceArchive }: { evidenceArchive?: React.ReactNode }) {
  const [termsChecked, setTermsChecked] = useState(true); // 약관 동의 여부 조회 중
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [agreeCheckbox, setAgreeCheckbox] = useState(false);
  const [agreeing, setAgreeing] = useState(false);

  const [profileMeta, setProfileMeta] = useState<ProfileMeta | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<'default' | 'loading' | 'done'>('default');
  const [submitError, setSubmitError] = useState('');

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

  const loadProfile = async () => {
    const result = await getOwnProfile();
    if (!result.ok || !result.profile) {
      setProfileMeta(null);
      return;
    }
    const p = result.profile;
    setFormData({
      displayName: p.display_name ?? '',
      profession: p.profession ?? '',
      bio: p.headline ?? '',
      description: p.introduction ?? '',
      profileImagePath: p.profile_image_path ?? '',
    });
    setProfileMeta({
      id: p.id,
      verificationStatus: p.verification_status,
      ownerVisible: p.owner_visible ?? true,
      hasBasicInfo: !!p.display_name,
    });

    if (p.verification_status === 'rejected') {
      const reasonResult = await getOwnRejectionReason();
      setRejectionReason(reasonResult.ok ? reasonResult.reason : null);
    } else {
      setRejectionReason(null);
    }
  };

  useEffect(() => {
    getOwnTermsAgreedAt().then((result) => {
      setTermsAgreed(!!(result.ok && result.agreedAt));
      setTermsChecked(true);
    });
    loadProfile();
  }, []);

  const handleAgreeTerms = async () => {
    if (!agreeCheckbox) return;
    setAgreeing(true);
    const result = await agreeToTerms();
    setAgreeing(false);
    if (result.ok) {
      setTermsAgreed(true);
      loadProfile();
    } else {
      alert(result.error);
    }
  };

  const handleSubmitForReview = async () => {
    setSubmitState('loading');
    setSubmitError('');
    const result = await submitProfile();
    if (result.ok) {
      setSubmitState('done');
      loadProfile();
    } else {
      setSubmitError(toSubmitMessage(result.error));
      setSubmitState('default');
    }
  };

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
      loadProfile();
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

  const status = profileMeta?.verificationStatus ?? null;
  const showSections = termsAgreed && status !== 'pending';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <p className="text-sm font-medium text-blue-600">내 프로필 관리</p>
          <h1 className="text-page-title font-semibold text-gray-900 mt-1">전문가 프로필</h1>
          <p className="text-sm text-gray-600 mt-1">
            아래에서 순서대로 정보를 입력하고, 각 섹션의 저장 버튼으로 개별 저장하세요.
          </p>
        </div>

        {!termsChecked ? null : !termsAgreed ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">시작하기 전에</h2>
              <p className="text-sm text-gray-600">
                전문가 프로필 작성을 시작하려면 이용약관과 개인정보처리방침에 동의해주세요.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeCheckbox}
                  onChange={(e) => setAgreeCheckbox(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  <Link href="/terms" target="_blank" className="text-blue-600 underline">
                    이용약관
                  </Link>
                  {' '}및{' '}
                  <Link href="/privacy" target="_blank" className="text-blue-600 underline">
                    개인정보처리방침
                  </Link>
                  에 동의합니다. (필수)
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAgreeTerms}
              disabled={!agreeCheckbox || agreeing}
              className="w-full min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {agreeing ? '처리 중...' : '동의하고 시작하기'}
            </button>
          </div>
        ) : (
          <>
            {status && (
              <StatusBanner
                status={status}
                profileId={profileMeta?.id ?? null}
                rejectionReason={rejectionReason}
                submitState={submitState}
                submitError={submitError}
                onSubmitForReview={handleSubmitForReview}
              />
            )}

            {showSections && (
              <>
                <section id="basic" className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>

                  {formState === 'error' && errors.submit && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-900 font-medium">⚠️ {errors.submit}</p>
                    </div>
                  )}

                  {formState === 'saved' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-900 font-medium">✓ 저장되었습니다.</p>
                    </div>
                  )}

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

                    <button
                      type="submit"
                      disabled={formState === 'loading'}
                      className="w-full min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {formState === 'loading' ? '저장 중...' : '기본 정보 저장'}
                    </button>
                  </form>

                  <div className="pt-5 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">전문분야</h3>
                    <SpecialtySection
                      submitLabel={SECTION_SUBMIT_LABEL}
                      savedMessage={SECTION_SAVED_MESSAGE}
                      onSaved={() => {}}
                      profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                    />
                  </div>
                </section>

                {!profileMeta?.hasBasicInfo && (
                  <p className="text-xs text-gray-500 px-1">
                    먼저 기본 정보를 저장해야 아래 섹션들이 정상적으로 저장됩니다.
                  </p>
                )}

                <section id="experience" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">경력</h2>
                  <ExperienceSection
                    submitLabel={SECTION_SUBMIT_LABEL}
                    savedMessage={SECTION_SAVED_MESSAGE}
                    onSaved={() => {}}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>

                <section id="education" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">교육</h2>
                  <EducationSection
                    submitLabel={SECTION_SUBMIT_LABEL}
                    savedMessage={SECTION_SAVED_MESSAGE}
                    onSaved={() => {}}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>

                <section id="certification" className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-gray-900">자격·면허</h2>
                  <CertificationSection
                    submitLabel={SECTION_SUBMIT_LABEL}
                    savedMessage={SECTION_SAVED_MESSAGE}
                    onSaved={() => {}}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                  {evidenceArchive}
                </section>

                <section id="workplace" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">근무기관</h2>
                  <WorkplaceSection
                    submitLabel={SECTION_SUBMIT_LABEL}
                    savedMessage={SECTION_SAVED_MESSAGE}
                    onSaved={() => {}}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>

                <section id="gallery" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">갤러리</h2>
                  <GallerySection
                    submitLabel={GALLERY_SUBMIT_LABEL}
                    savedMessage={GALLERY_SAVED_MESSAGE}
                    onSaved={() => {}}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  profileId,
  rejectionReason,
  submitState,
  submitError,
  onSubmitForReview,
}: {
  status: string;
  profileId: string | null;
  rejectionReason: string | null;
  submitState: 'default' | 'loading' | 'done';
  submitError: string;
  onSubmitForReview: () => void;
}) {
  if (status === 'draft' || status === 'rejected') {
    const isRejected = status === 'rejected';
    return (
      <div
        className={`p-4 rounded-lg border space-y-3 ${
          isRejected ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
        }`}
      >
        <p className={`text-sm font-medium ${isRejected ? 'text-red-900' : 'text-orange-800'}`}>
          {isRejected ? '반려됨' : '작성 중'}
        </p>
        {isRejected && rejectionReason && (
          <p className="text-sm text-red-800">
            <strong>반려 사유:</strong> {rejectionReason}
          </p>
        )}
        <p className="text-xs text-gray-600">
          아래 섹션을 채운 뒤 제출하면 관리자 검토를 거쳐 프로필이 공개됩니다. 제출하려면
          프로필 사진과, 경력 또는 자격/면허 중 최소 1개가 필요합니다.
        </p>
        {submitState === 'done' ? (
          <p className="text-sm text-green-700 font-medium">
            ✓ 제출되었습니다! 관리자 검토 후 공개됩니다.
          </p>
        ) : (
          <>
            {submitError && <p className="text-sm text-red-700">{submitError}</p>}
            <button
              type="button"
              onClick={onSubmitForReview}
              disabled={submitState === 'loading'}
              className="min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitState === 'loading' ? '제출 중...' : isRejected ? '다시 제출하기' : '제출하기'}
            </button>
          </>
        )}
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900 font-medium">검토 중</p>
        <p className="text-sm text-blue-800 mt-1">
          현재 관리자 검토 중입니다. 검토가 끝날 때까지 정보를 수정할 수 없습니다.
        </p>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
        <p className="text-sm text-green-900 font-medium">공개 중</p>
        {profileId && (
          <Link
            href={`/experts/${profileId}`}
            className="inline-block text-sm text-green-700 underline"
          >
            공개 프로필 보기
          </Link>
        )}
        <p className="text-xs text-gray-600">
          정보를 수정하고 저장하면 프로필이 다시 관리자 검토 상태로 전환되며, 재승인 전까지
          공개가 중단됩니다(갤러리 제외).
        </p>
      </div>
    );
  }

  return null;
}
