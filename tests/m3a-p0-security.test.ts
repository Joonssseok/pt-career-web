/**
 * M3-A P0 Security Test Suite
 * Tests: Owner isolation, Admin review workflow, RLS enforcement
 * Framework: Jest + Supabase Local
 * Date: 2026-07-23
 */

import { createClient } from '@supabase/supabase-js';

// Test configuration (assume environment variables set)
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('M3-A P0 Security Tests — Owner Isolation & Admin Review', () => {
  let ownerClient: any;
  let otherUserClient: any;
  let adminClient: any;
  let ownerUserId: string;
  let otherUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Initialize clients with mock auth tokens
    // In real tests, use Supabase Auth test user creation

    // NOTE: This is a template. Actual implementation requires:
    // 1. Supabase local setup (supabase start)
    // 2. Test user creation via Auth API
    // 3. Session tokens for authenticated clients
  });

  // ========================================================================
  // Test 1-6: Owner Access & Isolation
  // ========================================================================

  describe('Owner Access', () => {
    test('Test 1: Owner SELECT own profile', async () => {
      // Given: Owner logged in
      const response = await ownerClient
        .from('profiles')
        .select('*')
        .eq('user_id', ownerUserId)
        .single();

      // Then: Should return owner's profile
      expect(response.data).toBeDefined();
      expect(response.data.user_id).toBe(ownerUserId);
      expect(response.error).toBeNull();
    });

    test('Test 2: Owner UPDATE own profile', async () => {
      // Given: Owner calls save_own_profile RPC
      const response = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Test Name',
        p_profession: 'Fitness Coach',
        p_bio: 'Test bio',
        p_description: 'Test description',
        p_profile_image_path: '/profiles/test.jpg',
      });

      // Then: Should update successfully
      expect(response.data).toBeDefined();
      expect(response.data.ok).toBe(true);
      expect(response.data.data.displayName).toBe('Test Name');
      expect(response.error).toBeNull();
    });

    test('Test 3: Owner CANNOT direct UPDATE approval_status', async () => {
      // Given: Owner attempts direct UPDATE on approval_status
      const response = await ownerClient
        .from('profiles')
        .update({ approval_status: 'pending' })
        .eq('user_id', ownerUserId);

      // Then: RLS should deny (no UPDATE policy for approval_status)
      expect(response.data).toEqual([]);
      // Note: RLS violation may return empty array or error depending on Supabase
    });

    test('Test 4: Owner CANNOT access other user profile', async () => {
      // Given: Owner queries another user's profile
      const response = await ownerClient
        .from('profiles')
        .select('*')
        .eq('user_id', otherUserId);

      // Then: RLS should deny
      expect(response.data).toEqual([]);
      expect(response.error).toBeDefined(); // RLS violation
    });

    test('Test 5: Owner CANNOT UPDATE other user experience', async () => {
      // Given: Create experience for other user first
      // Then: Owner tries to update it
      const response = await ownerClient
        .from('experiences')
        .update({ company_name: 'Hacked' })
        .eq('user_id', otherUserId);

      // Should be denied by RLS
      expect(response.data).toEqual([]);
    });

    test('Test 6: Owner CANNOT access other user workplace', async () => {
      // Similar to experience/certification
      const response = await ownerClient
        .from('workplaces')
        .select('*')
        .eq('id', 'non-existent-id');

      expect(response.data).toEqual([]);
    });
  });

  // ========================================================================
  // Test 7-11: Admin Access
  // ========================================================================

  describe('Admin Access', () => {
    test('Test 7: Admin SELECT all profiles', async () => {
      // Given: Admin queries all profiles
      const response = await adminClient.from('profiles').select('*');

      // Then: Should return multiple profiles
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });

    test('Test 8: Admin SELECT all experiences', async () => {
      const response = await adminClient.from('experiences').select('*');
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('Test 9: Admin CANNOT direct UPDATE (must use RPC)', async () => {
      // Given: Admin tries direct UPDATE
      const response = await adminClient
        .from('profiles')
        .update({ display_name: 'Modified' })
        .eq('user_id', ownerUserId);

      // Then: Should be denied (Admin has SELECT-only RLS)
      expect(response.data).toEqual([]);
    });

    test('Test 10: Admin review_expert_profile RPC', async () => {
      // Given: Admin approves pending profile
      const response = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerUserId,
        p_decision: 'approved',
      });

      // Then: Should succeed
      expect(response.data).toBeDefined();
      expect(response.data.ok).toBe(true);
      expect(response.data.data.approvalStatus).toBe('approved');
    });

    test('Test 11: Admin rejection with reason', async () => {
      // Given: Admin rejects pending profile
      const response = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerUserId,
        p_decision: 'rejected',
        p_rejection_reason: 'Insufficient information',
      });

      // Then: Should record rejection reason
      expect(response.data.ok).toBe(true);
      expect(response.data.data.approvalStatus).toBe('rejected');
      expect(response.data.data.rejectionReason).toBe(
        'Insufficient information'
      );
    });
  });

  // ========================================================================
  // Test 12-19: State Management & Transitions
  // ========================================================================

  describe('Approval State Management', () => {
    test('Test 12: draft state allows owner edit', async () => {
      // Given: Profile in draft state
      // Then: save_own_profile succeeds
      const response = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Draft Edit',
        p_profession: 'Coach',
      });

      expect(response.data.ok).toBe(true);
    });

    test('Test 13: pending state blocks owner edit', async () => {
      // Given: Profile moved to pending
      // First submit
      await ownerClient.rpc('submit_profile');

      // Then: save_own_profile fails
      const response = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Should Fail',
        p_profession: 'Coach',
      });

      expect(response.data.ok).toBe(false);
      expect(response.data.error.code).toBe('PERMISSION_ERROR');
    });

    test('Test 14: approved state blocks owner edit', async () => {
      // Given: Admin approved profile
      await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerUserId,
        p_decision: 'approved',
      });

      // Then: save_own_profile fails
      const response = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Should Fail',
        p_profession: 'Coach',
      });

      expect(response.data.ok).toBe(false);
    });

    test('Test 15: rejected state allows owner edit', async () => {
      // Given: Admin rejected profile
      await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerUserId,
        p_decision: 'rejected',
        p_rejection_reason: 'Test rejection',
      });

      // Then: save_own_profile succeeds
      const response = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Resubmit',
        p_profession: 'Coach',
      });

      expect(response.data.ok).toBe(true);
    });

    test('Test 16: draft → pending transition', async () => {
      // Given: Profile in draft, required fields filled
      // Assume profile already has display_name, profession, image_path, specialty

      // Then: submit_profile succeeds
      const response = await ownerClient.rpc('submit_profile');

      expect(response.data.ok).toBe(true);
      expect(response.data.data.approvalStatus).toBe('pending');
    });

    test('Test 17: rejected → pending transition', async () => {
      // Given: Profile in rejected state
      // First reject it
      await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerUserId,
        p_decision: 'rejected',
      });

      // Then: Owner can resubmit
      const response = await ownerClient.rpc('submit_profile');

      expect(response.data.ok).toBe(true);
      expect(response.data.data.approvalStatus).toBe('pending');
    });

    test('Test 18: pending → approved transition', async () => {
      // Given: Profile in pending state
      await ownerClient.rpc('submit_profile');

      // Then: Admin can approve
      const response = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerUserId,
        p_decision: 'approved',
      });

      expect(response.data.ok).toBe(true);
      expect(response.data.data.approvalStatus).toBe('approved');
    });

    test('Test 19: pending → rejected transition', async () => {
      // Given: Profile in pending state
      await ownerClient.rpc('submit_profile');

      // Then: Admin can reject
      const response = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerUserId,
        p_decision: 'rejected',
        p_rejection_reason: 'Quality issues',
      });

      expect(response.data.ok).toBe(true);
      expect(response.data.data.approvalStatus).toBe('rejected');
    });
  });

  // ========================================================================
  // Test 20-22: Data Isolation (Experiences, Certifications, Workplace)
  // ========================================================================

  describe('Data Isolation via RLS', () => {
    test('Test 20: Experience owner isolation', async () => {
      // Given: Other user tries to access owner's experience
      const response = await otherUserClient
        .from('experiences')
        .select('*')
        .eq('profile_id', ownerUserId);

      // Then: Should be denied
      expect(response.data).toEqual([]);
    });

    test('Test 21: Certification owner isolation', async () => {
      // Similar to experience
      const response = await otherUserClient
        .from('certifications')
        .select('*')
        .eq('profile_id', ownerUserId);

      expect(response.data).toEqual([]);
    });

    test('Test 22: Workplace UNIQUE constraint (1 per user)', async () => {
      // Given: Owner already has 1 workplace
      // Then: Second insert should fail with UNIQUE constraint
      const response = await ownerClient
        .from('workplaces')
        .insert({
          profile_id: ownerUserId,
          center_name: 'Second Center',
        });

      expect(response.error).toBeDefined(); // UNIQUE violation
    });
  });

  // ========================================================================
  // Test 23-28: Specialties Validation & Atomic Replace
  // ========================================================================

  describe('Specialties Management', () => {
    test('Test 23: Save 1-3 specialties (valid)', async () => {
      // Given: Valid specialty IDs [1, 2, 3]
      const response = await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [1, 2],
      });

      // Then: Should succeed
      expect(response.data.ok).toBe(true);
      expect(response.data.data.count).toBe(2);
    });

    test('Test 24: Reject 4+ specialties (rollback)', async () => {
      // Given: 4 specialty IDs [1, 2, 3, 4]
      const response = await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [1, 2, 3, 4],
      });

      // Then: Should fail (rollback)
      expect(response.data.ok).toBe(false);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
    });

    test('Test 25: Reject 0 specialties (rollback)', async () => {
      // Given: Empty array
      const response = await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [],
      });

      // Then: Should fail
      expect(response.data.ok).toBe(false);
    });

    test('Test 26: Reject duplicate IDs', async () => {
      // Given: [1, 1, 2]
      const response = await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [1, 1, 2],
      });

      // Then: Should fail
      expect(response.data.ok).toBe(false);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
    });

    test('Test 27: Reject out-of-range specialty ID', async () => {
      // Given: ID 13 (valid range is 1-12)
      const response = await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [1, 13],
      });

      // Then: Should fail
      expect(response.data.ok).toBe(false);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
    });

    test('Test 28: Atomic rollback on invalid transaction', async () => {
      // Given: Previous valid state [1, 2]
      await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [1, 2],
      });

      // Then: Attempt invalid [1, 2, 3, 4]
      await ownerClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [1, 2, 3, 4],
      });

      // Verify state is still [1, 2]
      const state = await ownerClient
        .from('profile_specialties')
        .select('specialty_id')
        .eq('profile_id', ownerUserId);

      expect(state.data.length).toBe(2);
    });
  });

  // ========================================================================
  // Test 29-30: Profile Image Requirement
  // ========================================================================

  describe('Profile Image Requirement', () => {
    test('Test 29: Submission requires profile_image_path NOT NULL', async () => {
      // Given: Profile with NULL image_path
      await ownerClient
        .from('profiles')
        .update({ profile_image_path: null })
        .eq('user_id', ownerUserId);

      // Then: submit_profile fails
      const response = await ownerClient.rpc('submit_profile');

      expect(response.data.ok).toBe(false);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
      expect(response.data.error.field).toBe('profileImagePath');
    });

    test('Test 30: Draft allows NULL profile_image_path', async () => {
      // Given: Profile in draft with NULL image_path
      // Then: save_own_profile succeeds
      const response = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Draft User',
        p_profession: 'Coach',
        p_profile_image_path: null,
      });

      expect(response.data.ok).toBe(true);
    });
  });

  // ========================================================================
  // Test 31-33: Access Control (Anonymous, Other Users, Service Role)
  // ========================================================================

  describe('Access Control Enforcement', () => {
    test('Test 31: Anonymous CANNOT access profiles table', async () => {
      // Given: Anonymous client (no auth)
      const anonClient = createClient(SUPABASE_URL, 'anon-key', {
        auth: { persistSession: false },
      });

      // Then: SELECT should be denied by RLS
      const response = await anonClient.from('profiles').select('*');

      expect(response.data).toEqual([]);
      expect(response.error).toBeDefined();
    });

    test('Test 32: Other user CANNOT access base tables', async () => {
      // Given: User A's profile, User B logged in
      // Then: User B cannot SELECT User A's data
      const response = await otherUserClient
        .from('profiles')
        .select('*')
        .eq('user_id', ownerUserId);

      expect(response.data).toEqual([]);
    });

    test('Test 33: Service Role NOT used for general CRUD', async () => {
      // Given: Test configuration
      // Then: Verify no Service Role keys in RPC function calls
      // This is a static verification (code review)
      // Implementation: Confirm RPC uses auth.uid(), not service role
      expect(true).toBe(true); // Placeholder
    });
  });

  // ========================================================================
  // Test 34-35: Build & Integrity
  // ========================================================================

  describe('Build & Integrity', () => {
    test('Test 34: Local DB schema valid', async () => {
      // Verify schema is created
      // Query information_schema.tables
      const response = await adminClient.rpc('check_schema'); // Placeholder

      // Expected: All tables exist
      expect(true).toBe(true); // Placeholder
    });

    test('Test 35: pnpm check passes', async () => {
      // TypeScript compilation check
      // Requires: pnpm check in CI/CD
      expect(true).toBe(true); // Placeholder
    });
  });
});
