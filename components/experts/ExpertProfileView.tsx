import Image from 'next/image';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';
import { getGalleryImageUrl } from '@/lib/storage/gallery-image-url';
import { GalleryFullScroll } from '@/components/GalleryFullScroll';

const ACADEMIC_LEVEL_LABELS: Record<string, string> = {
  graduate: '대학원',
  university: '대학교',
  high_school: '고등학교',
  middle_school: '중학교',
};

type GalleryImage = {
  id: string;
  imagePath: string;
  caption: string;
};

export type ExpertProfileViewProps = {
  expert: {
    id: string;
    display_name: string | null;
    professions: { slug: string; name: string; is_primary: boolean }[];
    headline: string | null;
    introduction: string | null;
    total_experience_years: number | null;
    profile_image_path: string | null;
    cover_image_path: string | null;
    youtube_url: string | null;
    instagram_url: string | null;
    blog_url: string | null;
    threads_url: string | null;
    kakao_url: string | null;
    workplace_region: string | null;
    workplace_center_name: string | null;
    workplace_website_url: string | null;
    workplace_address: string | null;
    workplace_address_detail: string | null;
    workplace_phone: string | null;
    workplace_external_contact_url: string | null;
    specialties: { slug: string; name: string; is_primary: boolean }[];
    academic_records: {
      level: 'graduate' | 'university' | 'high_school' | 'middle_school';
      degree: string | null;
      school_name: string;
      major: string | null;
      start_date: string | null;
      end_date: string | null;
    }[];
    experiences: {
      organization_name: string;
      position: string | null;
      start_date: string | null;
      end_date: string | null;
      is_current: boolean;
      description: string | null;
    }[];
    educations: {
      education_name: string;
      organization_name: string | null;
      completion_date: string | null;
      description: string | null;
    }[];
    licenses: {
      license_name: string;
      issuing_organization: string | null;
      acquired_date: string | null;
    }[];
  };
  galleryImages: GalleryImage[];
};

const ICON_CLASS = 'w-5 h-5';

// 각 서비스의 실제 브랜드 마크(인라인 SVG). 이모지 대신 사용.
function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">
      <path
        fill="#FF0000"
        d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8Z"
      />
      <path fill="#fff" d="M9.6 15.6V8.4l6.4 3.6-6.4 3.6Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">
      <defs>
        <radialGradient id="ig-gradient" cx="0.3" cy="1" r="1.2">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.35" stopColor="#FF543E" />
          <stop offset="0.6" stopColor="#C837AB" />
          <stop offset="1" stopColor="#3051F3" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-gradient)" />
      <rect
        x="6.5"
        y="6.5"
        width="11"
        height="11"
        rx="3.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.4"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.4" />
      <circle cx="16.2" cy="7.8" r="0.9" fill="#fff" />
    </svg>
  );
}

function ThreadsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#000" />
      <path
        fill="#fff"
        d="M12.2 5c-3.2 0-5.6 1.9-5.7 5h1.9c.1-2 1.5-3.2 3.7-3.2 2.3 0 3.6 1.2 3.6 2.9 0 1.3-.7 2.1-2.1 2.5l-1.1.3c-2.5.6-3.9 1.8-3.9 3.9 0 2.3 1.9 3.8 4.6 3.8 2.4 0 4.1-1.1 4.7-3h-1.9c-.4.9-1.3 1.4-2.7 1.4-1.5 0-2.5-.7-2.5-1.9 0-1 .7-1.6 2.2-2l1.1-.3c1-.2 1.8-.6 2.3-1.1.6-.6 1-1.4 1-2.4 0-2.8-2.3-4.9-5.2-4.9Z"
      />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#FEE500" />
      <path
        fill="#3C1E1E"
        d="M12 5.5c-4.1 0-7.5 2.6-7.5 5.9 0 2.1 1.4 4 3.5 5.1-.15.55-.55 2-.63 2.3 0 0-.02.16.08.22a.28.28 0 0 0 .22 0c.3-.04 2.35-1.55 2.72-1.82.5.07 1.03.1 1.56.1 4.1 0 7.5-2.6 7.5-5.9S16.1 5.5 12 5.5Z"
      />
    </svg>
  );
}

function BlogIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#03C75A" />
      <path
        fill="#fff"
        d="M6.5 6.5h4.4l3.7 5.4V6.5h2.9v11h-4.4l-3.7-5.4v5.4H6.5v-11Z"
      />
    </svg>
  );
}

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
        <span>{icon}</span>
        {title}
        {action && <span className="ml-auto">{action}</span>}
      </h2>
      {children}
    </section>
  );
}

