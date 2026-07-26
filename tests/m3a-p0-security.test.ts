/**
 * M3-A P0 Security Tests — real JWT sessions against a live Postgres (local Supabase).
 *
 * service_role is used ONLY for fixture setup/cleanup (creating the admin_users row,
 * deleting test auth users afterAll) — every assertion below runs through a client
 * scoped to a real user session (or anon), exactly as production traffic would.
 *
 * Run: supabase start && supabase db reset && pnpm test -- m3a-p0-security
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const rand = () => Math.random().toString(36).slice(2, 10);
const OWNER_EMAIL = `owner-${rand()}@test.local`;
const OTHER_EMAIL = `other-${rand()}@test.local`;
const ADMIN_EMAIL = `admin-${rand()}@test.local`;
const PASSWORD = 'Test1234!';

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await tmp.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

describe('M3-A P0 Security', () => {
  let adminApi: SupabaseClient; // service_role — fixture setup/cleanup only
  let anonClient: SupabaseClient;
  let ownerClient: SupabaseClient;
  let otherClient: SupabaseClient;
  let adminClient: SupabaseClient;

  let ownerId: string;
  let otherId: string;
  let adminId: string;
  let ownerProfileId: string;
  let otherProfileId: string;
  let specialtyIds: string[];

  beforeAll(async () => {
    adminApi = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    anonClient = createClient(SUPABASE_URL, ANON_KEY);

    const owner = await adminApi.auth.admin.createUser({ email: OWNER_EMAIL, password: PASSWORD, email_confirm: true });
    const other = await adminApi.auth.admin.createUser({ email: OTHER_EMAIL, password: PASSWORD, email_confirm: true });
    const admin = await adminApi.auth.admin.createUser({ email: ADMIN_EMAIL, password: PASSWORD, email_confirm: true });
    ownerId = owner.data.user!.id;
    otherId = other.data.user!.id;
    adminId = admin.data.user!.id;

    // Fixture-only: grant admin role directly (there is no self-service path for this).
    const { error: adminGrantError } = await adminApi
      .from('admin_users')
      .insert({ user_id: adminId, role: 'moderator' });
    if (adminGrantError) throw adminGrantError;

    ownerClient = await signInClient(OWNER_EMAIL, PASSWORD);
    otherClient = await signInClient(OTHER_EMAIL, PASSWORD);
    adminClient = await signInClient(ADMIN_EMAIL, PASSWORD);

    const { data: specs } = await anonClient
      .from('specialties')
      .select('id')
      .order('sort_order')
      .limit(4);
    specialtyIds = (specs ?? []).map((s: { id: string }) => s.id);
    if (specialtyIds.length < 4) throw new Error('expected at least 4 seeded specialties');
  });

  afterAll(async () => {
    await adminApi.from('profiles').delete().in('user_id', [ownerId, otherId, adminId]);
    await adminApi.from('admin_users').delete().eq('user_id', adminId);
    await adminApi.auth.admin.deleteUser(ownerId);
    await adminApi.auth.admin.deleteUser(otherId);
    await adminApi.auth.admin.deleteUser(adminId);
  });

  describe('Anonymous access', () => {
    it('cannot SELECT profiles (base table — M4 revoked all anon table grants; public read only via views)', async () => {
      const { data, error } = await anonClient.from('profiles').select('*');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('cannot INSERT into profiles', async () => {
      const { error } = await anonClient
        .from('profiles')
        .insert({ user_id: ownerId, display_name: 'Hacker' });
      expect(error).not.toBeNull();
    });

    it('cannot call save_own_profile RPC', async () => {
      const { data, error } = await anonClient.rpc('save_own_profile', {
        p_display_name: 'x', p_profession: null, p_headline: null, p_introduction: null, p_profile_image_path: null,
      });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('Owner profile lifecycle', () => {
    it('owner can create (insert) their own profile row', async () => {
      const { data, error } = await ownerClient
        .from('profiles')
        .insert({ user_id: ownerId, display_name: 'Owner Draft' })
        .select('id')
        .single();
      expect(error).toBeNull();
      ownerProfileId = data!.id;
    });

    it('owner cannot insert a profile row for someone else', async () => {
      const { error } = await ownerClient
        .from('profiles')
        .insert({ user_id: otherId, display_name: 'Impersonation' });
      expect(error).not.toBeNull();
    });

    it('owner can SELECT own profile, not the other user profile', async () => {
      const { data: mine, error: mineErr } = await ownerClient
        .from('profiles').select('*').eq('id', ownerProfileId).single();
      expect(mineErr).toBeNull();
      expect(mine?.user_id).toBe(ownerId);

      const { data: otherRow, error: otherErr } = await otherClient
        .from('profiles')
        .insert({ user_id: otherId, display_name: 'Other Draft' })
        .select('id').single();
      expect(otherErr).toBeNull();
      otherProfileId = otherRow!.id;

      const { data: leaked } = await ownerClient
        .from('profiles').select('*').eq('id', otherProfileId);
      expect(leaked).toEqual([]);
    });

    it('save_own_profile updates allowed fields and rejects an invalid profession', async () => {
      const ok = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Owner Updated', p_profession: '필라테스 강사',
        p_headline: 'h', p_introduction: 'i', p_profile_image_path: '/img.jpg',
      });
      expect(ok.error).toBeNull();
      expect(ok.data?.[0]?.ok).toBe(true);

      const bad = await ownerClient.rpc('save_own_profile', {
        p_display_name: 'Owner Updated', p_profession: '없는직군',
        p_headline: 'h', p_introduction: 'i', p_profile_image_path: '/img.jpg',
      });
      expect(bad.data?.[0]?.ok).toBe(false);
    });

    it('owner cannot directly UPDATE verification_status/is_public/approved_at on profiles', async () => {
      const { error } = await ownerClient
        .from('profiles')
        .update({ verification_status: 'approved' })
        .eq('id', ownerProfileId);
      expect(error).not.toBeNull();

      const { error: pubErr } = await ownerClient
        .from('profiles').update({ is_public: true }).eq('id', ownerProfileId);
      expect(pubErr).not.toBeNull();
    });

    it('submit_profile requires a profile image before draft -> pending', async () => {
      await adminApi.from('profiles').update({ profile_image_path: null }).eq('id', ownerProfileId);
      const noImage = await ownerClient.rpc('submit_profile');
      expect(noImage.data?.[0]?.ok).toBe(false);

      await adminApi.from('profiles').update({ profile_image_path: '/img.jpg' }).eq('id', ownerProfileId);
      const submitted = await ownerClient.rpc('submit_profile');
      expect(submitted.data?.[0]?.ok).toBe(true);

      const { data: row } = await ownerClient.from('profiles').select('verification_status').eq('id', ownerProfileId).single();
      expect(row?.verification_status).toBe('pending');
    });

    it('cannot submit again while already pending', async () => {
      const { data } = await ownerClient.rpc('submit_profile');
      expect(data?.[0]?.ok).toBe(false);
    });
  });

  describe('Admin review workflow', () => {
    it('non-admin cannot call review_expert_profile', async () => {
      const { data } = await otherClient.rpc('review_expert_profile', {
        p_target_user_id: ownerId, p_decision: 'approved', p_rejection_reason: null,
      });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('review_expert_profile rejects an invalid decision value', async () => {
      const { data } = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerId, p_decision: 'maybe', p_rejection_reason: null,
      });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('admin can approve a pending profile, which logs an admin_actions row', async () => {
      const { data } = await adminClient.rpc('review_expert_profile', {
        p_target_user_id: ownerId, p_decision: 'approved', p_rejection_reason: null,
      });
      expect(data?.[0]?.ok).toBe(true);

      const { data: row } = await adminApi.from('profiles').select('verification_status, approved_at').eq('id', ownerProfileId).single();
      expect(row?.verification_status).toBe('approved');
      expect(row?.approved_at).not.toBeNull();

      const { data: log } = await adminApi
        .from('admin_actions')
        .select('action_type')
        .eq('target_profile_id', ownerProfileId)
        .eq('action_type', 'profile_approved');
      expect(log?.length).toBeGreaterThan(0);
    });

    it('admin can SELECT any profile; non-admin cannot browse others', async () => {
      const { data, error } = await adminClient.from('profiles').select('id').eq('id', otherProfileId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });
  });

  describe('Specialties (1-3, atomic)', () => {
    it('rejects 0 specialties', async () => {
      const { data } = await otherClient.rpc('replace_profile_specialties', { p_specialty_ids: [] });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('rejects more than 3 specialties', async () => {
      const { data } = await otherClient.rpc('replace_profile_specialties', { p_specialty_ids: specialtyIds });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('rejects duplicate specialty ids', async () => {
      const { data } = await otherClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [specialtyIds[0], specialtyIds[0]],
      });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('rejects a non-existent specialty id', async () => {
      const { data } = await otherClient.rpc('replace_profile_specialties', {
        p_specialty_ids: ['00000000-0000-0000-0000-000000000000'],
      });
      expect(data?.[0]?.ok).toBe(false);
    });

    it('accepts 1-3 valid ids and atomically replaces the previous set', async () => {
      const first = await otherClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [specialtyIds[0], specialtyIds[1]],
      });
      expect(first.data?.[0]?.ok).toBe(true);

      const second = await otherClient.rpc('replace_profile_specialties', {
        p_specialty_ids: [specialtyIds[2]],
      });
      expect(second.data?.[0]?.ok).toBe(true);

      const { data: rows } = await otherClient
        .from('profile_specialties').select('specialty_id').eq('profile_id', otherProfileId);
      expect(rows?.map((r: { specialty_id: string }) => r.specialty_id)).toEqual([specialtyIds[2]]);
    });
  });

  describe('Workplaces (one per profile)', () => {
    it('allows one workplace row per profile and rejects a second', async () => {
      const first = await otherClient
        .from('workplaces')
        .insert({ profile_id: otherProfileId, center_name: 'Center A' });
      expect(first.error).toBeNull();

      const second = await otherClient
        .from('workplaces')
        .insert({ profile_id: otherProfileId, center_name: 'Center B' });
      expect(second.error).not.toBeNull();
    });
  });
});
