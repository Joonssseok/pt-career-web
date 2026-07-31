import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';
import { ShareButton } from './ShareButton';
import { GalleryCarousel } from '@/components/GalleryCarousel';
import { GalleryFullScroll } from '@/components/GalleryFullScroll';

export const dynamic = 'force-dynamic';

const ACADEMIC_LEVEL_LABELS: Record<string, string> = {
  graduate: '대학원',
  university: '대학교',
  high_school: '고등학교',
  middle_school: '중학교',
};

type ExpertDetail = {
  id: string;
  display_name: string | null;
  profession: string | null;
  headline: string | null;
  introduction: string | null;
  total_experience_years: number | null;
  profile_image_path: string | null;
  workplace_region: string | null;
  workplace_center_name: string | null;
  workplace_website_url: string | null;
  workplace_address: string | null;
  workplace_address_detail: string | null;
  workplace_phone: string | null;
  workplace_external_contact_url: string | null;
  workplace_latitude: number | null;
  workplace_longitude: number | null;
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

const fetchExpert = cache(async (id: string): Promise<ExpertDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_expert_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ExpertDetail;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const expert = await fetchExpert(id);

  if (!expert) {
    return {};
  }

  const title = [expert.display_name, expert.profession].filter(Boolean).join(' · ') || 'PT Career 전문가';
  const description =
    expert.headline ?? '경력과 자격으로 검증된 물리치료사, 트레이너, 재활 전문가를 찾아보세요.';
  const imageUrl = getProfilePhotoUrl(expert.profile_image_path);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
  };
}

export default async function ExpertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const expert = await fetchExpert(id);

  if (!expert) {
    notFound();
  }

  // public_expert_detail 뷰를 건드리지 않고 별도 쿼리로 가져온다(지시서 2-5) --
  // anon_select_public/authenticated_select_public RLS 정책이 이미 공개+승인
  // 프로필의 갤러리만 걸러주므로 추가 SECURITY DEFINER 함수는 필요 없다.
  const supabase = await createClient();
  const { data: galleryRows } = await supabase
    .from('profile_gallery_images')
    .select('id, image_path, caption')
    .eq('profile_id', id)
    .order('display_order');

  const galleryImages = (galleryRows ?? []).map((g) => ({
    id: g.id,
    imagePath: g.image_path,
    caption: g.caption ?? '',
  }));

  return (
    <main className="min-h-screen bg-white pb-12">
      <nav className="flex items-center gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
        <Link href="/experts" className="text-sm text-gray-500 hover:text-gray-700">
          ← 목록
        </Link>
      </nav>

      <div className="px-4 py-6 sm:px-6 max-w-2xl mx-auto space-y-6">
        <div className="flex gap-4 items-start">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-3xl text-gray-400">
            {expert.profile_image_path ? (
              <Image
                src={getProfilePhotoUrl(expert.profile_image_path) ?? ''}
                alt={expert.display_name ?? '전문가'}
                width={80}
                height={80}
                priority
                className="w-full h-full object-cover"
              />
            ) : (
              '🏋️'
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-page-title font-bold text-gray-900">
              {expert.display_name ?? '이름 미공개'}
            </h1>
            {expert.profession && (
              <p className="text-sm text-gray-500">{expert.profession}</p>
            )}
            {expert.headline && (
              <p className="text-sm text-gray-700 mt-1">{expert.headline}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          {expert.total_experience_years != null && (
            <span className="px-2.5 py-1 bg-gray-100 rounded-full">
              경력 {expert.total_experience_years}년
            </span>
          )}
          {expert.workplace_center_name && (
            <span className="px-2.5 py-1 bg-gray-100 rounded-full">
              {expert.workplace_region ? `${expert.workplace_region} · ` : ''}
              {expert.workplace_center_name}
            </span>
          )}
        </div>

        {expert.specialties.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">전문분야</h2>
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
          </section>
        )}

        {expert.introduction && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">소개</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{expert.introduction}</p>
          </section>
        )}

        {expert.academic_records.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">학력</h2>
            <ul className="space-y-2">
              {expert.academic_records.map((a, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">
                    {ACADEMIC_LEVEL_LABELS[a.level] ?? a.level}
                    {a.degree ? `(${a.degree})` : ''}
                  </span>
                  <span className="text-gray-500">
                    {' '}
                    · {a.school_name}
                    {a.major ? ` ${a.major}` : ''}
                  </span>
                  {(a.start_date || a.end_date) && (
                    <span className="block text-xs text-gray-400">
                      {a.start_date ?? ''}
                      {a.start_date && a.end_date ? ' ~ ' : ''}
                      {a.end_date ?? ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {expert.experiences.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">경력</h2>
            <ul className="space-y-2">
              {expert.experiences.map((e, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">{e.organization_name}</span>
                  {e.position && <span className="text-gray-500"> · {e.position}</span>}
                  {e.start_date && (
                    <span className="block text-xs text-gray-400">
                      {e.start_date} ~ {e.is_current ? '현재' : e.end_date ?? ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {expert.educations.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">교육</h2>
            <ul className="space-y-2">
              {expert.educations.map((e, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">{e.education_name}</span>
                  {e.organization_name && (
                    <span className="text-gray-500"> · {e.organization_name}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {expert.licenses.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">자격증</h2>
            <ul className="space-y-2">
              {expert.licenses.map((l, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">{l.license_name}</span>
                  {l.issuing_organization && (
                    <span className="text-gray-500"> · {l.issuing_organization}</span>
                  )}
                  {/* get_public_licenses()가 verification_status='verified' AND
                      is_public=true인 행만 반환하므로, 여기 나오는 항목은 전부
                      관리자 인증을 거친 것이다. */}
                  <span className="ml-2 inline-flex items-center gap-0.5 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                    ✓ 인증됨
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(expert.workplace_address ||
          expert.workplace_phone ||
          expert.workplace_external_contact_url ||
          expert.workplace_website_url) && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">근무기관</h2>
            <div className="space-y-3">
              {expert.workplace_address && (
                <p className="text-sm text-gray-700">
                  {expert.workplace_address}
                  {expert.workplace_address_detail ? ` ${expert.workplace_address_detail}` : ''}
                </p>
              )}

              {expert.workplace_phone && (
                <a
                  href={`tel:${expert.workplace_phone}`}
                  className="block w-full min-h-[44px] px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
                >
                  전화 걸기
                </a>
              )}

              {expert.workplace_external_contact_url && (
                <a
                  href={expert.workplace_external_contact_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full min-h-[44px] px-4 py-3 border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-slate-50 transition-colors text-center"
                >
                  외부 문의(카카오톡 등)
                </a>
              )}

              {expert.workplace_website_url && (
                <a
                  href={expert.workplace_website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full min-h-[44px] px-4 py-3 border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-slate-50 transition-colors text-center"
                >
                  센터 웹사이트 방문
                </a>
              )}
            </div>
          </section>
        )}

        <GalleryCarousel images={galleryImages} />
        <GalleryFullScroll images={galleryImages} />

        <ShareButton
          profileId={expert.id}
          displayName={expert.display_name}
          headline={expert.headline}
        />
      </div>
    </main>
  );
}
