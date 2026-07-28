'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnCertifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', certifications: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', certifications: [] };
  }

  const { data, error } = await supabase
    .from('licenses')
    .select('id, license_name, category, issuing_organization, acquired_date, document_path_private')
    .eq('profile_id', profileId)
    .order('created_at');

  if (error) {
    return { ok: false as const, error: error.message, certifications: [] };
  }

  return {
    ok: true as const,
    error: '',
    certifications: data.map((lic) => ({
      id: lic.id,
      name: lic.license_name,
      category: lic.category ?? '',
      issuer: lic.issuing_organization ?? '',
      // DB stores a full DATE; the <input type="month"> UI needs "YYYY-MM".
      issueDate: lic.acquired_date?.slice(0, 7) ?? '',
      documentPath: lic.document_path_private ?? '',
    })),
  };
}

export async function saveCertifications(data: {
  certifications: Array<{
    id?: string;
    certName: string;
    category?: string;
    issuer?: string;
    issueDate?: string;
    documentPath?: string;
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

    const profileId = await getOwnProfileId(supabase, user.id);
    if (!profileId) {
      return { ok: false, error: 'Profile not found' };
    }

    const { error: deleteError } = await supabase
      .from('licenses')
      .delete()
      .eq('profile_id', profileId);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    if (data.certifications.length === 0) {
      return { ok: true, error: '' };
    }

    const { error: insertError } = await supabase.from('licenses').insert(
      data.certifications.map((cert) => ({
        profile_id: profileId,
        license_name: cert.certName,
        category: cert.category || null,
        issuing_organization: cert.issuer || null,
        acquired_date: cert.issueDate || null,
        document_path_private: cert.documentPath || null,
      }))
    );

    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    return { ok: true, error: '' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
