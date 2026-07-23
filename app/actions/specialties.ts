'use server';

/**
 * M3-A Specialties Server Actions
 * Owner manages specialties (1-3 atomic replace via RPC)
 * Date: 2026-07-23
 */

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './profile';

export interface SpecialtyData {
  id: string;
  specialtyId: number;
}

export interface SaveSpecialtiesData {
  userId: string;
  specialties: SpecialtyData[];
  count: number;
}

// ============================================================================
// saveSpecialties() — Replace specialties (1-3, atomic)
// Calls replace_profile_specialties RPC
// ============================================================================

export async function saveSpecialties(
  specialtyIds: number[]
): Promise<ActionResult<SaveSpecialtiesData>> {
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

    // Call RPC function (handles validation + atomic transaction)
    const { data, error } = await supabase.rpc(
      'replace_profile_specialties',
      {
        p_specialty_ids: specialtyIds,
      }
    );

    if (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: error.message,
        },
      };
    }

    // Check RPC response
    if (!data || !data.ok) {
      return {
        ok: false,
        error: data?.error || {
          code: 'DB_ERROR',
          message: 'RPC function failed',
        },
      };
    }

    return {
      ok: true,
      data: {
        userId: data.data.userId,
        specialties: data.data.specialties || [],
        count: data.data.count,
      },
    };
  } catch (error) {
    console.error('saveSpecialties error:', error);
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
// getSpecialties() — Fetch user's specialties
// ============================================================================

export async function getSpecialties(): Promise<
  ActionResult<SpecialtyData[]>
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
      .from('profile_specialties')
      .select('id, specialty_id')
      .eq('profile_id', profile.id);

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
      data: data.map((spec) => ({
        id: spec.id,
        specialtyId: spec.specialty_id,
      })),
    };
  } catch (error) {
    console.error('getSpecialties error:', error);
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
// getAllSpecialties() — Fetch master specialty list (reference data)
// ============================================================================

export interface SpecialtyOption {
  id: number;
  name: string;
}

export async function getAllSpecialties(): Promise<
  ActionResult<SpecialtyOption[]>
> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('specialties')
      .select('id, name')
      .order('id', { ascending: true });

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
      data: data.map((spec) => ({
        id: spec.id,
        name: spec.name,
      })),
    };
  } catch (error) {
    console.error('getAllSpecialties error:', error);
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database error',
      },
    };
  }
}
