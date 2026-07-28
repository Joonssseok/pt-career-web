/**
 * M3-A Child State Gate — real JWT sessions against a live Postgres (local Supabase).
 *
 * Covers the RLS gap closed by supabase/migrations/20260727000100_m3a_child_state_gate.sql:
 * owners of `experiences` (and, identically, workplaces/educations/profile_specialties)
 * rows may only INSERT/UPDATE/DELETE while their parent profile is 'draft' or 'rejected'.
 *
 * service_role is used ONLY for fixture setup/cleanup (creating users, flipping
 * profiles.verification_status to simulate a review-flow state, deleting test auth
 * users afterAll) — every assertion runs through a client scoped to a real user
 * session, exactly as production traffic would.
 *
 * Run: supabase start && supabase db reset && pnpm test -- m3a-child-state-gate
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeCleanup } from './helpers/cleanup';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const rand = () => Math.random().toString(36).slice(2, 10);
const OWNER_EMAIL = `owner-csg-${rand()}@test.local`;
const ADMIN_EMAIL = `admin-csg-${rand()}@test.local`;
const PASSWORD = 'Test1234!';

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await tmp.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

describe('M3-A Child State Gate (experiences)', () => {
  let adminApi: SupabaseClient; // service_role — fixture setup/cleanup only
  let ownerClient: SupabaseClient;
  let adminClient: SupabaseClient;

  let ownerId: string;
  let adminId: string;
  let ownerProfileId: string;

  beforeAll(async () => {
    adminApi = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const owner = await adminApi.auth.admin.createUser({ email: OWNER_EMAIL, password: PASSWORD, email_confirm: true });
    const admin = await adminApi.auth.admin.createUser({ email: ADMIN_EMAIL, password: PASSWORD, email_confirm: true });
    ownerId = owner.data.user!.id;
    adminId = admin.data.user!.id;

    // Fixture-only: grant admin role directly (no self-service path exists for this).
    const { error: adminGrantError } = await adminApi
      .from('admin_users')
      .insert({ user_id: adminId, role: 'moderator' });
    if (adminGrantError) throw adminGrantError;

    ownerClient = await signInClient(OWNER_EMAIL, PASSWORD);
    adminClient = await signInClient(ADMIN_EMAIL, PASSWORD);

    // Fixture-only: create the owner's profile via service_role to control the
    // starting verification_status directly rather than going through the RPCs.
    const { data: profileRow, error: profileErr } = await adminApi
      .from('profiles')
      .insert({ user_id: ownerId, display_name: 'CSG Owner', verification_status: 'draft' })
      .select('id')
      .single();
    if (profileErr) throw profileErr;
    ownerProfileId = profileRow!.id;
  });

  afterAll(async () => {
    await safeCleanup([
      () => adminApi.from('profiles').delete().in('user_id', [ownerId, adminId]),
      () => adminApi.from('admin_users').delete().eq('user_id', adminId),
      () => adminApi.auth.admin.deleteUser(ownerId),
      () => adminApi.auth.admin.deleteUser(adminId),
    ]);
  });

  it('owner CAN insert an experience row while their profile is draft', async () => {
    const { data, error } = await ownerClient
      .from('experiences')
      .insert({ profile_id: ownerProfileId, organization_name: 'Draft Gym' })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it('owner CAN update and delete that experience row while still draft', async () => {
    const inserted = await ownerClient
      .from('experiences')
      .insert({ profile_id: ownerProfileId, organization_name: 'Draft Gym 2' })
      .select('id')
      .single();
    expect(inserted.error).toBeNull();
    const rowId = inserted.data!.id;

    const updated = await ownerClient
      .from('experiences')
      .update({ organization_name: 'Draft Gym 2 Updated' })
      .eq('id', rowId)
      .select('organization_name')
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data?.organization_name).toBe('Draft Gym 2 Updated');

    const deleted = await ownerClient.from('experiences').delete().eq('id', rowId).select('id');
    expect(deleted.error).toBeNull();
    expect(deleted.data?.length).toBe(1);
  });

  it('owner CANNOT insert a new experience row while their profile is pending', async () => {
    // Fixture-only: flip status via service_role to simulate the post-submit state.
    const flip = await adminApi
      .from('profiles')
      .update({ verification_status: 'pending' })
      .eq('id', ownerProfileId);
    expect(flip.error).toBeNull();

    const { data, error } = await ownerClient
      .from('experiences')
      .insert({ profile_id: ownerProfileId, organization_name: 'Pending Gym' })
      .select('id');
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('owner CANNOT update or delete an existing experience row while their profile is approved', async () => {
    // Bring the profile back to draft to legitimately create the row via ownerClient,
    // then flip to approved (service_role fixture only) before attempting mutation.
    await adminApi.from('profiles').update({ verification_status: 'draft' }).eq('id', ownerProfileId);

    const inserted = await ownerClient
      .from('experiences')
      .insert({ profile_id: ownerProfileId, organization_name: 'Soon Approved Gym' })
      .select('id')
      .single();
    expect(inserted.error).toBeNull();
    const rowId = inserted.data!.id;

    const flip = await adminApi
      .from('profiles')
      .update({ verification_status: 'approved' })
      .eq('id', ownerProfileId);
    expect(flip.error).toBeNull();

    const updateAttempt = await ownerClient
      .from('experiences')
      .update({ organization_name: 'Should Not Update' })
      .eq('id', rowId)
      .select('id');
    expect(updateAttempt.error).toBeNull(); // RLS silently matches zero rows, not an error
    expect(updateAttempt.data).toEqual([]);

    // Confirm via service_role that the row was in fact untouched.
    const { data: unchanged } = await adminApi
      .from('experiences')
      .select('organization_name')
      .eq('id', rowId)
      .single();
    expect(unchanged?.organization_name).toBe('Soon Approved Gym');

    const deleteAttempt = await ownerClient.from('experiences').delete().eq('id', rowId).select('id');
    expect(deleteAttempt.error).toBeNull();
    expect(deleteAttempt.data).toEqual([]);

    const { data: stillThere } = await adminApi
      .from('experiences')
      .select('id')
      .eq('id', rowId);
    expect(stillThere?.length).toBe(1);
  });

  it('admin can SELECT and manage experience rows regardless of profile status (via admin_all, not an RPC)', async () => {
    // ownerProfileId is 'approved' at this point (set in the previous test).
    const { data: seen, error: selectErr } = await adminClient
      .from('experiences')
      .select('id')
      .eq('profile_id', ownerProfileId);
    expect(selectErr).toBeNull();
    expect(Array.isArray(seen)).toBe(true);

    const inserted = await adminClient
      .from('experiences')
      .insert({ profile_id: ownerProfileId, organization_name: 'Admin Inserted' })
      .select('id')
      .single();
    expect(inserted.error).toBeNull();

    const updated = await adminClient
      .from('experiences')
      .update({ organization_name: 'Admin Updated' })
      .eq('id', inserted.data!.id)
      .select('organization_name')
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data?.organization_name).toBe('Admin Updated');

    const deleted = await adminClient
      .from('experiences')
      .delete()
      .eq('id', inserted.data!.id)
      .select('id');
    expect(deleted.error).toBeNull();
    expect(deleted.data?.length).toBe(1);
  });
});
