'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';
import { calculateTotalExperienceYears } from '@/lib/resume/total-experience-years';
import { sortByRecency } from '@/lib/resume/sort-by-recency';

export type ResumeExperience = {
  organizationName: string;
  position: string;
  startDate: string; // 'YYYY-MM'
  endDate: string;
  isCurrently: boolean;
};

export type ResumeAcademicRecord = {
  level: 'graduate' | 'university' | 'high_school' | 'middle_school';
  degree: string;
  schoolName: string;
  major: string;
  startDate: string;
  endDate: string;
};

export type ResumeCertification = {
  name: string;
  category: string;
  issuer: string;
  issueDate: string;
};

export type ResumeEducation = {
  educationName: string;
  organizationName: string;
  completionDate: string;
  startDate: string;
};

export type ResumeData = {
  displayName: string;
  professionNames: string[];
  specialtyNames: string[];
  totalExperienceYears: number;
  workplaceRegion: string;
  phone: string;
  email: string;
  profileImagePath: string;
  experiences: ResumeExperience[];
  academicRecords: ResumeAcademicRecord[];
  certifications: ResumeCertification[];
  educations: ResumeEducation[];
};

// 이력서 내보내기 전용 데이터 조합. 기존 getOwn*() 액션들을 그대로
// 재사용한다 -- 이 함수들은 전부 owner_visible 필터 없이 등록된 데이터를
// 전량 반환하므로(EditForm이 편집 중 자기 데이터를 전부 봐야 하기
// 때문), 공개 프로필의 마스킹과 무관하게 이력서에 전체 정보가 실린다.
// 이건 의도된 동작이다(지시서 4-a): 공개 프로필에는 기간을 숨겼어도
// 본인이 받는 이력서에는 정확한 날짜가 나와야 한다.
export async function getOwnResumeData(): Promise<
  { ok: true; error: ''; data: ResumeData } | { ok: false; error: string; data: null }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Not authenticated', data: null };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: false, error: 'Profile not found', data: null };
  }

  const [
    profileResult,
    experiencesResult,
    academicResult,
    educationsResult,
    certificationsResult,
    workplaceResult,
    professionsResult,
    allProfessionsResult,
    specialtiesIdResult,
    allSpecialtiesResult,
    resumePhoneResult,
  ] = await Promise.all([
    supabase.from('profiles').select('display_name, profile_image_path').eq('id', profileId).maybeSingle(),
    supabase
      .from('experiences')
      .select('organization_name, position, start_date, end_date, is_current')
      .eq('profile_id', profileId),
    supabase
      .from('academic_records')
      .select('level, degree, school_name, major, start_date, end_date')
      .eq('profile_id', profileId),
    supabase
      .from('educations')
      .select('education_name, organization_name, start_date, completion_date')
      .eq('profile_id', profileId),
    supabase
      .from('licenses')
      .select('license_name, category, issuing_organization, acquired_date')
      .eq('profile_id', profileId),
    supabase
      .from('workplaces')
      .select('region')
      .eq('profile_id', profileId)
      .maybeSingle(),
    supabase
      .from('profile_professions')
      .select('profession_id, custom_label, display_order')
      .eq('profile_id', profileId)
      .order('display_order'),
    supabase.from('professions').select('id, name, slug'),
    supabase
      .from('profile_specialties')
      .select('specialty_id, display_order')
      .eq('profile_id', profileId)
      .order('display_order'),
    supabase.from('specialties').select('id, name'),
    supabase.rpc('get_own_resume_phone'),
  ]);

  if (profileResult.error || !profileResult.data) {
    return { ok: false, error: profileResult.error?.message ?? 'Profile not found', data: null };
  }

  const professionNameById = new Map(
    (allProfessionsResult.data ?? []).map((p) => [p.id, { name: p.name, slug: p.slug }])
  );
  const professionNames = (professionsResult.data ?? []).map((pp) => {
    const ref = professionNameById.get(pp.profession_id);
    if (!ref) return pp.custom_label ?? '';
    return ref.slug === 'custom' ? pp.custom_label ?? '' : ref.name;
  });

  const specialtyNameById = new Map((allSpecialtiesResult.data ?? []).map((s) => [s.id, s.name]));
  const specialtyNames = (specialtiesIdResult.data ?? [])
    .map((ps) => specialtyNameById.get(ps.specialty_id))
    .filter((name): name is string => !!name);

  const experiences: ResumeExperience[] = (experiencesResult.data ?? []).map((e) => ({
    organizationName: e.organization_name,
    position: e.position ?? '',
    startDate: e.start_date?.slice(0, 7) ?? '',
    endDate: e.end_date?.slice(0, 7) ?? '',
    isCurrently: e.is_current,
  }));

  const totalExperienceYears = calculateTotalExperienceYears(
    experiences.map((e) => ({ startDate: e.startDate, endDate: e.endDate, isCurrently: e.isCurrently }))
  );

  const academicRecords: ResumeAcademicRecord[] = (academicResult.data ?? []).map((r) => ({
    level: r.level,
    degree: r.degree ?? '',
    schoolName: r.school_name,
    major: r.major ?? '',
    startDate: r.start_date?.slice(0, 7) ?? '',
    endDate: r.end_date?.slice(0, 7) ?? '',
  }));

  const educations: ResumeEducation[] = (educationsResult.data ?? []).map((e) => ({
    educationName: e.education_name,
    organizationName: e.organization_name ?? '',
    completionDate: e.completion_date?.slice(0, 7) ?? '',
    startDate: e.start_date?.slice(0, 7) ?? '',
  }));

  const certifications: ResumeCertification[] = (certificationsResult.data ?? []).map((c) => ({
    name: c.license_name,
    category: c.category ?? '',
    issuer: c.issuing_organization ?? '',
    issueDate: c.acquired_date?.slice(0, 7) ?? '',
  }));

  return {
    ok: true,
    error: '',
    data: {
      displayName: profileResult.data.display_name ?? '',
      professionNames,
      specialtyNames,
      totalExperienceYears,
      workplaceRegion: workplaceResult.data?.region ?? '',
      phone: resumePhoneResult.data ?? '',
      email: user.email ?? '',
      profileImagePath: profileResult.data.profile_image_path ?? '',
      experiences: sortByRecency(experiences),
      academicRecords: sortByRecency(academicRecords),
      certifications: [...certifications].sort((a, b) => (a.issueDate > b.issueDate ? -1 : 1)),
      educations: [...educations].sort((a, b) =>
        (a.completionDate || a.startDate) > (b.completionDate || b.startDate) ? -1 : 1
      ),
    },
  };
}
