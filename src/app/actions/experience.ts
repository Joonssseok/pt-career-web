'use server';

/**
 * M3-A Experience Server Actions
 * Owner CRUD operations on experiences (multiple per user)
 * Date: 2026-07-23
 */

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './profile';

export interface ExperienceData {
  id: string;
  profileId: string;
  companyName: string;
  position: string;
  startDate: string; // YYYY-MM
  endDate: string | null;
  isCurrent: boolean;
  createdAt: string;
}

// ============================================================================
// addExperience() — Add new experience
// ============================================================================

export async function addExperience(input: {
  companyName: string;
  position: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
}): Promise<ActionResult<ExperienceData>> {
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

    // Validate: if isCurrent is true, endDate must be null
    if (input.isCurrent && input.endDate) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'Current position cannot have an end date',
          field: 'endDate',
        },
      };
    }

    const { data, error } = await supabase
      .from('experiences')
      .insert({
        profile_id: profile.id,
        company_name: input.companyName,
        position: input.position,
        start_date: input.startDate,
        end_date: input.endDate || null,
        is_current: input.isCurrent || false,
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
        companyName: data.company_name,
        position: data.position,
        startDate: data.start_date,
        endDate: data.end_date,
        isCurrent: data.is_current,
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    console.error('addExperience error:', error);
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
// updateExperience() — Update existing experience
// ============================================================================

export async function updateExperience(
  id: string,
  input: {
    companyName?: string;
    position?: string;
    startDate?: string;
    endDate?: string | null;
    isCurrent?: boolean;
  }
): Promise<ActionResult<ExperienceData>> {
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
    const { data: experience, error: fetchError } = await supabase
      .from('experiences')
      .select('profile_id')
      .eq('id', id)
      .single();

    if (fetchError || !experience) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Experience not found',
        },
      };
    }

    // Check ownership
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile || experience.profile_id !== profile.id) {
      return {
        ok: false,
        error: {
          code: 'PERMISSION_ERROR',
          message: 'Cannot update other user experience',
        },
      };
    }

    // Build update object
    const updateData: any = {};
    if (input.companyName) updateData.company_name = input.companyName;
    if (input.position) updateData.position = input.position;
    if (input.startDate) updateData.start_date = input.startDate;
    if ('endDate' in input) updateData.end_date = input.endDate || null;
    if ('isCurrent' in input) updateData.is_current = input.isCurrent;

    // Validate
    if (input.isCurrent && input.endDate) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Current position cannot have an end date',
        },
      };
    }

    const { data, error } = await supabase
      .from('experiences')
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
        companyName: data.company_name,
        position: data.position,
        startDate: data.start_date,
        endDate: data.end_date,
        isCurrent: data.is_current,
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    console.error('updateExperience error:', error);
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
// deleteExperience() — Delete experience
// ============================================================================

export async function deleteExperience(
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

    // Verify ownership before delete
    const { data: experience } = await supabase
      .from('experiences')
      .select('profile_id')
      .eq('id', id)
      .single();

    if (!experience) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Experience not found',
        },
      };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile || experience.profile_id !== profile.id) {
      return {
        ok: false,
        error: {
          code: 'PERMISSION_ERROR',
          message: 'Cannot delete other user experience',
        },
      };
    }

    const { error } = await supabase
      .from('experiences')
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
    console.error('deleteExperience error:', error);
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
// getExperiences() — Fetch all user experiences
// ============================================================================

export async function getExperiences(): Promise<
  ActionResult<ExperienceData[]>
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
      .from('experiences')
      .select('*')
      .eq('profile_id', profile.id)
      .order('start_date', { ascending: false });

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
      data: data.map((exp) => ({
        id: exp.id,
        profileId: exp.profile_id,
        companyName: exp.company_name,
        position: exp.position,
        startDate: exp.start_date,
        endDate: exp.end_date,
        isCurrent: exp.is_current,
        createdAt: exp.created_at,
      })),
    };
  } catch (error) {
    console.error('getExperiences error:', error);
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database error',
      },
    };
  }
}
