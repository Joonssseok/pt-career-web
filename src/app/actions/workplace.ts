'use server';

/**
 * M3-A Workplace Server Actions
 * Manages single workplace per user
 * Date: 2026-07-23
 */

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './profile';

export interface WorkplaceData {
  id: string;
  profileId: string;
  centerName: string;
  websiteUrl: string | null;
  workplaceRegion: string | null;
  isLocationPublic: boolean;
  contactType: 'personal' | 'official' | null;
  contactValue: string | null;
  updatedAt: string;
}

// ============================================================================
// saveWorkplace() — Save single workplace (UNIQUE per user)
// ============================================================================

export async function saveWorkplace(input: {
  centerName: string;
  websiteUrl?: string;
  workplaceRegion?: string;
  contactType?: 'personal' | 'official';
  contactValue?: string;
}): Promise<ActionResult<WorkplaceData>> {
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

    // Get user's profile ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Profile not found',
        },
      };
    }

    // Check if workplace exists
    const { data: existing } = await supabase
      .from('workplaces')
      .select('id')
      .eq('profile_id', profile.id)
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('workplaces')
        .update({
          center_name: input.centerName,
          website_url: input.websiteUrl || null,
          workplace_region: input.workplaceRegion || null,
          contact_type: input.contactType || null,
          contact_value: input.contactValue || null,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', profile.id)
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
          centerName: data.center_name,
          websiteUrl: data.website_url,
          workplaceRegion: data.workplace_region,
          isLocationPublic: data.is_location_public,
          contactType: data.contact_type,
          contactValue: data.contact_value,
          updatedAt: data.updated_at,
        },
      };
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('workplaces')
        .insert({
          profile_id: profile.id,
          center_name: input.centerName,
          website_url: input.websiteUrl || null,
          workplace_region: input.workplaceRegion || null,
          contact_type: input.contactType || null,
          contact_value: input.contactValue || null,
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('UNIQUE')) {
          return {
            ok: false,
            error: {
              code: 'CONFLICT',
              message: 'Only one workplace per user allowed',
            },
          };
        }

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
          centerName: data.center_name,
          websiteUrl: data.website_url,
          workplaceRegion: data.workplace_region,
          isLocationPublic: data.is_location_public,
          contactType: data.contact_type,
          contactValue: data.contact_value,
          updatedAt: data.updated_at,
        },
      };
    }
  } catch (error) {
    console.error('saveWorkplace error:', error);
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
// getWorkplace() — Fetch user's workplace
// ============================================================================

export async function getWorkplace(): Promise<
  ActionResult<WorkplaceData | null>
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
      .from('workplaces')
      .select('*')
      .eq('profile_id', profile.id)
      .single();

    if (error) {
      // No workplace found is OK
      return {
        ok: true,
        data: null,
      };
    }

    return {
      ok: true,
      data: {
        id: data.id,
        profileId: data.profile_id,
        centerName: data.center_name,
        websiteUrl: data.website_url,
        workplaceRegion: data.workplace_region,
        isLocationPublic: data.is_location_public,
        contactType: data.contact_type,
        contactValue: data.contact_value,
        updatedAt: data.updated_at,
      },
    };
  } catch (error) {
    console.error('getWorkplace error:', error);
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: 'Database error',
      },
    };
  }
}
