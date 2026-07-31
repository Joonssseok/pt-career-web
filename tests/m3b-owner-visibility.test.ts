/**
 * Owner-visibility toggle (Part B) — real JWT sessions against a live
 * Postgres (local Supabase).
 *
 * Covers the scenarios the directive explicitly required to be measured
 * against a real account, not just asserted from reading the SQL:
 *   - toggling owner_visible on a child row does NOT trigger
 *     demote_profile_if_approved (verification_status/is_public untouched).
 *   - the public view hides only the toggled-off item, not the whole profile.
 *   - the 3-6 trap: a full save_own_experiences resubmit (delete+insert,
 *     fresh ids) that explicitly carries owner_visible for every item
 *     preserves a previously-set false, exactly as the UI components do.
 *   - master toggle off hides the entire profile from the public view
 *     regardless of item-level values; master back on restores the same
 *     item-level visibility that was set before, with the profile's
 *     verification_status/is_public never touched by any of this.
 *   - anon AND an authenticated non-owner are both blocked from reading a
 *     hidden row directly off the base table (not just via the view).
 *
 * service_role is used ONLY for fixture setup/cleanup and to inspect
 * ground-truth profiles.verification_status — every visibility assertion
 * runs through a client scoped to a real user session (or anon).
 *
 * Run: supabase start && supabase db reset && pnpm test -- m3b-owner-visibility
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeCleanup } from './helpers/cleanup';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const rand = () => Math.random().toString(36).slice(2, 10);
const OWNER_EMAIL = `owner-vis-${rand()}@test.local`;
const OTHER_EMAIL = `other-vis-${rand()}@test.local`;
const PASSWORD = 'Test1234!';

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await tmp.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

describe('Owner visibility toggle (Part B)', () => {
  let adminApi: SupabaseClient; // service_role — fixture setup/cleanup + ground-truth checks only
  let anonClient: SupabaseClient;
  let ownerClient: SupabaseClient;
  let otherClient: SupabaseClient;

  let ownerId: string;
  let otherId: string;
  let ownerProfileId: string;
  let expAId: string;
  let expBId: string;

  const approveProfile = async () => {
    const { error } = await adminApi
      .from('profiles')
      .update({ verification_status: 'approved', is_public: true, owner_visible: true })
      .eq('id', ownerProfileId);
    if (error) throw error;
  };

  const profileGroundTruth = async () => {
    const { data } = await adminApi
      .from('profiles')
      .select('verification_status, is_public')
      .eq('id', ownerProfileId)
      .single();
    return data as { verification_status: string; is_public: boolean };
  };

  beforeAll(async () => {
    adminApi = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    anonClient = createClient(SUPABASE_URL, ANON_KEY);

    const owner = await adminApi.auth.admin.createUser({ email: OWNER_EMAIL, password: PASSWORD, email_confirm: true });
    const other = await adminApi.auth.admin.createUser({ email: OTHER_EMAIL, password: PASSWORD, email_confirm: true });
    ownerId = owner.data.user!.id;
    otherId = other.data.user!.id;

    ownerClient = await signInClient(OWNER_EMAIL, PASSWORD);
    otherClient = await signInClient(OTHER_EMAIL, PASSWORD);

    const { data: profileRow, error: profileErr } = await adminApi
      .from('profiles')
      .insert({
        user_id: ownerId,
        display_name: 'Visibility Owner',
        verification_status: 'approved',
        is_public: true,
      })
      .select('id')
      .single();
    if (profileErr) throw profileErr;
    ownerProfileId = profileRow!.id;

    // Inserted directly as service_role (auth.uid() IS NULL inside the trigger),
    // so demote_profile_if_approved does not fire for this fixture setup.
    const { data: exps, error: expErr } = await adminApi
      .from('experiences')
      .insert([
        { profile_id: ownerProfileId, organization_name: 'Gym A', position: 'Trainer', is_current: true, display_order: 0 },
        { profile_id: ownerProfileId, organization_name: 'Gym B', position: 'Coach', is_current: false, display_order: 1 },
      ])
      .select('id, organization_name');
    if (expErr) throw expErr;
    expAId = exps!.find((e) => e.organization_name === 'Gym A')!.id;
    expBId = exps!.find((e) => e.organization_name === 'Gym B')!.id;
  });

  afterAll(async () => {
    await safeCleanup([
      () => adminApi.from('profiles').delete().in('user_id', [ownerId, otherId]),
      () => adminApi.auth.admin.deleteUser(ownerId),
      () => adminApi.auth.admin.deleteUser(otherId),
    ]);
  });

  it('toggling one item off does not demote the approved profile, and hides only that item from the public view', async () => {
    const before = await profileGroundTruth();
    expect(before).toEqual({ verification_status: 'approved', is_public: true });

    const { data, error } = await ownerClient.rpc('set_own_experience_visibility', {
      p_experience_id: expBId,
      p_visible: false,
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    // Ground truth: admin approval state is untouched by the toggle.
    const after = await profileGroundTruth();
    expect(after).toEqual({ verification_status: 'approved', is_public: true });

    // Public view: only the still-visible item shows up.
    const { data: detail, error: detailErr } = await anonClient
      .from('public_expert_detail')
      .select('experiences')
      .eq('id', ownerProfileId)
      .single();
    expect(detailErr).toBeNull();
    const orgs = (detail!.experiences as Array<{ organization_name: string }>).map((e) => e.organization_name);
    expect(orgs).toEqual(['Gym A']);
  });

  it('3-6 trap: a full resave that carries owner_visible for every item preserves the earlier false (ids churn, value must not)', async () => {
    // Mirrors ExperienceSection.handleSubmit's payload shape exactly: every
    // item in local state carries its own ownerVisible, including the one
    // just toggled off above (Gym B: false) and the one being edited now
    // (Gym A: still true, but with an edited position).
    const { data, error } = await ownerClient.rpc('save_own_experiences', {
      p_experiences: [
        { organization_name: 'Gym A', position: 'Lead Trainer', is_current: true, owner_visible: true },
        { organization_name: 'Gym B', position: 'Coach', is_current: false, owner_visible: false },
      ],
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    const rows = await adminApi
      .from('experiences')
      .select('organization_name, position, owner_visible')
      .eq('profile_id', ownerProfileId)
      .order('display_order');
    expect(rows.data).toEqual([
      { organization_name: 'Gym A', position: 'Lead Trainer', owner_visible: true },
      { organization_name: 'Gym B', position: 'Coach', owner_visible: false },
    ]);

    // Profile review has been removed entirely: no trigger demotes an
    // approved profile back to pending anymore, regardless of how child
    // rows are saved (delete+insert or owner_visible-only update).
    expect((await profileGroundTruth()).verification_status).toBe('approved');
    await approveProfile();

    // Refresh ids for the anon/non-owner blocking test below (they churned).
    const fresh = await adminApi
      .from('experiences')
      .select('id, organization_name')
      .eq('profile_id', ownerProfileId);
    expAId = fresh.data!.find((e) => e.organization_name === 'Gym A')!.id;
    expBId = fresh.data!.find((e) => e.organization_name === 'Gym B')!.id;
  });

  it('master toggle off hides the entire profile regardless of item-level values, without touching admin approval', async () => {
    const { data, error } = await ownerClient.rpc('set_own_profile_visibility', { p_visible: false });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    expect(await profileGroundTruth()).toEqual({ verification_status: 'approved', is_public: true });

    const { data: detail, error: detailErr } = await anonClient
      .from('public_expert_detail')
      .select('id')
      .eq('id', ownerProfileId);
    expect(detailErr).toBeNull();
    expect(detail).toEqual([]);

    const { data: list } = await anonClient
      .from('public_expert_list')
      .select('id')
      .eq('id', ownerProfileId);
    expect(list).toEqual([]);
  });

  it('master toggle back on restores exactly the item-level visibility set before, unchanged', async () => {
    const { data, error } = await ownerClient.rpc('set_own_profile_visibility', { p_visible: true });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    const { data: detail, error: detailErr } = await anonClient
      .from('public_expert_detail')
      .select('experiences')
      .eq('id', ownerProfileId)
      .single();
    expect(detailErr).toBeNull();
    const orgs = (detail!.experiences as Array<{ organization_name: string }>).map((e) => e.organization_name);
    // Still only Gym A -- Gym B's owner_visible=false from the 3-6 test above
    // survived the master toggle round-trip untouched.
    expect(orgs).toEqual(['Gym A']);
  });

  it('anon and an authenticated non-owner are both blocked from reading the hidden item directly off the base table', async () => {
    // anon has no table-level GRANT on experiences at all (M4: anon reads
    // public data only through the views) -- this is a stronger block than
    // RLS row-filtering, so it surfaces as a permission-denied error rather
    // than an empty result set.
    const { data: anonRow, error: anonErr } = await anonClient
      .from('experiences')
      .select('id')
      .eq('id', expBId);
    expect(anonErr?.code).toBe('42501');
    expect(anonRow).toBeNull();

    // authenticated DOES have table-level SELECT (owners need to read their
    // own rows directly), so the block here comes from RLS row-filtering:
    // auth_select_public requires owner_visible = true.
    const { data: otherRow, error: otherErr } = await otherClient
      .from('experiences')
      .select('id')
      .eq('id', expBId);
    expect(otherErr).toBeNull();
    expect(otherRow).toEqual([]);

    // Sanity: the still-visible item IS readable by the non-owner, proving
    // the empty result above is the RLS filter doing its job, not a broken query.
    const { data: otherVisible } = await otherClient.from('experiences').select('id').eq('id', expAId);
    expect(otherVisible).toEqual([{ id: expAId }]);
  });
});
