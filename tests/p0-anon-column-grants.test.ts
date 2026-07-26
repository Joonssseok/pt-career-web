/**
 * P0 — anon column-level exposure guard for licenses/workplaces.
 *
 * Row-level RLS already scopes anon to public+approved(+verified) rows; this
 * guards the COLUMN dimension, which RLS alone cannot express. See
 * docs/report/M4_BASELINE_FINDINGS_2026_07_26.md §1.2 and
 * supabase/migrations/20260727000200_p0_anon_column_grants.sql.
 *
 * Run: supabase start && supabase db reset && pnpm test -- p0-anon-column-grants
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

describe('P0: anon column-level grants (licenses/workplaces)', () => {
  let anonClient: SupabaseClient;

  beforeAll(() => {
    anonClient = createClient(SUPABASE_URL, ANON_KEY);
  });

  it('anon cannot SELECT * from licenses (some columns ungranted)', async () => {
    const { error } = await anonClient.from('licenses').select('*').limit(1);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('anon cannot SELECT license_number_encrypted or document_path_private', async () => {
    const encrypted = await anonClient.from('licenses').select('license_number_encrypted').limit(1);
    expect(encrypted.error?.code).toBe('42501');

    const docPath = await anonClient.from('licenses').select('document_path_private').limit(1);
    expect(docPath.error?.code).toBe('42501');
  });

  it('anon CAN select the safe license columns', async () => {
    const { error } = await anonClient
      .from('licenses')
      .select('id, license_name, issuing_organization, acquired_date, verification_status, is_public')
      .limit(1);
    expect(error).toBeNull();
  });

  it('anon cannot SELECT * from workplaces (some columns ungranted)', async () => {
    const { error } = await anonClient.from('workplaces').select('*').limit(1);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('anon cannot SELECT phone, external_contact_url, address, address_detail, latitude, or longitude', async () => {
    for (const column of ['phone', 'external_contact_url', 'address', 'address_detail', 'latitude', 'longitude']) {
      const { error } = await anonClient.from('workplaces').select(column).limit(1);
      expect(error?.code).toBe('42501');
    }
  });

  it('anon CAN select the safe workplace columns', async () => {
    const { error } = await anonClient
      .from('workplaces')
      .select('id, profile_id, center_name, region, website_url, is_current, is_location_public')
      .limit(1);
    expect(error).toBeNull();
  });
});
