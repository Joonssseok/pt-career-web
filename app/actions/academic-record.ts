'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export type AcademicLevel = 'graduate' | 'university' | 'high_school' | 'middle_school';

export async function getOwnAcademicRecords() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', academicRecords: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', academicRecords: [] };
  }

  const { data, error } = await supabase
    .from('academic_records')
    .select('id, level, degree, school_name, major, start_date, end_date, owner_visible')
    .eq('profile_id', profileId)
    .order('display_order');

  if (error) {
    console.error('[getOwnAcademicRecords] Supabase error:', error);
    return { ok: false as const, error: error.message, academicRecords: [] };
  }

  return {
    ok: true as const,
    error: '',
    academicRecords: data.map((r) => ({
      id: r.id,
      level: r.level as AcademicLevel,
      degree: r.degree ?? '',
      schoolName: r.school_name,
      major: r.major ?? '',
      // DB stores a full DATE; the YearMonthSelect UI needs "YYYY-MM".
      startDate: r.start_date?.slice(0, 7) ?? '',
      endDate: r.end_date?.slice(0, 7) ?? '',
      ownerVisible: r.owner_visible,
    })),
  };
}

export async function saveAcademicRecords(data: {
  records: Array<{
    id?: string;
    level: AcademicLevel;
    degree?: string;
    schoolName: string;
    major?: string;
    startDate?: string;
    endDate?: string;
    ownerVisible?: boolean;
  }>;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: 'Not authenticated' };
    }

    // Delete + insert must happen inside one SECURITY DEFINER call: the delete
    // sends an approved profile back to pending, which the owner_insert RLS
    // policy would then reject, leaving the rows deleted and unreplaced.
    // owner_visible must be threaded through (see saveExperience for why).
    const { data: result, error } = await supabase.rpc('save_own_academic_records', {
      p_records: data.records.map((r) => ({
        level: r.level,
        degree: r.degree || null,
        school_name: r.schoolName,
        major: r.major || null,
        // YearMonthSelect gives "YYYY-MM"; the DB column is a full DATE.
        start_date: r.startDate ? `${r.startDate}-01` : null,
        end_date: r.endDate ? `${r.endDate}-01` : null,
        owner_visible: r.ownerVisible ?? true,
      })),
    });

    if (error) {
      console.error('[saveAcademicRecords] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[saveAcademicRecords] threw:', err);
    return { ok: false, error: String(err) };
  }
}

// 항목별 공개/비공개 토글 — "저장" 버튼과 무관하게 즉시 확정된다.
export async function setOwnAcademicRecordVisibility(recordId: string, visible: boolean) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('set_own_academic_record_visibility', {
      p_record_id: recordId,
      p_visible: visible,
    });

    if (error) {
      console.error('[setOwnAcademicRecordVisibility] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[setOwnAcademicRecordVisibility] threw:', err);
    return { ok: false, error: String(err) };
  }
}
