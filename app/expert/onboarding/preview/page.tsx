import Link from 'next/link';
import { getOwnProfile } from '@/app/actions/profile';
import { getOwnExperiences } from '@/app/actions/experience';
import { getOwnEducations } from '@/app/actions/education';
import { getOwnCertifications } from '@/app/actions/certification';
import { getOwnWorkplace } from '@/app/actions/workplace';
import { getOwnSelectedSpecialtyIds, getSpecialties } from '@/app/actions/specialties';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';

export const dynamic = 'force-dynamic';

export default async function ProfilePreviewPage() {
  const [profileResult, experiencesResult, educationsResult, certificationsResult, workplaceResult, selectedResult, specialtiesResult] =
    await Promise.all([
      getOwnProfile(),
      getOwnExperiences(),
      getOwnEducations(),
      getOwnCertifications(),
      getOwnWorkplace(),
      getOwnSelectedSpecialtyIds(),
      getSpecialties(),
    ]);

  const profile = profileResult.ok ? profileResult.profile : null;
  const experiences = experiencesResult.ok ? experiencesResult.experiences : [];
  const educations = educationsResult.ok ? educationsResult.educations : [];
  const certifications = certificationsResult.ok ? certificationsResult.certifications : [];
  const workplace = workplaceResult.ok ? workplaceResult.workplace : null;
  const selectedIds = selectedResult.ok ? selectedResult.specialtyIds : [];
  const allSpecialties = specialtiesResult.ok ? specialtiesResult.specialties : [];
  const selectedSpecialties = allSpecialties.filter((s) => selectedIds.includes(s.id));

  const isLocationPublic = workplace?.is_location_public ?? false;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 font-medium">
          승인 후 공개될 화면입니다. 자격번호·증빙·개인 연락처는 표시되지 않습니다.
        </p>
      </div>

      {/* Profile Hero */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex gap-4 items-start">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl text-gray-400">
            {profile?.profile_image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getProfilePhotoUrl(profile.profile_image_path) ?? undefined}
                alt={profile?.display_name ?? '전문가'}
                className="w-full h-full object-cover"
              />
            ) : (
              (profile?.display_name?.[0] ?? '?')
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900">
              {profile?.display_name || '이름 미입력'}
            </h1>
            <p className="text-sm text-gray-500">
              {[profile?.profession, selectedSpecialties[0]?.name].filter(Boolean).join(' · ')}
            </p>
            {profile?.headline && (
              <p className="text-sm text-gray-700 mt-1">{profile.headline}</p>
            )}
            {isLocationPublic && workplace?.center_name && (
              <p className="text-xs text-gray-500 mt-1">
                {workplace.region ? `${workplace.region} · ` : ''}
                {workplace.center_name}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                승인 후 공개
              </span>
              <span className="text-xs text-gray-500">현재는 제출 전 미리보기입니다.</span>
            </div>
          </div>
        </div>

        {selectedSpecialties.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">주요 전문분야</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedSpecialties.slice(0, 3).map((s) => (
                <span
                  key={s.id}
                  className="px-3 py-1 border border-blue-300 text-blue-700 rounded-full text-xs font-medium"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled
            className="flex-1 min-h-[44px] px-4 py-2 border border-gray-200 text-gray-400 rounded-lg font-medium cursor-not-allowed"
          >
            프로필 공유
          </button>
          <button
            type="button"
            disabled
            className="flex-1 min-h-[44px] px-4 py-2 border border-gray-200 text-gray-400 rounded-lg font-medium cursor-not-allowed"
          >
            센터 정보 보기
          </button>
        </div>
        <p className="text-xs text-gray-500">개인 연락처는 공개하지 않습니다.</p>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {profile?.introduction && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">소개</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.introduction}</p>
            </div>
          )}

          {experiences.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">경력</h2>
              <ul className="space-y-3">
                {experiences.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="font-medium text-gray-900">{e.companyName}</p>
                    <p className="text-gray-500">
                      {e.position}
                      {e.startDate && ` · ${e.startDate} ~ ${e.isCurrently ? '현재' : e.endDate}`}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(educations.length > 0 || certifications.length > 0) && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">자격 및 교육</h2>
              <ul className="space-y-3">
                {certifications.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      {c.category && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {c.category}
                        </span>
                      )}
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </div>
                    <p className="text-gray-500">
                      {[c.issuer, c.issueDate].filter(Boolean).join(' · ')}
                    </p>
                  </li>
                ))}
                {educations.map((e) => (
                  <li key={e.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        교육수료
                      </span>
                      <span className="font-medium text-gray-900">{e.educationName}</span>
                    </div>
                    <p className="text-gray-500">
                      {[e.organizationName, e.completionDate].filter(Boolean).join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">한눈에 보기</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">총 경력</dt>
                <dd className="text-gray-900">{experiences.length}건</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">등록 자격·교육</dt>
                <dd className="text-gray-900">{certifications.length + educations.length}건</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">주요 전문분야</dt>
                <dd className="text-gray-900">{selectedSpecialties.length}개</dd>
              </div>
            </dl>
          </div>

          {isLocationPublic && workplace?.center_name && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <span className="inline-block mb-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                소속기관 공식 정보
              </span>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">근무기관</h2>
              <p className="text-sm text-gray-900">{workplace.center_name}</p>
              {workplace.address && (
                <p className="text-sm text-gray-700 mt-1">
                  {workplace.address}
                  {workplace.address_detail ? ` ${workplace.address_detail}` : ''}
                </p>
              )}
              {workplace.phone && <p className="text-sm text-gray-700">{workplace.phone}</p>}
              {workplace.website_url && (
                <p className="text-sm text-gray-700 break-all">{workplace.website_url}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                개인 연락처가 아닌 소속기관의 공개 정보입니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Link
          href="/expert/onboarding/specialties"
          className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
        >
          이전
        </Link>
        <Link
          href="/expert/onboarding/complete"
          className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
        >
          제출 확인으로 이동
        </Link>
      </div>
    </div>
  );
}
