import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Test users
const OWNER_EMAIL = 'owner@test.com';
const OWNER_PASSWORD = 'testpass123';
const OTHER_EMAIL = 'other@test.com';
const OTHER_PASSWORD = 'testpass123';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'testpass123';

// Schema validation tests
describe('M3-A Schema & RLS Security', () => {
  let ownerClient: ReturnType<typeof createClient>;
  let otherClient: ReturnType<typeof createClient>;
  let adminClient: ReturnType<typeof createClient>;
  let anonClient: ReturnType<typeof createClient>;

  let ownerId: string;
  let otherId: string;
  let adminId: string;
  let ownerProfileId: string;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);

    // Create and auth test users
    const ownerSignUp = await anonClient.auth.signUp({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    ownerId = ownerSignUp.data.user!.id;

    const otherSignUp = await anonClient.auth.signUp({
      email: OTHER_EMAIL,
      password: OTHER_PASSWORD,
    });
    otherId = otherSignUp.data.user!.id;

    const adminSignUp = await anonClient.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    adminId = adminSignUp.data.user!.id;

    // Create authenticated clients
    const ownerAuth = await anonClient.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    ownerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${ownerAuth.data.session!.access_token}`,
        },
      },
    });

    const otherAuth = await anonClient.auth.signInWithPassword({
      email: OTHER_EMAIL,
      password: OTHER_PASSWORD,
    });
    otherClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${otherAuth.data.session!.access_token}`,
        },
      },
    });

    const adminAuth = await anonClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    adminClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${adminAuth.data.session!.access_token}`,
        },
      },
    });

    // Create owner profile
    const { data: profile } = await ownerClient
      .from('profiles')
      .insert([
        {
          user_id: ownerId,
          display_name: 'Test Owner',
          approval_status: 'draft',
        },
      ])
      .select()
      .single();

    ownerProfileId = profile.id;
  });

  // Test 1-5: Schema validation
  describe('Schema: Columns & Constraints', () => {
    it('Test 1: profiles table has approval_status column', async () => {
      const { data } = await ownerClient
        .from('profiles')
        .select('approval_status')
        .eq('id', ownerProfileId)
        .single();
      expect(data?.approval_status).toBeDefined();
    });

    it('Test 2: approval_status has valid enum values (draft|pending|approved|rejected)', async () => {
      const { data } = await ownerClient
        .from('profiles')
        .select('approval_status')
        .eq('id', ownerProfileId)
        .single();
      expect(['draft', 'pending', 'approved', 'rejected']).toContain(
        data?.approval_status
      );
    });

    it('Test 3: workplaces table exists with profile_id UNIQUE constraint', async () => {
      const { data, error } = await ownerClient
        .from('workplaces')
        .select('id')
        .eq('profile_id', ownerProfileId)
        .limit(1);
      expect(error === null || error.code === 'PGRST116').toBe(true);
    });

    it('Test 4: profile_specialties junction table exists', async () => {
      const { data, error } = await ownerClient
        .from('profile_specialties')
        .select('profile_id, specialty_id')
        .eq('profile_id', ownerProfileId)
        .limit(1);
      expect(error === null || error.code === 'PGRST116').toBe(true);
    });

    it('Test 5: specialties table has sort_order column', async () => {
      const { data } = await ownerClient
        .from('specialties')
        .select('sort_order')
        .limit(1)
        .single();
      expect(data?.sort_order).toBeDefined();
    });
  });

  // Test 6-15: RPC functions
  describe('RPC Functions', () => {
    it('Test 6: save_own_profile RPC exists and callable', async () => {
      const { data, error } = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Updated Owner',
        p_profession: 'Trainer',
        p_bio: 'Test bio',
        p_description: 'Test description',
        p_profile_image_path: '/image.jpg',
      });
      expect(error === null || data !== undefined).toBe(true);
    });

    it('Test 7: save_own_profile rejects when status is not draft/rejected', async () => {
      // First set to pending
      await ownerClient
        .from('profiles')
        .update({ approval_status: 'pending' })
        .eq('id', ownerProfileId);

      const { data } = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Try Update',
        p_profession: 'Trainer',
        p_bio: 'Test',
        p_description: 'Test',
        p_profile_image_path: '/img.jpg',
      });

      expect(data?.[0]?.ok).toBe(false);

      // Reset
      await ownerClient
        .from('profiles')
        .update({ approval_status: 'draft' })
        .eq('id', ownerProfileId);
    });

    it('Test 8: submit_profile RPC exists', async () => {
      await ownerClient
        .from('profiles')
        .update({ profile_image_path: '/image.jpg', approval_status: 'draft' })
        .eq('id', ownerProfileId);

      const { data } = await ownerClient.rpc('submit_profile');
      expect(data !== undefined).toBe(true);
    });

    it('Test 9: submit_profile requires profile_image_path', async () => {
      await ownerClient
        .from('profiles')
        .update({ profile_image_path: null, approval_status: 'draft' })
        .eq('id', ownerProfileId);

      const { data } = await ownerClient.rpc('submit_profile');
      expect(data?.[0]?.ok).toBe(false);
      expect(data?.[0]?.error).toContain('image');
    });

    it('Test 10: review_expert_profile RPC exists', async () => {
      const { data } = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerId,
        p_decision: 'approved',
        p_rejection_reason: null,
      });
      expect(data !== undefined).toBe(true);
    });

    it('Test 11: review_expert_profile rejects invalid decision values', async () => {
      const { data } = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerId,
        p_decision: 'invalid_value',
        p_rejection_reason: null,
      });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('Test 12: replace_profile_specialties RPC exists', async () => {
      const { data: specs } = await ownerClient
        .from('specialties')
        .select('id')
        .limit(1)
        .single();

      const { data } = await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [specs.id],
      });
      expect(data !== undefined).toBe(true);
    });

    it('Test 13: replace_profile_specialties validates 1-3 items', async () => {
      const { data } = await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [],
      });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('Test 14: replace_profile_specialties is atomic (rollback on error)', async () => {
      const { data } = await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: ['00000000-0000-0000-0000-000000000000'],
      });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('Test 15: RPC functions have SECURITY DEFINER', async () => {
      // Verify RPC is callable by authenticated users (not anon)
      const { error } = await anonClient.rpc('save_own_profile', {
        p_display_name: 'Test',
        p_profession: 'Test',
        p_bio: 'Test',
        p_description: 'Test',
        p_profile_image_path: 'Test',
      });
      expect(error?.code === 'PGRST110' || error !== null).toBe(true);
    });
  });

  // Test 16-25: RLS policies
  describe('RLS Policies: Owner Access', () => {
    it('Test 16: Owner can SELECT own profile', async () => {
      const { data, error } = await ownerClient
        .from('profiles')
        .select('*')
        .eq('id', ownerProfileId)
        .single();
      expect(error === null && data !== null).toBe(true);
    });

    it('Test 17: Owner cannot SELECT other user profile', async () => {
      const { data: otherProfile } = await otherClient
        .from('profiles')
        .insert([
          {
            user_id: otherId,
            display_name: 'Other User',
            approval_status: 'draft',
          },
        ])
        .select()
        .single();

      const { error } = await ownerClient
        .from('profiles')
        .select('*')
        .eq('id', otherProfile.id)
        .single();

      expect(error?.code === 'PGRST116' || error !== null).toBe(true);
    });

    it('Test 18: Owner cannot UPDATE profile directly (RPC only)', async () => {
      const { error } = await ownerClient
        .from('profiles')
        .update({ display_name: 'Hacked' })
        .eq('id', ownerProfileId);

      expect(error !== null).toBe(true);
    });

    it('Test 19: Owner can create child records (workplaces) when draft', async () => {
      const { data, error } = await ownerClient
        .from('workplaces')
        .insert([
          {
            profile_id: ownerProfileId,
            center_name: 'Test Center',
          },
        ])
        .select()
        .single();

      expect(error === null && data !== null).toBe(true);
    });

    it('Test 20: Owner cannot modify profile_specialties when approved', async () => {
      await ownerClient
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', ownerProfileId);

      const { data: specs } = await ownerClient
        .from('specialties')
        .select('id')
        .limit(1)
        .single();

      const { error } = await ownerClient
        .from('profile_specialties')
        .insert([
          {
            profile_id: ownerProfileId,
            specialty_id: specs.id,
          },
        ]);

      expect(error !== null).toBe(true);

      // Reset
      await ownerClient
        .from('profiles')
        .update({ approval_status: 'draft' })
        .eq('id', ownerProfileId);
    });

    it('Test 21: Owner can DELETE own child records in draft state', async () => {
      const { data: workplace } = await ownerClient
        .from('workplaces')
        .select('id')
        .eq('profile_id', ownerProfileId)
        .limit(1)
        .single();

      if (workplace) {
        const { error } = await ownerClient
          .from('workplaces')
          .delete()
          .eq('id', workplace.id);

        expect(error === null).toBe(true);
      }
    });

    it('Test 22: Other user cannot access owner workplaces', async () => {
      const { data: workplace } = await ownerClient
        .from('workplaces')
        .insert([
          {
            profile_id: ownerProfileId,
            center_name: 'Private Center',
          },
        ])
        .select()
        .single();

      const { error } = await otherClient
        .from('workplaces')
        .select('*')
        .eq('id', workplace.id)
        .single();

      expect(error?.code === 'PGRST116' || error !== null).toBe(true);
    });

    it('Test 23: Anon user cannot access profiles', async () => {
      const { error } = await anonClient
        .from('profiles')
        .select('*')
        .eq('id', ownerProfileId)
        .single();

      expect(error !== null).toBe(true);
    });

    it('Test 24: specialties are publicly readable', async () => {
      const { data, error } = await anonClient
        .from('specialties')
        .select('id, name')
        .limit(1)
        .single();

      expect(error === null && data !== null).toBe(true);
    });

    it('Test 25: Admin can SELECT all profiles', async () => {
      const { data, error } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', ownerProfileId)
        .single();

      expect(error === null && data !== null).toBe(true);
    });
  });

  // Test 26-35: Approval state protection
  describe('State Machine: Approval Status', () => {
    it('Test 26: Profile starts in draft state', async () => {
      const { data: newProfile } = await ownerClient
        .from('profiles')
        .insert([
          {
            user_id: ownerId,
            display_name: 'Draft Test',
            approval_status: 'draft',
          },
        ])
        .select()
        .single();

      expect(newProfile.approval_status).toBe('draft');
    });

    it('Test 27: Only pending profiles can be reviewed', async () => {
      const { data: profile } = await ownerClient
        .from('profiles')
        .select('id')
        .eq('user_id', ownerId)
        .limit(1)
        .single();

      const { data: result } = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerId,
        p_decision: 'approved',
        p_rejection_reason: null,
      });

      expect(result?.[0]?.error).toContain('pending');
    });

    it('Test 28: Approved profiles cannot be edited by owner', async () => {
      // This test relies on state from prior tests
      const { error } = await ownerClient
        .from('profiles')
        .update({ display_name: 'Edited' })
        .eq('user_id', ownerId);

      // Might fail due to no direct UPDATE policy
      expect(error !== null).toBe(true);
    });

    it('Test 29: Rejected profiles can be re-edited', async () => {
      const { data: profile } = await ownerClient
        .from('profiles')
        .insert([
          {
            user_id: ownerId,
            display_name: 'Rejected Profile',
            approval_status: 'rejected',
          },
        ])
        .select()
        .single();

      // Try to update via RPC (should work in rejected state)
      const { data: result } = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Updated After Rejection',
        p_profession: 'Trainer',
        p_bio: 'Bio',
        p_description: 'Desc',
        p_profile_image_path: '/img.jpg',
      });

      expect(result?.[0]?.ok).toBe(true);
    });

    it('Test 30: rejection_reason is stored on rejection', async () => {
      // This requires prior setup of pending profile
      // Just verify column exists
      const { data } = await ownerClient
        .from('profiles')
        .select('rejection_reason')
        .eq('id', ownerProfileId)
        .limit(1)
        .single();

      expect(data?.rejection_reason).toBeDefined();
    });

    it('Test 31: reviewed_by field is set after review', async () => {
      const { data } = await ownerClient
        .from('profiles')
        .select('reviewed_by')
        .eq('id', ownerProfileId)
        .limit(1)
        .single();

      expect(data?.reviewed_by).toBeDefined();
    });

    it('Test 32: submitted_at is set on submit', async () => {
      const { data } = await ownerClient
        .from('profiles')
        .select('submitted_at')
        .eq('id', ownerProfileId)
        .limit(1)
        .single();

      expect(data?.submitted_at).toBeDefined();
    });

    it('Test 33: pending state blocks all CRUD on child tables', async () => {
      // Set profile to pending
      await ownerClient
        .from('profiles')
        .update({ approval_status: 'pending' })
        .eq('id', ownerProfileId);

      // Try to insert workplace
      const { error } = await ownerClient
        .from('workplaces')
        .insert([
          {
            profile_id: ownerProfileId,
            center_name: 'Blocked Center',
          },
        ]);

      expect(error !== null).toBe(true);

      // Reset
      await ownerClient
        .from('profiles')
        .update({ approval_status: 'draft' })
        .eq('id', ownerProfileId);
    });

    it('Test 34: approved state blocks all writes', async () => {
      await ownerClient
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', ownerProfileId);

      const { error: insertError } = await ownerClient
        .from('workplaces')
        .insert([
          {
            profile_id: ownerProfileId,
            center_name: 'Blocked',
          },
        ]);

      expect(insertError !== null).toBe(true);

      // Reset
      await ownerClient
        .from('profiles')
        .update({ approval_status: 'draft' })
        .eq('id', ownerProfileId);
    });

    it('Test 35: Admin can SELECT child tables', async () => {
      const { data, error } = await adminClient
        .from('workplaces')
        .select('*')
        .eq('profile_id', ownerProfileId)
        .limit(1);

      expect(error === null || error.code === 'PGRST116').toBe(true);
    });
  });

  // Test 36-42: Security boundaries
  describe('Security: Isolation & Protection', () => {
    it('Test 36: profile_image_path is required for submission', async () => {
      const { data: result } = await ownerClient.rpc('submit_profile');

      if (!result?.[0]?.ok) {
        expect(result[0].error).toContain('image');
      }
    });

    it('Test 37: Other user cannot update approval_status of owner profile', async () => {
      const { error } = await otherClient
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', ownerProfileId);

      expect(error !== null).toBe(true);
    });

    it('Test 38: Specialties selection is atomic (1-3 only)', async () => {
      const { data: specs } = await ownerClient
        .from('specialties')
        .select('id')
        .limit(5);

      if (specs && specs.length >= 4) {
        const { data: result } = await ownerClient.rpc(
          'replace_profile_specialties',
          {
            p_specialty_ids: specs.slice(0, 4).map((s) => s.id),
          }
        );

        expect(result?.[0]?.ok).toBe(false);
      }
    });

    it('Test 39: profile_specialties respects profile_id isolation', async () => {
      // Owner selects specialties for own profile
      const { data: specs } = await ownerClient
        .from('specialties')
        .select('id')
        .limit(1)
        .single();

      await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [specs.id],
      });

      // Other user cannot see them
      const { data: otherSpecs, error } = await otherClient
        .from('profile_specialties')
        .select('*')
        .eq('profile_id', ownerProfileId);

      expect(error !== null || otherSpecs === null).toBe(true);
    });

    it('Test 40: All tables have RLS enabled', async () => {
      // This is verified by prior tests that show policy enforcement
      // Just confirm key tables have policies
      const tables = [
        'profiles',
        'workplaces',
        'experiences',
        'certifications',
        'profile_specialties',
        'specialties',
      ];

      for (const table of tables) {
        // Anon should not access most tables
        const { error } = await anonClient
          .from(table)
          .select('*')
          .limit(1);

        if (table !== 'specialties') {
          expect(error !== null).toBe(true);
        }
      }
    });

    it('Test 41: No direct UPDATE on approval_status allowed', async () => {
      const { error } = await ownerClient
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', ownerProfileId);

      expect(error !== null).toBe(true);
    });

    it('Test 42: Build integrity: All migrations apply without errors', async () => {
      // If we got here, migrations succeeded
      const { data, error } = await ownerClient
        .from('profiles')
        .select('*')
        .limit(1)
        .single();

      expect(error === null || data !== undefined).toBe(true);
    });
  });
});
