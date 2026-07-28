import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';
import { getEvidenceFileUrl } from '@/lib/storage/evidence-file-url';
import { ReviewActions } from './ReviewActions';

export const dynamic = 'force-dynamic';

export default async function AdminProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/admin');
  }

  const { data: isAdmin } = await supabase.rpc('is_admin');

  if (!isAdmin) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const [
    { data: workplace },
    { data: experiences },
    { data: educations },
    { data: licenses },
    { data: specialtyLinks },
  ] = await Promise.all([
    supabase.from('workplaces').select('*').eq('profile_id', id).maybeSingle(),
    supabase.from('experiences').select('*').eq('profile_id', id).order('display_order'),
    supabase.from('educations').select('*').eq('profile_id', id).order('display_order'),
    supabase.from('licenses').select('*').eq('profile_id', id),
    supabase
      .from('profile_specialties')
      .select('is_primary, specialties(name)')
      .eq('profile_id', id)
      .order('display_order'),
  ]);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="flex items-center gap-3 px-4 py-4 sm:px-6 bg-white border-b border-gray-200">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← 목록
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">프로필 검토</h1>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-start">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-3xl text-gray-400">
            {profile.profile_image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getProfilePhotoUrl(profile.profile_image_path) ?? undefined}
                alt={profile.display_name ?? '프로필 사진'}
                className="w-full h-full object-cover"
              />
            ) : (
              '🏋️'
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {profile.display_name ?? '이름 미입력'}
            </h2>
            <p className="text-sm text-gray-500">{profile.profession ?? '직군 미입력'}</p>
            {profile.headline && <p className="text-sm text-gray-700 mt-1">{profile.headline}</p>}
          </div>
        </div>

        {profile.introduction && (
          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">소개</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.introduction}</p>
          </section>
        )}

        <section className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">근무기관</h3>
          {workplace ? (
            <div className="text-sm text-gray-700 space-y-1">
              <p>{workplace.center_name}</p>
              {workplace.region && <p className="text-gray-500">{workplace.region}</p>}
              {workplace.address && <p className="text-gray-500">{workplace.address} {workplace.address_detail}</p>}
              {workplace.phone && <p className="text-gray-500">연락처: {workplace.phone}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">없음</p>
          )}
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">경력</h3>
          {experiences && experiences.length > 0 ? (
            <ul className="space-y-2 text-sm text-gray-700">
              {experiences.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{e.organization_name}</span>
                  {e.position && <span className="text-gray-500"> · {e.position}</span>}
                  {e.start_date && (
                    <span className="block text-xs text-gray-400">
                      {e.start_date} ~ {e.is_current ? '현재' : e.end_date ?? ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">없음</p>
          )}
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">학력</h3>
          {educations && educations.length > 0 ? (
            <ul className="space-y-2 text-sm text-gray-700">
              {educations.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{e.education_name}</span>
                  {e.organization_name && <span className="text-gray-500"> · {e.organization_name}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">없음</p>
          )}
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">자격증</h3>
          {licenses && licenses.length > 0 ? (
            <ul className="space-y-2 text-sm text-gray-700">
              {licenses.map((l) => (
                <li key={l.id}>
                  <span className="font-medium">{l.license_name}</span>
                  {l.issuing_organization && <span className="text-gray-500"> · {l.issuing_organization}</span>}
                  <span className="ml-2 text-xs text-gray-400">({l.verification_status})</span>
                  <br />
                  {l.document_path_private ? (
                    <a
                      href={getEvidenceFileUrl(l.document_path_private) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      📎 증빙 파일 보기
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">증빙 파일 없음</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">없음</p>
          )}
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">전문분야</h3>
          {specialtyLinks && specialtyLinks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {specialtyLinks.map((s, i) => {
                const name = (s.specialties as unknown as { name: string } | null)?.name;
                return (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {name}
                    {s.is_primary ? ' (주)' : ''}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">없음</p>
          )}
        </section>

        <ReviewActions targetUserId={profile.user_id} />
      </div>
    </main>
  );
}
