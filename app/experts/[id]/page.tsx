import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';
import { ShareButton } from './ShareButton';
import { ExpertProfileView } from '@/components/experts/ExpertProfileView';

export const dynamic = 'force-dynamic';

type ExpertDetail = {
  id: string;
  display_name: string | null;
  // display_order 순(첫 번째 = 대표 직군). custom 슬롯은 name에 자유입력
  // 라벨이 이미 치환돼 내려온다(뷰의 CASE 처리).
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
  extra_links: { label: string; url: string }[];
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

  const professionNames = expert.professions.map((p) => p.name).join(' · ');
  const title = [expert.display_name, professionNames].filter(Boolean).join(' · ') || 'PT Career 전문가';
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
    <main className="mx-auto min-h-screen max-w-4xl bg-white pb-16 pt-5 sm:pb-24 sm:pt-8">
      <nav aria-label="페이지 경로" className="mb-6 sm:mb-8">
        <Link
          href="/experts"
          className="inline-flex min-h-tap items-center gap-2 text-sm text-slate-500 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          ← 전문가 탐색
        </Link>
      </nav>

      <div id="profile-details" className="scroll-mt-32">
        <ExpertProfileView expert={expert} galleryImages={galleryImages} />
      </div>

      <div className="mt-8 border-t border-slate-100 pt-6 sm:mt-12 sm:pt-8">
        <ShareButton
          profileId={expert.id}
          displayName={expert.display_name}
          headline={expert.headline}
        />
      </div>
    </main>
  );
}
