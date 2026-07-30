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
    .select('id, license_name, category, issuing_organization, acquired_date, document_path_private, verification_status')
    .eq('profile_id', profileId)
    .order('created_at');

  if (error) {
    console.error('[getOwnCertifications] Supabase error:', error);
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
      verificationStatus: lic.verification_status,
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

    // Delete + insert must happen inside one SECURITY DEFINER call: the delete
    // sends an approved profile back to pending, which the owner_insert RLS
    // policy would then reject, leaving the rows deleted and unreplaced.
    const { data: result, error } = await supabase.rpc('save_own_licenses', {
      p_licenses: data.certifications.map((cert) => ({
        license_name: cert.certName,
        category: cert.category || null,
        issuing_organization: cert.issuer || null,
        // <input type="month"> gives "YYYY-MM"; the DB column is a full DATE.
        acquired_date: cert.issueDate ? `${cert.issueDate}-01` : null,
        document_path_private: cert.documentPath || null,
      })),
    });

    if (error) {
      console.error('[saveCertifications] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[saveCertifications] threw:', err);
    return { ok: false, error: String(err) };
  }
}
