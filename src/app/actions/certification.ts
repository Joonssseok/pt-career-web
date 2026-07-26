'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveCertifications(data: {
  certifications: Array<{
    id?: string;
    certName: string;
    issuer?: string;
    issueDate?: string;
  }>;
}) {
  try {
    const { data: profile } = await supabase.auth.getUser();
    if (!profile.user) {
      return { ok: false, error: 'Not authenticated' };
    }

    // Delete all existing certifications
    const { error: deleteError } = await supabase
      .from('certifications')
      .delete()
      .eq('profile_id', profile.user.id);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    // Insert new certifications
    const { error: insertError } = await supabase
      .from('certifications')
      .insert(
        data.certifications.map((cert) => ({
          profile_id: profile.user!.id,
          cert_name: cert.certName,
          issuer: cert.issuer || null,
          issue_date: cert.issueDate || null,
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
