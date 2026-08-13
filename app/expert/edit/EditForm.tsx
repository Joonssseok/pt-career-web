'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getOwnProfile,
  getOwnResumePhone,
  saveOwnProfile,
  getOwnRejectionReason,
  submitProfile,
} from '@/app/actions/profile';
import { agreeToTerms, getOwnTermsAgreedAt } from '@/app/actions/terms';
import { createClient } from '@/lib/supabase/client';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';
import AcademicSection from '@/components/profile-sections/AcademicSection';
import ExperienceSection from '@/components/profile-sections/ExperienceSection';
import EducationSection from '@/components/profile-sections/EducationSection';
import CertificationSection from '@/components/profile-sections/CertificationSection';
import WorkplaceSection from '@/components/profile-sections/WorkplaceSection';
import ProfessionSection from '@/components/profile-sections/ProfessionSection';
import SpecialtySection from '@/components/profile-sections/SpecialtySection';
import GallerySection from '@/components/profile-sections/GallerySection';
import type { SectionSaveHandle } from '@/components/profile-sections/types';

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

const SUBMIT_ERROR_MESSAGE_MAP: Record<string, string> = {
  'Not authenticated': '로그인이 필요합니다.',
  'Profile not found': '프로필을 찾을 수 없습니다.',
  'Profile image is required for submission': '업로드하려면 프로필 사진을 등록해주세요.',
  'At least one experience or license is required for submission':
    '업로드하려면 경력 또는 자격/면허를 최소 1개 이상 입력해주세요.',
};

const SUSPENDED_ERROR_PREFIX = 'Profile suspended: ';

// 한 줄 소개 placeholder -- 직군별 예시를 로테이션한다. 실제 선택된 직군과
// 연동하려면 ProfessionSection(imperative ref 구조)의 상태를 부모로 끌어올려야
// 해서 범위가 커진다 -- 이번엔 마운트 시 랜덤으로 하나를 고정 노출한다.
// 과장광고 금지(이용약관 제7조) 표현("완치", "100% 효과" 등)은 넣지 않는다.
const BIO_PLACEHOLDER_EXAMPLES = [
  '무릎·어깨 재활 10년차, 축구선수 출신 물리치료사입니다',
  '체형교정 전문 PT · 다이어트 성공 사례 200건 이상',
  '생활습관병 예방 중심 건강운동관리사, 시니어 전문',
];

// 상세 소개 "예시 보기" 패널 -- ①전문분야·강점 ②대표 경력·성과 ③상담
// 철학이 한 단락 안에 자연스럽게 드러나도록 작성해, 예시 자체가 작성
// 템플릿 역할을 하게 한다. 여기도 과장광고 금지 표현은 넣지 않는다.
const DESCRIPTION_EXAMPLES = [
  {
    profession: '물리치료사',
    text: '무릎·어깨 등 근골격계 재활을 전문으로 합니다. 정형외과 협진 경험을 바탕으로 수술 후 재활 200건 이상을 담당했습니다. 통증의 원인을 함께 찾아가는 상담을 지향하며, 운동 습관이 자리 잡을 때까지 꾸준히 동행합니다.',
  },
  {
    profession: 'PT(퍼스널 트레이너)',
    text: '체형 불균형 교정과 근력 강화를 중심으로 지도하는 퍼스널 트레이너입니다. 직장인 회원 위주로 8년간 300명 이상의 운동 프로그램을 설계해왔습니다. 무리한 목표보다 오래 지속할 수 있는 루틴을 함께 만드는 걸 중요하게 생각합니다.',
  },
  {
    profession: '건강운동관리사',
    text: '생활습관병 예방과 시니어 운동 지도를 전문으로 하는 건강운동관리사입니다. 보건소·복지관 연계 프로그램에서 5년간 다양한 연령대를 지도했습니다. 몸 상태를 꼼꼼히 확인한 뒤 무리 없는 속도로 운동 강도를 조절합니다.',
  },
];

