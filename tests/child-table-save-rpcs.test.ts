/**
 * Child-table save RPCs — real JWT sessions against a live Postgres (local Supabase).
 *
 * Regression cover for the data-loss bug fixed by
 * supabase/migrations/20260730070000_child_table_save_rpcs.sql: saving
 * experiences/educations/licenses on an *approved* profile used to run
 * DELETE and INSERT as two separate requests. The DELETE fired
 * demote_profile_if_approved_trigger (approved -> pending), and the
 * owner_insert RLS policy rejects pending, so the INSERT failed with 42501 —
 * the owner's rows were deleted and nothing replaced them.
 *
 * save_own_experiences/save_own_educations/save_own_licenses run both
 * statements in one SECURITY DEFINER transaction, gated on the status the
 * caller started from. The trigger still demotes approved -> pending.
 *
 * service_role is used ONLY for fixture setup/cleanup — every assertion runs
 * through a client scoped to a real user session.
 *
 * Run: supabase start && supabase db reset && pnpm test -- child-table-save-rpcs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeCleanup } from './helpers/cleanup';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const rand = () => Math.random().toString(36).slice(2, 10);
const OWNER_EMAIL = `owner-save-${rand()}@test.local`;
const PASSWORD = 'Test1234!';

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await tmp.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

describe('Child-table save RPCs', () => {
  let adminApi: SupabaseClient; // service_role — fixture setup/cleanup only
  let ownerClient: SupabaseClient;

  let ownerId: string;
  let ownerProfileId: string;

  const setStatus = async (status: string) => {
    const { error } = await adminApi
      .from('profiles')
      .update({
        verification_status: status,
        is_public: status === 'approved',
      })
      .eq('id', ownerProfileId);
    if (error) throw error;
  };

  const currentStatus = async () => {
    const { data } = await adminApi
      .from('profiles')
      .select('verification_status')
      .eq('id', ownerProfileId)
      .single();
    return data?.verification_status;
  };

  beforeAll(async () => {
    adminApi = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const owner = await adminApi.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    ownerId = owner.data.user!.id;

    ownerClient = await signInClient(OWNER_EMAIL, PASSWORD);

    const { data: profileRow, error: profileErr } = await adminApi
      .from('profiles')
      .insert({ user_id: ownerId, display_name: 'Save RPC Owner', verification_status: 'draft' })
      .select('id')
      .single();
    if (profileErr) throw profileErr;
    ownerProfileId = profileRow!.id;
  });

  afterAll(async () => {
    await safeCleanup([
      () => adminApi.from('profiles').delete().eq('user_id', ownerId),
      () => adminApi.auth.admin.deleteUser(ownerId),
    ]);
  });

  it('saves experiences while draft, converting YYYY-MM-01 dates', async () => {
    await setStatus('draft');

    const { data, error } = await ownerClient.rpc('save_own_experiences', {
      p_experiences: [
        {
          organization_name: 'Draft Gym',
          position: 'Trainer',
          start_date: '2021-03-01',
          end_date: '2023-08-01',
          is_current: false,
        },
      ],
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    const rows = await ownerClient
      .from('experiences')
      .select('organization_name, start_date, end_date, display_order')
      .eq('profile_id', ownerProfileId);
    expect(rows.data?.length).toBe(1);
    expect(rows.data?.[0].start_date).toBe('2021-03-01');
    expect(rows.data?.[0].display_order).toBe(0);
  });

  it('KEEPS the rows when saving experiences on an approved profile, and demotes to pending', async () => {
    await setStatus('approved');

    const { data, error } = await ownerClient.rpc('save_own_experiences', {
      p_experiences: [
        { organization_name: 'Approved Gym A', position: 'Lead', start_date: '2020-01-01', is_current: true },
        { organization_name: 'Approved Gym B', position: 'Coach', start_date: '2018-05-01', is_current: false },
      ],
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    // The pre-fix bug left this at 0 rows: the delete succeeded, the insert was
    // rejected by owner_insert once the trigger had flipped the profile.
    const rows = await adminApi
      .from('experiences')
      .select('organization_name, display_order')
      .eq('profile_id', ownerProfileId)
      .order('display_order');
    expect(rows.data?.length).toBe(2);
    expect(rows.data?.map((r) => r.organization_name)).toEqual(['Approved Gym A', 'Approved Gym B']);

    expect(await currentStatus()).toBe('pending');
  });

  it('refuses to save experiences while pending (already under review)', async () => {
    await setStatus('pending');

    const { data, error } = await ownerClient.rpc('save_own_experiences', {
      p_experiences: [{ organization_name: 'Should Not Land', position: 'X', is_current: false }],
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(false);
    expect(data?.[0]?.error).toMatch(/status does not allow/i);

    // Previous rows untouched — the RPC bails out before deleting anything.
    const rows = await adminApi.from('experiences').select('id').eq('profile_id', ownerProfileId);
    expect(rows.data?.length).toBe(2);
  });

  it('KEEPS the rows when saving educations on an approved profile', async () => {
    await setStatus('approved');

    const { data, error } = await ownerClient.rpc('save_own_educations', {
      p_educations: [
        {
          education_name: 'Rehab Course',
          organization_name: 'Some Institute',
          completion_date: '2020-06-01',
          description: null,
        },
      ],
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    const rows = await adminApi
      .from('educations')
      .select('education_name, completion_date')
      .eq('profile_id', ownerProfileId);
    expect(rows.data?.length).toBe(1);
    expect(rows.data?.[0].completion_date).toBe('2020-06-01');
    expect(await currentStatus()).toBe('pending');
  });

  it('KEEPS the rows when saving licenses on an approved profile', async () => {
    await setStatus('approved');

    const { data, error } = await ownerClient.rpc('save_own_licenses', {
      p_licenses: [
        {
          license_name: 'NASM-CPT',
          category: '민간자격',
          issuing_organization: 'NASM',
          acquired_date: '2019-11-01',
          document_path_private: null,
        },
      ],
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    const rows = await adminApi
      .from('licenses')
      .select('license_name, acquired_date')
      .eq('profile_id', ownerProfileId);
    expect(rows.data?.length).toBe(1);
    expect(rows.data?.[0].acquired_date).toBe('2019-11-01');
    expect(await currentStatus()).toBe('pending');
  });

  it('rejects an evidence path outside the caller own folder', async () => {
    await setStatus('approved');

    const { data, error } = await ownerClient.rpc('save_own_licenses', {
      p_licenses: [
        {
          license_name: 'Forged',
          document_path_private: '00000000-0000-0000-0000-000000000000/secret.pdf',
        },
      ],
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(false);
    expect(data?.[0]?.error).toMatch(/document path/i);

    // Bailed out before deleting — the previous license row is still there.
    const rows = await adminApi.from('licenses').select('license_name').eq('profile_id', ownerProfileId);
    expect(rows.data?.length).toBe(1);
    expect(rows.data?.[0].license_name).toBe('NASM-CPT');
  });

  it('an empty array clears the rows (used when the owner deletes every entry)', async () => {
    await setStatus('approved');

    const { data, error } = await ownerClient.rpc('save_own_experiences', { p_experiences: [] });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    const rows = await adminApi.from('experiences').select('id').eq('profile_id', ownerProfileId);
    expect(rows.data?.length).toBe(0);
  });

  it('does not let one owner write into another profile', async () => {
    await setStatus('draft');

    const otherEmail = `other-save-${rand()}@test.local`;
    const other = await adminApi.auth.admin.createUser({
      email: otherEmail,
      password: PASSWORD,
      email_confirm: true,
    });
    const otherId = other.data.user!.id;
    const otherProfile = await adminApi
      .from('profiles')
      .insert({ user_id: otherId, display_name: 'Other Owner', verification_status: 'draft' })
      .select('id')
      .single();

    // The RPC takes no profile_id — it resolves the caller's own profile — so a
    // hostile payload cannot target someone else's rows.
    const { data, error } = await ownerClient.rpc('save_own_experiences', {
      p_experiences: [{ organization_name: 'Cross-tenant attempt', position: 'X', is_current: false }],
    });
    expect(error).toBeNull();
    expect(data?.[0]?.ok).toBe(true);

    const victimRows = await adminApi
      .from('experiences')
      .select('id')
      .eq('profile_id', otherProfile.data!.id);
    expect(victimRows.data?.length).toBe(0);

    await safeCleanup([
      () => adminApi.from('profiles').delete().eq('user_id', otherId),
      () => adminApi.auth.admin.deleteUser(otherId),
    ]);
  });

  it('refuses an unauthenticated caller', async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await anonClient.rpc('save_own_experiences', { p_experiences: [] });
    // anon has no EXECUTE grant on the function.
    expect(error).not.toBeNull();
  });
});
