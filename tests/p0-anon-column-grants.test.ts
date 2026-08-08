/**
 * M4 Public Projection — anon base-table lockout + safe-column view guard.
 *
 * Supersedes the original P0 column-grant approach: instead of granting anon
 * a safe column subset directly on licenses/workplaces, M4 revokes ALL anon
 * privileges on the base tables and routes public reads exclusively through
 * public_expert_list / public_expert_detail (owner-executed views that embed
 * only safe columns). See docs/report/M4_BASELINE_FINDINGS_2026_07_26.md §1.2
 * and supabase/migrations/20260728000000_m4_public_projection.sql.
 *
 * Run: supabase start && supabase db reset && pnpm test -- p0-anon-column-grants
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeCleanup } from './helpers/cleanup';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const rand = () => Math.random().toString(36).slice(2, 10);
const OWNER_EMAIL = `view-owner-${rand()}@test.local`;
const PASSWORD = 'Test1234!';

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await tmp.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

describe('M4: anon base-table lockout + public projection views', () => {
  let adminApi: SupabaseClient; // service_role — fixture setup/cleanup only
  let anonClient: SupabaseClient;
  let ownerClient: SupabaseClient;

  let ownerId: string;
  let ownerProfileId: string;
  let specialtySlug: string;

  beforeAll(async () => {
    adminApi = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    anonClient = createClient(SUPABASE_URL, ANON_KEY);

    const owner = await adminApi.auth.admin.createUser({ email: OWNER_EMAIL, password: PASSWORD, email_confirm: true });
    ownerId = owner.data.user!.id;
    ownerClient = await signInClient(OWNER_EMAIL, PASSWORD);

    const { data: profileRow, error: profileErr } = await ownerClient
      .from('profiles')
      .insert({ user_id: ownerId, display_name: 'Public Projection Owner', profile_image_path: '/img.jpg' })
      .select('id')
      .single();
    if (profileErr) throw profileErr;
    ownerProfileId = profileRow!.id;

    const { data: spec } = await adminApi.from('specialties').select('id, slug').order('sort_order').limit(1).single();
    const { error: specInsertErr } = await adminApi
      .from('profile_specialties')
      .insert({ profile_id: ownerProfileId, specialty_id: spec!.id, is_primary: true });
    if (specInsertErr) throw specInsertErr;
    specialtySlug = spec!.slug;

    await adminApi.from('workplaces').insert({
      profile_id: ownerProfileId,
      center_name: 'View Test Center',
      region: '서울',
      is_location_public: true,
      phone: '010-0000-0000',
      address: '비공개 주소',
    });
    await adminApi.from('licenses').insert({
      profile_id: ownerProfileId,
      license_name: '테스트 자격증',
      verification_status: 'verified',
      is_public: true,
      license_number_encrypted: 'SECRET-VALUE',
    });

    // Approve so the profile is is_public + approved (visible through the views).
    await adminApi.from('profiles').update({ is_public: true, verification_status: 'approved' }).eq('id', ownerProfileId);
  });

  afterAll(async () => {
    await safeCleanup([
      () => adminApi.from('profiles').delete().eq('id', ownerProfileId),
      () => adminApi.auth.admin.deleteUser(ownerId),
    ]);
  });

  describe('anon has zero direct base-table access', () => {
    it('cannot SELECT * from licenses', async () => {
      const { error } = await anonClient.from('licenses').select('*').limit(1);
      expect(error?.code).toBe('42501');
    });

    it('cannot SELECT even the previously-safe license columns directly', async () => {
      const { error } = await anonClient
        .from('licenses')
        .select('id, license_name, issuing_organization, acquired_date, verification_status, is_public')
        .limit(1);
      expect(error?.code).toBe('42501');
    });

    it('cannot SELECT * from workplaces', async () => {
      const { error } = await anonClient.from('workplaces').select('*').limit(1);
      expect(error?.code).toBe('42501');
    });

    it('cannot SELECT even the previously-safe workplace columns directly', async () => {
      const { error } = await anonClient
        .from('workplaces')
        .select('id, profile_id, center_name, region, website_url, is_current, is_location_public')
        .limit(1);
      expect(error?.code).toBe('42501');
    });

    it('cannot SELECT profiles, experiences, educations, or profile_specialties', async () => {
      for (const table of ['profiles', 'experiences', 'educations', 'profile_specialties']) {
        const { error } = await anonClient.from(table).select('*').limit(1);
        expect(error?.code).toBe('42501');
      }
    });
  });

  describe('public_expert_list (owner-executed view)', () => {
    it('anon can read the approved+public profile through the view', async () => {
      const { data, error } = await anonClient
        .from('public_expert_list')
        .select('*')
        .eq('id', ownerProfileId)
        .single();
      expect(error).toBeNull();
      expect(data?.display_name).toBe('Public Projection Owner');
      expect(data?.workplace_region).toBe('서울');
      expect(data?.workplace_center_name).toBe('View Test Center');
    });

    it('never exposes workplace phone/address or license encrypted fields (not in the view at all)', async () => {
      const { data } = await anonClient.from('public_expert_list').select('*').eq('id', ownerProfileId).single();
      const keys = Object.keys(data ?? {});
      expect(keys).not.toContain('phone');
      expect(keys).not.toContain('address');
      expect(keys).not.toContain('license_number_encrypted');
    });

    it('hides workplace_region/workplace_center_name when is_location_public is false', async () => {
      await adminApi.from('workplaces').update({ is_location_public: false }).eq('profile_id', ownerProfileId);
      const { data } = await anonClient.from('public_expert_list').select('*').eq('id', ownerProfileId).single();
      expect(data?.workplace_region).toBeNull();
      expect(data?.workplace_center_name).toBeNull();
      await adminApi.from('workplaces').update({ is_location_public: true }).eq('profile_id', ownerProfileId);
    });
  });

  describe('public_expert_detail (owner-executed view)', () => {
    it('embeds verified+public licenses without the encrypted/private columns', async () => {
      const { data, error } = await anonClient
        .from('public_expert_detail')
        .select('*')
        .eq('id', ownerProfileId)
        .single();
      expect(error).toBeNull();
      expect(data?.licenses).toEqual([
        expect.objectContaining({ license_name: '테스트 자격증' }),
      ]);
      expect(JSON.stringify(data?.licenses)).not.toContain('SECRET-VALUE');
    });

    it('returns zero rows (not an error) for a non-existent id — no existence leak', async () => {
      const { data, error } = await anonClient
        .from('public_expert_detail')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000000');
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('returns zero rows for a real profile id that is not public+approved', async () => {
      await adminApi.from('profiles').update({ is_public: false }).eq('id', ownerProfileId);
      const { data, error } = await anonClient
        .from('public_expert_detail')
        .select('*')
        .eq('id', ownerProfileId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
      await adminApi.from('profiles').update({ is_public: true }).eq('id', ownerProfileId);
    });
  });

  describe('search_public_experts RPC', () => {
    it('anon can call it and gets the seeded profile back unfiltered', async () => {
      const { data, error } = await anonClient.rpc('search_public_experts', {});
      expect(error).toBeNull();
      expect(data?.some((r: { id: string }) => r.id === ownerProfileId)).toBe(true);
    });

    it('filters by specialty_slugs (containment match, OR across array)', async () => {
      const { data } = await anonClient.rpc('search_public_experts', { p_specialty_slugs: [specialtySlug] });
      expect(data?.some((r: { id: string }) => r.id === ownerProfileId)).toBe(true);

      const { data: noMatch } = await anonClient.rpc('search_public_experts', { p_specialty_slugs: ['nonexistent-slug'] });
      expect(noMatch?.some((r: { id: string }) => r.id === ownerProfileId)).toBe(false);
    });

    it('filters by regions (OR across array), gated by is_location_public', async () => {
      const { data: match } = await anonClient.rpc('search_public_experts', { p_regions: ['서울'] });
      expect(match?.some((r: { id: string }) => r.id === ownerProfileId)).toBe(true);

      await adminApi.from('workplaces').update({ is_location_public: false }).eq('profile_id', ownerProfileId);
      const { data: hidden } = await anonClient.rpc('search_public_experts', { p_regions: ['서울'] });
      expect(hidden?.some((r: { id: string }) => r.id === ownerProfileId)).toBe(false);
      await adminApi.from('workplaces').update({ is_location_public: true }).eq('profile_id', ownerProfileId);
    });

    it('OR-matches when multiple values are selected (e.g. real region + a non-matching one)', async () => {
      const { data: match } = await anonClient.rpc('search_public_experts', {
        p_regions: ['서울', '부산'],
      });
      expect(match?.some((r: { id: string }) => r.id === ownerProfileId)).toBe(true);

      const { data: noMatch } = await anonClient.rpc('search_public_experts', {
        p_regions: ['부산', '대전'],
      });
      expect(noMatch?.some((r: { id: string }) => r.id === ownerProfileId)).toBe(false);
    });

    it('an explicit empty array matches nothing (distinct from NULL = no filter)', async () => {
      const { data } = await anonClient.rpc('search_public_experts', { p_regions: [] });
      expect(data?.some((r: { id: string }) => r.id === ownerProfileId)).toBe(false);
    });
  });

  describe('anon EXECUTE revoked on is_admin (PUBLIC default-grant closed)', () => {
    it('cannot call is_admin RPC directly', async () => {
      const { error } = await anonClient.rpc('is_admin', {});
      expect(error?.code).toBe('42501');
    });
  });
});
