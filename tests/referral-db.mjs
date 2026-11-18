// Run: node --test tests/referral-db.mjs
// Install outside repo: npm install --prefix "$env:TEMP/referral-db-pglite" --ignore-scripts @electric-sql/pglite@0.3.14
// Optional REFERRAL_PGLITE_ROOT selects another isolated installation directory.
// No .env, remote URLs, keys, production connections or app dependencies used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const requireEngine = createRequire(join(process.env.REFERRAL_PGLITE_ROOT ?? join(tmpdir(), 'referral-db-pglite'), 'package.json'));
const { PGlite } = await import(pathToFileURL(requireEngine.resolve('@electric-sql/pglite')).href);
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const migration = new URL('../supabase/migrations/20261118075047_referral_event_codes.sql', import.meta.url);
const rollback = new URL('../docs/report/REFERRAL_ROLLBACK_DISABLE.sql', import.meta.url);

test('referral event SQL in isolated PGlite', async t => {
  const db = new PGlite();
  const value = async (sql, args = []) => (await db.query(sql, args)).rows[0].result;
  const asRole = async (n, sql, args = [], role = 'authenticated', claims = {}) => {
    await db.exec('begin');
    try {
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: n === null ? null : uid(n), ...claims })]);
      assert.ok(['anon', 'authenticated'].includes(role));
      await db.exec(`set local role ${role}`);
      const result = await value(sql, args);
      await db.exec('commit');
      return result;
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  };
  const rpc = (n, name, args = []) => {
    assert.match(name, /^[a-z_]+$/);
    return asRole(n, `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args);
  };
  const register = (n, code) => rpc(n, 'register_referral_code', [code]);
  const status = n => rpc(n, 'own_referral_status');
  const fail = error => ({ ok: false, error });
  const denied = promise => assert.rejects(promise, { code: '42501' });
  try {
    // Minimal Auth/profiles contracts, not the application's unrelated migrations.
    // is_admin mirrors the repository baseline's protected admin_users lookup.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (
        id uuid primary key, email_confirmed_at timestamptz,
        phone_confirmed_at timestamptz, is_anonymous boolean default false,
        banned_until timestamptz, raw_user_meta_data jsonb default '{}'
      );
      create function auth.uid() returns uuid language sql stable as $$
        select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
      $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create table public.profiles (
        user_id uuid unique references auth.users(id) on delete cascade,
        suspended_at timestamptz, deletion_requested_at timestamptz
      );
      create table public.admin_users (user_id uuid primary key references auth.users(id), role text not null);
      alter table public.admin_users enable row level security;
      revoke all on public.admin_users from public, authenticated, anon;
      create function public.is_admin(user_id uuid default auth.uid()) returns boolean
      language plpgsql stable security definer set search_path to 'public' as $$
      declare admin_role text;
      begin
        select role into admin_role from admin_users where admin_users.user_id = $1;
        return admin_role is not null;
      end $$;
      revoke all on function public.is_admin(uuid) from public, anon;
      grant execute on function public.is_admin(uuid) to authenticated;
    `);
    for (let n = 1; n <= 10; n++) {
      await db.query('insert into auth.users(id,email_confirmed_at) values ($1,now())', [uid(n)]);
    }
    await db.query("insert into public.admin_users values ($1,'admin')", [uid(1)]);
    await db.query('update auth.users set email_confirmed_at=null where id=$1', [uid(4)]);
    await db.query('update auth.users set is_anonymous=true where id=$1', [uid(5)]);
    await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1", [uid(6)]);
    await db.query('insert into public.profiles(user_id,suspended_at) values ($1,now())', [uid(7)]);
    await db.query('insert into public.profiles(user_id,deletion_requested_at) values ($1,now())', [uid(8)]);
    await db.query('update auth.users set email_confirmed_at=null,phone_confirmed_at=now() where id=$1', [uid(9)]);
    await db.exec(await readFile(migration, 'utf8'));

    await t.test('public invokers, private definers, locked paths and RLS', async () => {
      const { rows } = await db.query(`select n.nspname, p.proname, p.prosecdef, p.proconfig
        from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
        where n.nspname='referral_private' or (n.nspname='public' and p.proname in
        ('own_referral_status','register_referral_code','list_referral_campaigns','create_referral_campaign','set_referral_campaign_active'))`);
      assert.equal(rows.length, 11);
      for (const row of rows) {
        assert.equal(row.prosecdef, row.nspname === 'referral_private');
        assert.deepEqual(row.proconfig, ['search_path=""']);
      }
      assert.equal(await value(`select count(*)::int as result from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid=c.relnamespace
        where n.nspname='referral_private' and c.relkind='r' and c.relrowsecurity`), 2);
      // PGlite is single-connection: inspect the lock, but don't claim a multi-session race test.
      assert.match(await value("select pg_catalog.pg_get_functiondef('referral_private.member_error()'::regprocedure) as result"), /for update/i);
    });

    await t.test('anon cannot call any public or private endpoint', async () => {
      const calls = ['own_referral_status()', "register_referral_code('EVENT_A')", 'list_referral_campaigns()',
        "create_referral_campaign('EVENT_A','Label')", "set_referral_campaign_active('EVENT_A',true)"];
      for (const call of calls) {
        await denied(asRole(null, `select public.${call} as result`, [], 'anon'));
        await denied(asRole(null, `select referral_private.${call} as result`, [], 'anon'));
      }
    });

    await t.test('confirmed membership is required, including missing/deleted subjects', async () => {
      for (const n of [null, 4, 5, 99]) {
        assert.deepEqual(await register(n, 'EVENT_A'), fail('not_authenticated'));
        await assert.rejects(status(n), { code: '42501', message: 'not_authenticated' });
        assert.deepEqual(await rpc(n, 'create_referral_campaign', ['EVENT_A', 'Label']), fail('not_authenticated'));
      }
      assert.deepEqual(await status(9), { registeredCode: null, registeredAt: null });
    });

    await t.test('inactive own account blocks reads and writes', async () => {
      for (const n of [6, 7, 8]) {
        assert.deepEqual(await register(n, 'EVENT_A'), fail('unavailable'));
        await assert.rejects(status(n), { code: '42501', message: 'unavailable' });
        assert.deepEqual(await rpc(n, 'set_referral_campaign_active', ['EVENT_A', false]), fail('unavailable'));
      }
    });

    await t.test('only protected admin membership grants campaign administration', async () => {
      await db.query(`update auth.users set raw_user_meta_data='{"role":"admin","is_admin":true,"coupon":true}' where id=$1`, [uid(2)]);
      assert.deepEqual(await rpc(2, 'create_referral_campaign', ['EVENT_A', 'Label']), fail('not_allowed'));
      assert.deepEqual(await rpc(2, 'set_referral_campaign_active', ['EVENT_A', false]), fail('not_allowed'));
      await assert.rejects(asRole(2, 'select public.list_referral_campaigns() as result', [], 'authenticated',
        { role: 'admin', user_metadata: { is_admin: true }, app_metadata: { role: 'admin' } }),
        { code: '42501', message: 'not_allowed' });
      await denied(asRole(2, 'select role as result from public.admin_users'));
      assert.deepEqual(await rpc(1, 'list_referral_campaigns'), []);
      assert.deepEqual(await rpc(1, 'create_referral_campaign', [' event_a ', ' Event A ']), { ok: true });
      assert.deepEqual(await rpc(1, 'create_referral_campaign', ['EVENT_B', 'Event B']), { ok: true });
    });

    await t.test('admin input validation and duplicate creation preserve campaign', async () => {
      for (const code of [null, '', 'ABC', 'A'.repeat(33), 'BAD CODE', '💥💥💥💥']) {
        assert.deepEqual(await rpc(1, 'create_referral_campaign', [code, 'Label']), fail('invalid_code'));
        assert.deepEqual(await rpc(1, 'set_referral_campaign_active', [code, true]), fail('invalid_code'));
      }
      for (const label of [null, '', '  ', 'x'.repeat(81)]) {
        assert.deepEqual(await rpc(1, 'create_referral_campaign', ['LABEL_TEST', label]), fail('invalid_label'));
      }
      assert.deepEqual(await rpc(1, 'create_referral_campaign', ['event_a', 'Replacement']), fail('duplicate_code'));
      assert.deepEqual(await rpc(1, 'set_referral_campaign_active', ['UNKNOWN', true]), fail('unavailable'));
      assert.deepEqual(await rpc(1, 'set_referral_campaign_active', ['EVENT_A', null]), fail('unavailable'));
      const rows = await rpc(1, 'list_referral_campaigns');
      assert.equal(rows[0].label, 'Event A');
      assert.equal(rows[0].registrations, 0);
      assert.deepEqual(Object.keys(rows[0]).sort(), ['active', 'code', 'createdAt', 'label', 'registrations']);
    });

    await t.test('malformed, unknown and disabled codes cannot register', async () => {
      assert.deepEqual(await status(2), { registeredCode: null, registeredAt: null });
      for (const code of [null, '', 'BAD CODE', 'ABC', 'A'.repeat(33)]) {
        assert.deepEqual(await register(2, code), fail('invalid_code'));
      }
      assert.deepEqual(await register(2, 'UNKNOWN'), fail('unavailable'));
      assert.deepEqual(await rpc(1, 'set_referral_campaign_active', [' event_a ', false]), { ok: true });
      assert.deepEqual(await register(2, 'EVENT_A'), fail('unavailable'));
      assert.deepEqual(await rpc(1, 'set_referral_campaign_active', ['EVENT_A', true]), { ok: true });
    });

    let saved;
    await t.test('register once, normalized retry is idempotent, overwrite is blocked', async () => {
      assert.deepEqual(await register(2, ' event_a '), { ok: true });
      saved = await status(2);
      assert.equal(saved.registeredCode, 'EVENT_A');
      assert.ok(!Number.isNaN(Date.parse(saved.registeredAt)));
      assert.deepEqual(Object.keys(saved).sort(), ['registeredAt', 'registeredCode']);
      assert.deepEqual(await register(2, 'EVENT_A'), { ok: true });
      assert.deepEqual(await register(2, 'EVENT_B'), fail('already_registered'));
      assert.deepEqual(await status(2), saved);
      await rpc(1, 'set_referral_campaign_active', ['EVENT_A', false]);
      assert.deepEqual(await register(2, 'EVENT_A'), { ok: true });
      assert.deepEqual(await status(2), saved);
      assert.deepEqual(await register(3, 'EVENT_A'), fail('unavailable'));
      assert.equal((await rpc(1, 'list_referral_campaigns'))[0].registrations, 1);
    });

    await t.test('owner isolation, private helper denied, no table reads or writes', async () => {
      assert.deepEqual(await status(3), { registeredCode: null, registeredAt: null });
      await denied(asRole(3, 'select referral_private.member_error() as result'));
      for (const role of ['anon', 'authenticated']) {
        for (const table of ['campaigns', 'registrations']) {
          await denied(asRole(3, `select * from referral_private.${table}`, [], role));
          await denied(asRole(3, `delete from referral_private.${table} returning code as result`, [], role));
        }
        await denied(asRole(3, "insert into referral_private.campaigns(code,label) values ('EVIL','Evil') returning code as result", [], role));
        await denied(asRole(3, `insert into referral_private.registrations(user_id,code) values ($1,'EVENT_B') returning code as result`, [uid(3)], role));
        await denied(asRole(3, "update referral_private.registrations set code='EVENT_B' returning code as result", [], role));
      }
      // Even an accidental SELECT grant cannot bypass deny-by-default RLS.
      await db.exec('begin; grant select on all tables in schema referral_private to authenticated; set local role authenticated');
      try {
        assert.deepEqual((await db.query('select * from referral_private.registrations')).rows, []);
        assert.deepEqual((await db.query('select * from referral_private.campaigns')).rows, []);
      } finally { await db.exec('rollback'); }
    });

    await t.test('inactive status blocks even an otherwise idempotent retry', async () => {
      await db.query('insert into public.profiles(user_id,suspended_at) values ($1,now())', [uid(2)]);
      assert.deepEqual(await register(2, 'EVENT_A'), fail('unavailable'));
      await db.query('delete from public.profiles where user_id=$1', [uid(2)]);
      assert.deepEqual(await status(2), saved);
    });

    await t.test('transaction rollback leaves no registration and constraints prevent duplicates', async () => {
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: uid(3) })]);
        await db.exec('set local role authenticated');
        assert.deepEqual(await value("select public.register_referral_code('EVENT_B') as result"), { ok: true });
      } finally { await db.exec('rollback'); }
      assert.deepEqual(await status(3), { registeredCode: null, registeredAt: null });
      assert.deepEqual(await register(3, 'EVENT_B'), { ok: true });
      await assert.rejects(db.query("insert into referral_private.registrations(user_id,code) values ($1,'EVENT_B')", [uid(2)]), { code: '23505' });
      await assert.rejects(db.exec("delete from referral_private.campaigns where code='EVENT_B'"), { code: '23503' });
    });

    await t.test('deleting member cascades own registration and rejects stale subject', async () => {
      await db.query('delete from auth.users where id=$1', [uid(2)]);
      assert.equal(await value('select count(*)::int as result from referral_private.registrations where user_id=$1', [uid(2)]), 0);
      assert.deepEqual(await register(2, 'EVENT_B'), fail('not_authenticated'));
      await assert.rejects(status(2), { code: '42501', message: 'not_authenticated' });
      const rows = await rpc(1, 'list_referral_campaigns');
      assert.equal(rows.length, 2);
      assert.equal(rows[0].registrations, 0);
      assert.equal(rows[1].registrations, 1);
    });

    await t.test('revoking protected admin membership immediately blocks all admin RPCs', async () => {
      await db.query('delete from public.admin_users where user_id=$1', [uid(1)]);
      await assert.rejects(rpc(1, 'list_referral_campaigns'), { code: '42501', message: 'not_allowed' });
      assert.deepEqual(await rpc(1, 'create_referral_campaign', ['EVENT_C', 'C']), fail('not_allowed'));
      assert.deepEqual(await rpc(1, 'set_referral_campaign_active', ['EVENT_B', false]), fail('not_allowed'));
    });

    await t.test('permission-disable rollback preserves all data and closes both entry paths', async () => {
      const snapshot = () => value(`select jsonb_build_object(
        'campaigns',(select jsonb_agg(c order by code) from referral_private.campaigns c),
        'registrations',(select jsonb_agg(r order by user_id) from referral_private.registrations r)) as result`);
      const before = await snapshot();
      await db.exec(await readFile(rollback, 'utf8'));
      assert.deepEqual(await snapshot(), before);
      for (const role of ['authenticated', 'anon']) {
        for (const schema of ['public', 'referral_private']) {
          for (const call of ['own_referral_status()', "register_referral_code('EVENT_B')", 'list_referral_campaigns()',
            "create_referral_campaign('EVENT_C','C')", "set_referral_campaign_active('EVENT_B',false)"]) {
            await denied(asRole(3, `select ${schema}.${call} as result`, [], role));
          }
        }
      }
    });
  } finally { await db.close(); }
});