export function ExpertProfileView({ expert, galleryImages }: ExpertProfileViewProps) {
  const certifiedCount = expert.licenses.length;

  // 값이 있는 소셜 링크만 렌더링, 전부 비어 있으면 로고 줄 자체를 숨긴다.
  const socialLinks = [
    { label: '유튜브', Icon: YoutubeIcon, url: expert.youtube_url },
    { label: '인스타그램', Icon: InstagramIcon, url: expert.instagram_url },
    { label: '블로그', Icon: BlogIcon, url: expert.blog_url },
    { label: '스레드', Icon: ThreadsIcon, url: expert.threads_url },
    { label: '카카오톡', Icon: KakaoIcon, url: expert.kakao_url },
  ].filter(
    (l): l is { label: string; Icon: typeof YoutubeIcon; url: string } => !!l.url
  );

  // 정렬은 시작일 기준 내림차순(최근이 위). 시작일이 없는 항목은 맨 뒤로 보낸다.
  const sortedExperiences = [...expert.experiences].sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  return (
    <div className="pb-6">
      {/* 커버 이미지가 있으면 배경으로, 없으면 기존 그라데이션 기본값 유지.
          실제 이미지가 들어가면 h-36이 좁아 보여 h-48로 확대(그라데이션도 동일
          높이로 통일). */}
      <div className="relative h-48 bg-gradient-to-br from-blue-900 via-blue-600 to-blue-500 overflow-hidden">
        {expert.cover_image_path && (
          <Image
            src={getProfilePhotoUrl(expert.cover_image_path) ?? ''}
            alt=""
            fill
            priority
            className="object-cover"
          />
        )}
      </div>

      <div className="px-4 sm:px-6 max-w-2xl mx-auto">
        <div className="-mt-14 relative z-10 flex flex-col items-start">
          <div className="w-28 h-28 rounded-2xl border-4 border-white bg-blue-100 shadow-md overflow-hidden flex items-center justify-center text-4xl text-blue-300">
            {expert.profile_image_path ? (
              <Image
                src={getProfilePhotoUrl(expert.profile_image_path) ?? ''}
                alt={expert.display_name ?? '전문가'}
                width={112}
                height={112}
                priority
                className="w-full h-full object-cover"
              />
            ) : (
              '🏋️'
            )}
          </div>

          <h1 className="mt-3 text-xl font-extrabold text-gray-900">
            {expert.display_name ?? '이름 미공개'}
          </h1>
          {expert.professions.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {expert.professions.map((p) => p.name).join(' · ')}
            </p>
          )}
          {expert.headline && (
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">{expert.headline}</p>
          )}

          {socialLinks.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {socialLinks.map(({ label, Icon, url }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="rounded-full overflow-hidden hover:opacity-80 transition-opacity"
                >
                  <Icon />
                </a>
              ))}
            </div>
          )}
        </div>

        {(expert.total_experience_years != null ||
          certifiedCount > 0 ||
          expert.workplace_region) && (
          <div className="mt-4 flex border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex-1 text-center py-3 px-1">
              <div className="text-base font-extrabold text-blue-600">
                {expert.total_experience_years != null ? `${expert.total_experience_years}년` : '-'}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">경력</div>
            </div>
            <div className="flex-1 text-center py-3 px-1 border-l border-gray-200">
              <div className="text-base font-extrabold text-blue-600">{certifiedCount}개</div>
              <div className="text-[10px] text-gray-500 mt-0.5">자격/면허</div>
            </div>
            <div className="flex-1 text-center py-3 px-1 border-l border-gray-200">
              <div className="text-base font-extrabold text-blue-600">
                {expert.workplace_region ?? '-'}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">지역</div>
            </div>
          </div>
        )}

        {(expert.workplace_external_contact_url || expert.workplace_phone) && (
          <div className="mt-3 flex gap-2">
            {expert.workplace_external_contact_url && (
              <a
                href={expert.workplace_external_contact_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                상담 문의
              </a>
            )}
            {expert.workplace_phone && (
              <a
                href={`tel:${expert.workplace_phone}`}
                className="flex-1 text-center py-3 rounded-xl text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                전화 걸기
              </a>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {expert.specialties.length > 0 && (
            <SectionCard icon="🎯" title="전문 분야">
              <div className="flex flex-wrap gap-1.5">
                {expert.specialties.map((s) => (
                  <span
                    key={s.slug}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {expert.introduction && (
            <SectionCard icon="📝" title="소개">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {expert.introduction}
              </p>
            </SectionCard>
          )}

          {sortedExperiences.length > 0 && (
            <SectionCard icon="💼" title="경력">
              <ul className="divide-y divide-gray-100">
                {sortedExperiences.map((e, i) => (
                  <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="text-sm font-bold text-gray-900">
                      {e.organization_name}
                      {/* (전)/(현)은 is_current 기준 -- 항목별 기간 비공개로 날짜가
                          NULL이어도 그대로 표시한다(PR #54/#57과 동일 근거). */}
                      <span
                        className={`ml-1.5 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          e.is_current
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {e.is_current ? '현' : '전'}
                      </span>
                    </div>
                    {e.position && <div className="text-xs text-gray-500 mt-0.5">{e.position}</div>}
                    {e.start_date && (
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {e.start_date} ~ {e.is_current ? '현재' : e.end_date ?? ''}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {expert.academic_records.length > 0 && (
            <SectionCard icon="🎓" title="학력">
              <ul className="divide-y divide-gray-100">
                {expert.academic_records.map((a, i) => (
                  <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="text-sm font-semibold text-gray-900">
                      {a.school_name}
                      {a.major ? ` · ${a.major}` : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {ACADEMIC_LEVEL_LABELS[a.level] ?? a.level}
                      {a.degree ? `(${a.degree})` : ''}
                    </div>
                    {(a.start_date || a.end_date) && (
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {a.start_date ?? ''}
                        {a.start_date && a.end_date ? ' ~ ' : ''}
                        {a.end_date ?? ''}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {expert.educations.length > 0 && (
            <SectionCard icon="📚" title="교육 이수">
              <ul className="divide-y divide-gray-100">
                {expert.educations.map((e, i) => (
                  <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="text-sm font-semibold text-gray-900">{e.education_name}</div>
                    {e.organization_name && (
                      <div className="text-xs text-gray-500 mt-0.5">{e.organization_name}</div>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {expert.licenses.length > 0 && (
            <SectionCard
              icon="🏅"
              title="자격/면허"
              action={<span className="text-[11px] font-bold text-green-600">관리자 인증</span>}
            >
              <ul className="divide-y divide-gray-100">
                {expert.licenses.map((l, i) => (
                  <li key={i} className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      ✓
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {l.license_name}
                      </div>
                      {l.issuing_organization && (
                        <div className="text-xs text-gray-500 truncate">
                          {l.issuing_organization}
                        </div>
                      )}
                    </div>
                    {/* get_public_licenses()가 verification_status='verified' AND
                        is_public=true인 행만 반환하므로, 여기 나오는 항목은 전부
                        관리자 인증을 거친 것이다. */}
                    <span className="ml-auto text-[11px] font-bold text-green-600 flex-shrink-0">
                      인증됨
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {galleryImages.length > 0 && <GalleryCard images={galleryImages} />}

          {(expert.workplace_address ||
            expert.workplace_phone ||
            expert.workplace_external_contact_url ||
            expert.workplace_website_url) && (
            <SectionCard icon="📍" title="근무 기관">
              {expert.workplace_center_name && (
                <div className="text-sm font-bold text-gray-900">
                  {expert.workplace_center_name}
                </div>
              )}
              {expert.workplace_address && (
                <p className="text-xs text-gray-500 mt-1">
                  {expert.workplace_address}
                  {expert.workplace_address_detail ? ` ${expert.workplace_address_detail}` : ''}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                {expert.workplace_phone && (
                  <a
                    href={`tel:${expert.workplace_phone}`}
                    className="flex-1 text-center py-2.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    📞 전화
                  </a>
                )}
                {expert.workplace_external_contact_url && (
                  <a
                    href={expert.workplace_external_contact_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    ✉ 문의
                  </a>
                )}
                {expert.workplace_website_url && (
                  <a
                    href={expert.workplace_website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    🌐 웹사이트
                  </a>
                )}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function GalleryCard({ images }: { images: GalleryImage[] }) {
  const preview = images.slice(0, 6);

  return (
    <section className="rounded-2xl border border-gray-200 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
        <span>🖼️</span>
        활동 갤러리
        <a href="#gallery-full" className="ml-auto text-xs font-semibold text-blue-600">
          전체 보기
        </a>
      </h2>
      <div className="grid grid-cols-3 gap-1.5">
        {preview.map((img) => (
          <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={getGalleryImageUrl(img.imagePath) ?? ''}
              alt={img.caption || ''}
              width={200}
              height={200}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      <div id="gallery-full" className="mt-4 pt-4 border-t border-gray-100 scroll-mt-6">
        <GalleryFullScroll images={images} />
      </div>
    </section>
  );
}
