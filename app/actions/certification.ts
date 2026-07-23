'use server';

/**
 * M3-A Certification Server Actions
 * Owner CRUD operations on certifications (multiple per user)
 * Date: 2026-07-23
 */

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './profile';

export interface CertificationData {
  id: string;
  profileId: string;
  name: string;
  issuer: string;
  issueDate: string | null;
  createdAt: string;
}

// ============================================================================
// addCertification() — Add new certification
// ============================================================================

export async function addCertification(input: {
  name: string;
  issuer: string;
  issueDate?: string;
}): Promise<ActionResult<CertificationData>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        ok: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Not authenticated',
        },
      };
    }

    // Get profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Profile not found',
        },
      };
    }

    const { data, error } = await supabase
      .from('certifications')
      .insert({
        profile_id: profile.id,
        name: input.name,
        issuer: input.issuer,
        issue_date: input.issueDate || null,
      })
      .select()
      .single();

    if (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: error.message,
        },
      };
    }

    return {
      ok: true,
      data: {
        id: data.id,
        profileId: data.profile_id,
        name: data.name,
        issuer: data.issuer,
        issueDate: data.issue_date,
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    console.error('addCertification error:', error);
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database error',
      },
    };
  }
}

// ============================================================================
// updateCertification() — Update existing certification
// ============================================================================

export async function updateCertification(
  id: string,
  input: {
    name?: string;
    issuer?: string;
    issueDate?: string | null;
  }
): Promise<ActionResult<CertificationData>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        ok: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Not authenticated',
        },
      };
    }

    // Verify ownership
    const { data: certification } = await supabase
      .from('certifications')
      .select('profile_id')
      .eq('id', id)
      .single();

    if (!certification) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Certification not found',
        },
      };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile || certification.profile_id !== profile.id) {
      return {
        ok: false,
        error: {
          code: 'PERMISSION_ERROR',
          message: 'Cannot update other user certification',
        },
      };
    }

    const updateData: any = {};
    if (input.name) updateData.name = input.name;
    if (input.issuer) updateData.issuer = input.issuer;
    if ('issueDate' in input) updateData.issue_date = input.issueDate || null;

    const { data, error } = await supabase
      .from('certifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: error.message,
        },
      };
    }

    return {
      ok: true,
      data: {
        id: data.id,
        profileId: data.profile_id,
        name: data.name,
        issuer: data.issuer,
        issueDate: data.issue_date,
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    console.error('updateCertification error:', error);
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database error',
      },
    };
  }
}

// ============================================================================
// deleteCertification() — Delete certification
// ============================================================================

export async function deleteCertification(
  id: string
): Promise<ActionResult<{ deletedId: string }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        ok: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Not authenticated',
        },
      };
    }

    // Verify ownership
    const { data: certification } = await supabase
      .from('certifications')
      .select('profile_id')
      .eq('id', id)
      .single();

    if (!certification) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Certification not found',
        },
      };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile || certification.profile_id !== profile.id) {
      return {
        ok: false,
        error: {
          code: 'PERMISSION_ERROR',
          message: 'Cannot delete other user certification',
        },
      };
    }

    const { error } = await supabase
      .from('certifications')
      .delete()
      .eq('id', id);

    if (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: error.message,
        },
      };
    }

    return {
      ok: true,
      data: { deletedId: id },
    };
  } catch (error) {
    console.error('deleteCertification error:', error);
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database error',
      },
    };
  }
}

// ============================================================================
// getCertifications() — Fetch all user certifications
// ============================================================================

export async function getCertifications(): Promise<
  ActionResult<CertificationData[]>
> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        ok: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Not authenticated',
        },
      };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Profile not found',
        },
      };
    }

    const { data, error } = await supabase
      .from('certifications')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: error.message,
        },
      };
    }

    return {
      ok: true,
      data: data.map((cert) => ({
        id: cert.id,
        profileId: cert.profile_id,
        name: cert.name,
        issuer: cert.issuer,
        issueDate: cert.issue_date,
        createdAt: cert.created_at,
      })),
    };
  } catch (error) {
    console.error('getCertifications error:', error);
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database error',
      },
    };
  }
}