function toSubmitMessage(rawError: string): string {
  if (rawError.startsWith(SUSPENDED_ERROR_PREFIX)) {
    const reason = rawError.slice(SUSPENDED_ERROR_PREFIX.length);
    return `임시조치되어 게시할 수 없습니다${reason ? ` (사유: ${reason})` : ''}.`;
  }
  return SUBMIT_ERROR_MESSAGE_MAP[rawError] ?? '제출 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

export default function EditForm({ evidenceArchive }: { evidenceArchive?: React.ReactNode }) {
  // 조회가 끝나기 전까지는 false로 두어 아래 !termsChecked ? null : ... 분기가
  // 약관 동의 화면을 잘못 깜빡이지 않도록 한다(초기값 true였을 때, 이미 동의한
  // 사용자에게도 getOwnTermsAgreedAt() 응답 전까지 termsAgreed의 초기값 false를
  // 근거로 동의 화면이 매번 잠깐 노출되던 버그).
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [agreeCheckbox, setAgreeCheckbox] = useState(false);
  const [agreeing, setAgreeing] = useState(false);

  const [profileMeta, setProfileMeta] = useState<ProfileMeta | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<'default' | 'loading' | 'done'>('default');
  const [submitError, setSubmitError] = useState('');
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);

  const [draftSaveState, setDraftSaveState] = useState<'default' | 'loading' | 'done' | 'error'>('default');
  const [draftSaveMessage, setDraftSaveMessage] = useState('');

  const academicRef = useRef<SectionSaveHandle>(null);
  const experienceRef = useRef<SectionSaveHandle>(null);
  const educationRef = useRef<SectionSaveHandle>(null);
  const certificationRef = useRef<SectionSaveHandle>(null);
  const workplaceRef = useRef<SectionSaveHandle>(null);
  const professionRef = useRef<SectionSaveHandle>(null);
  const specialtyRef = useRef<SectionSaveHandle>(null);
  const galleryRef = useRef<SectionSaveHandle>(null);

  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    description: '',
    profileImagePath: '',
    coverImagePath: '',
    youtubeUrl: '',
    instagramUrl: '',
    blogUrl: '',
    threadsUrl: '',
    kakaoUrl: '',
    resumePhone: '',
  });

  const [formState, setFormState] = useState<FormState>('default');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageUploading, setImageUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  // 소셜링크 아이콘별 입력창 펼침 상태 -- 독립 토글(여러 개 동시 펼침 가능)
  const [openSocial, setOpenSocial] = useState<Record<string, boolean>>({});
  // 한 줄 소개 placeholder -- 서버 렌더링 시 항상 0번 예시로 시작하고,
  // 마운트 후(useEffect)에만 랜덤으로 바꾼다. 초기 state에서 바로
  // Math.random()을 쓰면 서버와 클라이언트가 다른 값을 그려 hydration
  // mismatch가 난다.
  const [bioPlaceholder, setBioPlaceholder] = useState(BIO_PLACEHOLDER_EXAMPLES[0]);
  const [showDescriptionExamples, setShowDescriptionExamples] = useState(false);

  useEffect(() => {
    setBioPlaceholder(
      BIO_PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * BIO_PLACEHOLDER_EXAMPLES.length)]
    );
  }, []);

  const loadProfile = async () => {
    // resume_phone은 컬럼 GRANT가 없어 getOwnProfile()의 일반 select에
    // 포함되지 않는다 -- 전용 RPC로 별도 조회(app/actions/profile.ts 주석 참고).
    const [result, phoneResult] = await Promise.all([getOwnProfile(), getOwnResumePhone()]);
    if (!result.ok || !result.profile) {
      setProfileMeta(null);
      return;
    }
    const p = result.profile;
    setFormData({
      displayName: p.display_name ?? '',
      bio: p.headline ?? '',
      description: p.introduction ?? '',
      profileImagePath: p.profile_image_path ?? '',
      coverImagePath: p.cover_image_path ?? '',
      youtubeUrl: p.youtube_url ?? '',
      instagramUrl: p.instagram_url ?? '',
      blogUrl: p.blog_url ?? '',
      threadsUrl: p.threads_url ?? '',
      kakaoUrl: p.kakao_url ?? '',
      resumePhone: phoneResult.ok ? phoneResult.phone : '',
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
    setShowUploadConfirm(false);
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

  // 커버 이미지 업로드 -- 프로필 사진(handleImageChange)과 동일한 패턴,
  // 저장 경로만 ${user.id}/cover.${ext}. storage RLS가 파일명이 아니라
  // user.id 폴더 prefix 기준이라 정책 변경 없이 동작한다(직접 확인).
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, cover: 'jpg, png, webp 파일만 업로드할 수 있습니다' }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({ ...prev, cover: '5MB 이하의 파일만 업로드할 수 있습니다' }));
      return;
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next.cover;
      return next;
    });
    setCoverUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrors((prev) => ({ ...prev, cover: '로그인이 필요합니다' }));
        return;
      }

      const ext = EXT_BY_TYPE[file.type];
      const path = `${user.id}/cover.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setErrors((prev) => ({ ...prev, cover: `업로드에 실패했습니다: ${uploadError.message}` }));
        return;
      }

      setFormData((prev) => ({ ...prev, coverImagePath: path }));
    } finally {
      setCoverUploading(false);
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
      bio: formData.bio,
      description: formData.description,
      profileImagePath: formData.profileImagePath,
      coverImagePath: formData.coverImagePath,
      youtubeUrl: formData.youtubeUrl,
      instagramUrl: formData.instagramUrl,
      blogUrl: formData.blogUrl,
      threadsUrl: formData.threadsUrl,
      kakaoUrl: formData.kakaoUrl,
      resumePhone: formData.resumePhone,
    });

    if (result.ok) {
      setFormState('saved');
      loadProfile();
    } else {
      setErrors({ submit: result.error });
      setFormState('error');
    }
  };

  // 맨 아래 저장 바의 "임시저장" — 기본 정보 + 6개 섹션을 검증 없이 한 번에 저장한다.
  // 기본 정보를 먼저 저장(await)해야 한다: 프로필 행 자체가 없는 상태(신규 사용자)에서는
  // 하위 섹션 RPC가 전부 "Profile not found"로 실패하므로, 순서가 바뀌면 안 된다.
  const handleSaveDraft = async () => {
    setDraftSaveState('loading');
    setDraftSaveMessage('');

    const failed: string[] = [];

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFormState('error');
      failed.push('기본 정보(필수 항목을 확인해주세요)');
    } else {
      const basicResult = await saveOwnProfile({
        displayName: formData.displayName,
        bio: formData.bio,
        description: formData.description,
        profileImagePath: formData.profileImagePath,
        // 전화번호는 이 최소 저장 경로에도 반드시 포함해야 한다 -- 포함하지
        // 않으면 save_own_profile의 DEFAULT NULL + EXCLUDED 업서트 때문에
        // "임시저장"을 누를 때마다 이미 입력된 번호가 NULL로 덮어써진다
        // (coverImagePath/소셜링크가 이 최소 호출에서 이미 겪고 있는 것과
        // 같은 기존 문제 -- 그쪽은 이번 티켓 범위 밖이라 손대지 않음).
        resumePhone: formData.resumePhone,
      });
      if (basicResult.ok) {
        setErrors({});
        setFormState('saved');
      } else {
        setErrors({ submit: basicResult.error });
        setFormState('error');
        failed.push(`기본 정보(${basicResult.error})`);
      }
    }

    const sections: Array<{ label: string; ref: React.RefObject<SectionSaveHandle | null> }> = [
      { label: '학력', ref: academicRef },
      { label: '경력', ref: experienceRef },
      { label: '교육', ref: educationRef },
      { label: '자격·면허', ref: certificationRef },
      { label: '근무기관', ref: workplaceRef },
      { label: '직군', ref: professionRef },
      { label: '전문분야', ref: specialtyRef },
      { label: '상세정보 이미지', ref: galleryRef },
    ];

    const results = await Promise.all(
      sections.map(async ({ label, ref }) => {
        if (!ref.current) return { label, ok: true as const };
        const result = await ref.current.save();
        return { label, ok: result.ok, error: result.error };
      })
    );

    for (const r of results) {
      if (!r.ok) failed.push(r.error ? `${r.label}(${r.error})` : r.label);
    }

    await loadProfile();

    if (failed.length === 0) {
      setDraftSaveState('done');
      setDraftSaveMessage('✓ 전체 저장되었습니다.');
    } else {
      setDraftSaveState('error');
      setDraftSaveMessage(`일부 저장에 실패했습니다: ${failed.join(', ')}`);
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
            아래에서 순서대로 정보를 입력하고, 맨 아래 저장 바에서 임시저장하거나 검토를 위해 업로드하세요.
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
                    <div className="flex gap-6">
                      {/* 이력서 증명사진 자리 — 실제 증명사진 규격(3.5:4.5)에 가까운 비율 박스.
                          용도(신원 확인용 증명사진)는 그대로 두고 크기만 확대(112x144 → 144x184). */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-2">
                        <div className="w-36 h-[11.5rem] rounded-lg overflow-hidden bg-gray-50 border border-gray-300 flex items-center justify-center">
                          {formData.profileImagePath ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={getProfilePhotoUrl(formData.profileImagePath) ?? undefined}
                              alt="프로필 사진"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-gray-400 text-center px-2">증명사진</span>
                          )}
                        </div>
                        <label className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition-colors">
                          {imageUploading
                            ? '⏳ 업로드 중...'
                            : formData.profileImagePath
                              ? '파일 교체'
                              : '📎 첨부파일'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleImageChange}
                            disabled={imageUploading || formState === 'loading'}
                            className="hidden"
                          />
                        </label>
                        {errors.image && (
                          <p className="text-xs text-red-500 text-center">{errors.image}</p>
                        )}
                        <p className="text-[11px] text-gray-400 text-center leading-tight">
                          승인 후 공개 프로필에 표시됩니다
                        </p>
                      </div>

                      <div className="flex-1 min-w-0 space-y-4">
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

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            전화번호 <span className="text-gray-400 font-normal">(선택)</span>
                          </label>
                          <input
                            type="tel"
                            name="resumePhone"
                            value={formData.resumePhone}
                            onChange={handleChange}
                            placeholder="예: 010-1234-5678"
                            disabled={formState === 'loading'}
                            className={getInputClass('resumePhone')}
                          />
                          <p className="text-[11px] text-gray-400 mt-1 leading-tight">
                            이력서 다운로드 시에만 사용되며 공개 프로필에는 노출되지 않습니다.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 디자인 -- 공개 프로필 상단 히어로에 표시될 커버 이미지 */}
                    <div className="pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">디자인</h3>
                      <label className="block text-sm font-medium text-gray-900 mb-2">커버 이미지</label>
                      {/* 공개 히어로(전체 폭 x h-48)와 비슷한 와이드 비율 미리보기 */}
                      <div className="w-full aspect-[3/1] rounded-lg overflow-hidden bg-gradient-to-br from-blue-900 via-blue-600 to-blue-500 border border-gray-300 flex items-center justify-center">
                        {formData.coverImagePath ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={getProfilePhotoUrl(formData.coverImagePath) ?? undefined}
                            alt="커버 이미지"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-white/80 text-center px-2">
                            커버 이미지가 없으면 기본 그라데이션이 표시됩니다
                          </span>
                        )}
                      </div>
                      <label className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition-colors">
                        {coverUploading
                          ? '⏳ 업로드 중...'
                          : formData.coverImagePath
                            ? '커버 교체'
                            : '📎 커버 이미지 업로드'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleCoverChange}
                          disabled={coverUploading || formState === 'loading'}
                          className="hidden"
                        />
                      </label>
                      {errors.cover && <p className="text-xs text-red-500 mt-1">{errors.cover}</p>}
                      <p className="text-[11px] text-gray-400 mt-1">
                        jpg/png/webp, 5MB 이하. 저장 버튼을 눌러야 공개 프로필에 반영됩니다.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">한 줄 소개</label>
                      <input
                        type="text"
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        maxLength={100}
                        placeholder={`예: ${bioPlaceholder}`}
                        disabled={formState === 'loading'}
                        className={getInputClass('bio')}
                      />
                      {errors.bio && <p className="text-xs text-red-500 mt-1">{errors.bio}</p>}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-900">상세 소개</label>
                        <button
                          type="button"
                          onClick={() => setShowDescriptionExamples((prev) => !prev)}
                          aria-expanded={showDescriptionExamples}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          {showDescriptionExamples ? '예시 접기 ▴' : '예시 보기 ▾'}
                        </button>
                      </div>

                      {showDescriptionExamples && (
                        <div className="mb-2 bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-3">
                          <p className="text-xs text-blue-800">
                            💡 전문분야·강점 → 대표 경력·성과 → 상담 스타일 순으로 써보면 자연스러워요
                          </p>
                          {DESCRIPTION_EXAMPLES.map((example) => (
                            <div key={example.profession}>
                              <p className="text-xs font-semibold text-blue-700">{example.profession} 예시</p>
                              <p className="text-xs text-gray-700 mt-1 leading-relaxed">{example.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

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

                    {/* 소셜링크 -- 아이콘을 클릭하면 그 플랫폼의 URL 입력창이
                        펼쳐진다(독립 토글). 값이 등록된 아이콘은 파란 강조 +
                        체크 배지로 표시. http(s) 형식은 저장 시 서버에서 검증.
                        kakaoUrl(개인 카카오톡 채널)은 근무기관의 "공식 문의처"
                        (workplaces.external_contact_url)와 별개 필드다. */}
                    <div className="pt-4 border-t border-gray-100 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900">소셜링크</h3>
                      <div className="flex gap-2">
                        {(
                          [
                            { name: 'youtubeUrl', label: '유튜브', icon: '▶' },
                            { name: 'instagramUrl', label: '인스타그램', icon: '📷' },
                            { name: 'blogUrl', label: '블로그', icon: '✍' },
                            { name: 'threadsUrl', label: '스레드', icon: '@' },
                            { name: 'kakaoUrl', label: '카카오톡', icon: '💬' },
                          ] as const
                        ).map(({ name, label, icon }) => {
                          const filled = !!formData[name].trim();
                          const open = !!openSocial[name];
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() =>
                                setOpenSocial((prev) => ({ ...prev, [name]: !prev[name] }))
                              }
                              aria-expanded={open}
                              title={label}
                              className={`relative flex flex-col items-center gap-1 flex-1 py-2.5 rounded-lg border-2 transition-colors ${
                                filled
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : open
                                    ? 'border-gray-400 bg-gray-50 text-gray-700'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                              }`}
                            >
                              <span className="text-lg leading-none">{icon}</span>
                              <span className="text-[10px] font-medium">{label}</span>
                              {filled && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {(
                        [
                          { name: 'youtubeUrl', label: '유튜브', placeholder: 'https://youtube.com/@channel' },
                          { name: 'instagramUrl', label: '인스타그램', placeholder: 'https://instagram.com/id' },
                          { name: 'blogUrl', label: '블로그', placeholder: 'https://blog.naver.com/id' },
                          { name: 'threadsUrl', label: '스레드', placeholder: 'https://threads.net/@id' },
                          { name: 'kakaoUrl', label: '카카오톡', placeholder: 'https://pf.kakao.com/... 또는 오픈채팅 링크' },
                        ] as const
                      )
                        .filter(({ name }) => openSocial[name])
                        .map(({ name, label, placeholder }) => (
                          <div key={name}>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {label} 링크 <span className="text-gray-400">(선택)</span>
                            </label>
                            <input
                              type="url"
                              name={name}
                              value={formData[name]}
                              onChange={handleChange}
                              placeholder={placeholder}
                              disabled={formState === 'loading'}
                              className={getInputClass(name)}
                            />
                          </div>
                        ))}
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
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      직군 <span className="text-red-500">*</span>
                    </h3>
                    <ProfessionSection ref={professionRef} />
                  </div>

                  <div className="pt-5 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">전문분야</h3>
                    <SpecialtySection ref={specialtyRef} />
                  </div>
                </section>

                {!profileMeta?.hasBasicInfo && (
                  <p className="text-xs text-gray-500 px-1">
                    먼저 기본 정보를 저장해야 아래 섹션들이 정상적으로 저장됩니다.
                  </p>
                )}

                <section id="academic" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">학력</h2>
                  <AcademicSection
                    ref={academicRef}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>

                <section id="experience" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">경력</h2>
                  <ExperienceSection
                    ref={experienceRef}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>

                <section id="education" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">교육</h2>
                  <EducationSection
                    ref={educationRef}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>

                <section id="certification" className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-gray-900">자격·면허</h2>
                  <CertificationSection
                    ref={certificationRef}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                  {evidenceArchive}
                </section>

                <section id="workplace" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">근무기관</h2>
                  <WorkplaceSection
                    ref={workplaceRef}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>

                <section id="gallery" className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">상세정보 이미지</h2>
                  <GallerySection
                    ref={galleryRef}
                    profileOwnerVisible={profileMeta?.ownerVisible ?? true}
                  />
                </section>

                <div className="sticky bottom-0 z-30 bg-white border-t border-gray-200 -mx-4 px-4 py-4 sm:mx-0 sm:rounded-lg sm:border space-y-3">
                  {draftSaveState !== 'default' && (
                    <div
                      className={`p-3 rounded-lg border ${
                        draftSaveState === 'error'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          draftSaveState === 'error' ? 'text-red-900' : 'text-green-900'
                        }`}
                      >
                        {draftSaveMessage}
                      </p>
                    </div>
                  )}

                  {submitState === 'done' && (
                    <p className="text-sm text-green-700 font-medium">
                      ✓ 업로드되었습니다! 프로필 정보가 바로 공개되었습니다.
                    </p>
                  )}
                  {submitError && <p className="text-sm text-red-700">{submitError}</p>}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={draftSaveState === 'loading'}
                      className="flex-1 min-h-[44px] px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {draftSaveState === 'loading' ? '저장 중...' : '임시저장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUploadConfirm(true)}
                      disabled={submitState === 'loading'}
                      className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {submitState === 'loading' ? '업로드 중...' : '업로드'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showUploadConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">프로필을 업로드할까요?</h2>
            <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
              <li>기본 정보·경력·학력 등 프로필 내용은 별도 검토 없이 즉시 공개됩니다.</li>
              <li>자격증·면허 증빙 파일은 이 업로드와 무관하게 관리자 검토를 거친 뒤 별도로 공개 배지가 표시됩니다.</li>
            </ul>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUploadConfirm(false)}
                className="flex-1 min-h-[44px] px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitForReview}
                className="flex-1 min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                업로드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBanner({
  status,
  profileId,
  rejectionReason,
}: {
  status: string;
  profileId: string | null;
  rejectionReason: string | null;
}) {
  if (status === 'draft' || status === 'rejected') {
    const isRejected = status === 'rejected';
    return (
      <div
        className={`p-4 rounded-lg border space-y-2 ${
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
          아래 섹션을 채운 뒤 맨 아래 "업로드" 버튼을 누르면 프로필이 바로 공개됩니다(별도 검토
          없음). 업로드하려면 프로필 사진과, 경력 또는 자격/면허 중 최소 1개가 필요합니다.
          자격증·면허 증빙 파일만 별도로 관리자 검토를 거칩니다.
        </p>
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
          정보를 수정하고 저장하면 즉시 반영됩니다. 자격증·면허 증빙 파일만 별도로 관리자
          검토를 거쳐 공개 배지가 표시됩니다.
        </p>
      </div>
    );
  }

  return null;
}
