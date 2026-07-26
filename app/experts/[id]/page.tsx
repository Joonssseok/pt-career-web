import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
  specialties: { slug: string; name: string; is_primary: boolean }[];
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

export default async function ExpertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_expert_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const expert = data as ExpertDetail;

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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={expert.profile_image_path}
                alt={expert.display_name ?? '전문가'}
                className="w-full h-full object-cover"
              />
            ) : (
              '🏋️'
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">
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
            <h2 className="text-sm font-semibold text-gray-900 mb-2">학력</h2>
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
                </li>
              ))}
            </ul>
          </section>
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
    </main>
  );
}
