/**
 * M3-A workplace visibility (AD-05B) — real JWT sessions against a live Postgres (local Supabase).
 *
 * service_role is used ONLY for fixture setup/cleanup (creating the owner profile row,
 * deleting test auth users afterAll) — every assertion below runs through a client
 * scoped to a real user session, exactly as production traffic would.
 *
 * Covers: supabase/migrations/20260727000000_m3a_workplace_visibility.sql
 * (is_location_public column, default false, owner can set it true via direct write).
 *
 * Run: supabase start && supabase db reset && pnpm test -- m3a-workplace-visibility
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeCleanup } from './helpers/cleanup';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const rand = () => Math.random().toString(36).slice(2, 10);
const OWNER_EMAIL = `wp-owner-${rand()}@test.local`;
const PASSWORD = 'Test1234!';

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await tmp.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

describe('M3-A Workplace Visibility (AD-05B)', () => {
  let adminApi: SupabaseClient; // service_role — fixture setup/cleanup only
  let ownerClient: SupabaseClient;

  let ownerId: string;
  let ownerProfileId: string;

  beforeAll(async () => {
    adminApi = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const owner = await adminApi.auth.admin.createUser({ email: OWNER_EMAIL, password: PASSWORD, email_confirm: true });
    ownerId = owner.data.user!.id;

    ownerClient = await signInClient(OWNER_EMAIL, PASSWORD);

    const { data: profileRow, error: profileErr } = await ownerClient
      .from('profiles')
      .insert({ user_id: ownerId, display_name: 'Workplace Visibility Owner' })
      .select('id')
      .single();
    if (profileErr) throw profileErr;
    ownerProfileId = profileRow!.id;
  });

  afterAll(async () => {
    await safeCleanup([
      () => adminApi.from('profiles').delete().eq('id', ownerProfileId),
      () => adminApi.auth.admin.deleteUser(ownerId),
    ]);
  });

  afterEach(async () => {
    // Keep each case isolated: remove the single workplace row (one-per-profile constraint).
    await adminApi.from('workplaces').delete().eq('profile_id', ownerProfileId);
  });

  it('defaults is_location_public to false when omitted on insert', async () => {
    const { error } = await ownerClient
      .from('workplaces')
      .insert({ profile_id: ownerProfileId, center_name: 'Center Default' });
    expect(error).toBeNull();

    const { data, error: selErr } = await adminApi
      .from('workplaces')
      .select('is_location_public')
      .eq('profile_id', ownerProfileId)
      .single();
    expect(selErr).toBeNull();
    expect(data?.is_location_public).toBe(false);
  });

  it('persists is_location_public: true when the owner opts in', async () => {
    const { error } = await ownerClient
      .from('workplaces')
      .insert({ profile_id: ownerProfileId, center_name: 'Center Public', is_location_public: true });
    expect(error).toBeNull();

    const { data, error: selErr } = await adminApi
      .from('workplaces')
      .select('is_location_public')
      .eq('profile_id', ownerProfileId)
      .single();
    expect(selErr).toBeNull();
    expect(data?.is_location_public).toBe(true);
  });

  it('upsert on conflict updates is_location_public from false to true', async () => {
    const first = await ownerClient
      .from('workplaces')
      .upsert(
        { profile_id: ownerProfileId, center_name: 'Center Toggle', is_location_public: false },
        { onConflict: 'profile_id' }
      );
    expect(first.error).toBeNull();

    const second = await ownerClient
      .from('workplaces')
      .upsert(
        { profile_id: ownerProfileId, center_name: 'Center Toggle', is_location_public: true },
        { onConflict: 'profile_id' }
      );
    expect(second.error).toBeNull();

    const { data, error: selErr } = await adminApi
      .from('workplaces')
      .select('is_location_public')
      .eq('profile_id', ownerProfileId)
      .single();
    expect(selErr).toBeNull();
    expect(data?.is_location_public).toBe(true);
  });
});
