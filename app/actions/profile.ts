'use server';

/**
 * M3-A Profile Server Actions
 * Calls RPC functions for owner profile management
 * Date: 2026-07-23
 */

import { createClient } from '@/lib/supabase/server';

// Standard response format
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code:
          | 'VALIDATION_ERROR'
          | 'AUTH_ERROR'
          | 'PERMISSION_ERROR'
          | 'NOT_FOUND'
          | 'CONFLICT'
          | 'DB_ERROR';
        message: string;
        field?: string;
      };
    };

// Profile data type
export interface ProfileData {
  userId: string;
  displayName: string;
  profession: string;
  bio: string | null;
  description: string | null;
  profileImagePath: string | null;
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  updatedAt: string;
}

// ============================================================================
// 1. getOwnProfile() — Fetch owner's complete profile
// ============================================================================

export async function getOwnProfile(): Promise<ActionResult<ProfileData>> {
  try {
    const supabase = await createClient();

    // Get authenticated user
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

    // Query own profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Profile not found',
        },
      };
    }

    return {
      ok: true,
      data: {
        userId: data.user_id,
        displayName: data.display_name,
        profession: data.profession,
        bio: data.bio,
        description: data.description,
        profileImagePath: data.profile_image_path,
        approvalStatus: data.approval_status,
        submittedAt: data.submitted_at,
        reviewedAt: data.reviewed_at,
        rejectionReason: data.rejection_reason,
        updatedAt: data.updated_at,
      },
    };
  } catch (error) {
    console.error('getOwnProfile error:', error);
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
// 2. saveProfile() — Save profile data (calls save_own_profile RPC)
// ============================================================================

export async function saveProfile(input: {
  displayName: string;
  profession: string;
  bio?: string;
  description?: string;
  profileImagePath?: string;
}): Promise<ActionResult<ProfileData>> {
  try {
    const supabase = await createClient();

    // Get authenticated user
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

    // Call RPC function
    const { data, error } = await supabase.rpc('save_own_profile', {
      p_display_name: input.displayName,
      p_profession: input.profession,
      p_bio: input.bio || null,
      p_description: input.description || null,
      p_profile_image_path: input.profileImagePath || null,
    });

    if (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: error.message,
        },
      };
    }

    // Check RPC response format
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
        displayName: data.data.displayName,
        profession: data.data.profession,
        bio: data.data.bio,
        description: data.data.description,
        profileImagePath: data.data.profileImagePath,
        approvalStatus: data.data.approvalStatus,
        submittedAt: data.data.submittedAt,
        reviewedAt: data.data.reviewedAt || null,
        rejectionReason: data.data.rejectionReason || null,
        updatedAt: data.data.updatedAt,
      },
    };
  } catch (error) {
    console.error('saveProfile error:', error);
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
// 3. submitProfile() — Submit profile for admin review
// ============================================================================

export async function submitProfile(): Promise<
  ActionResult<{
    userId: string;
    approvalStatus: 'pending';
    submittedAt: string;
  }>
> {
  try {
    const supabase = await createClient();

    // Get authenticated user
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

    // Call RPC function
    const { data, error } = await supabase.rpc('submit_profile');

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
          message: 'Submit failed',
        },
      };
    }

    return {
      ok: true,
      data: {
        userId: data.data.userId,
        approvalStatus: 'pending',
        submittedAt: data.data.submittedAt,
      },
    };
  } catch (error) {
    console.error('submitProfile error:', error);
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database error',
      },
    };
  }
}
