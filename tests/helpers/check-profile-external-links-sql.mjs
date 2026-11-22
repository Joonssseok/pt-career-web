// Isolated only: node tests/helpers/check-profile-external-links-sql.mjs [path/to/pglite/dist/index.js]
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2] || '../introduction-sql-check/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg = await PGlite.create();
let checks = 0;
const u1 = '00000000-0000-0000-0000-000000000001', u2 = '00000000-0000-0000-0000-000000000002';
const p1 = '10000000-0000-0000-0000-000000000001', p2 = '10000000-0000-0000-0000-000000000002';
function eq(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
async function scalar(sql, params = []) { return (await pg.query(sql, params)).rows[0]?.v; }
async function claim(uid) { await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]); }
async function run(role, sql, params = []) {
  const uid = await scalar("select current_setting('request.jwt.claim.sub',true) v");
  if (role === 'anon') await claim('');
  await pg.exec(`set role ${role}`);
  try { return (await pg.query(sql, params)).rows; }
  finally { await pg.exec('reset role'); if (role === 'anon') await claim(uid || ''); }
}
async function value(role, sql, params = []) { return (await run(role, sql, params))[0]?.v; }
async function fails(role, sql, params = [], code = '42501') {
  await assert.rejects(run(role, sql, params), (error) => error.code === code); checks++;
}
const link = (kind = 'custom', label = 'Link', url = 'https://example.com/', is_primary = false) => ({ kind, label, url, is_primary });
async function baseline() {
  return (await value('authenticated','select public.load_own_external_links() v')).map(({id,...item}) => item);
}
async function save(links, expected) {
  if (expected === undefined) {
    const uid = await scalar("select current_setting('request.jwt.claim.sub',true) v");
    expected = uid ? await baseline() : [];
  }
  return (await run('authenticated', 'select * from public.save_own_external_links($1::jsonb,$2::jsonb)', [JSON.stringify(links),JSON.stringify(expected)]))[0];
}
const snapshotSQL = `select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'links',(select jsonb_agg(to_jsonb(e) order by id) from public.profile_extra_links e)) v`;
try {
  await pg.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    create table public.profiles(id uuid primary key,user_id uuid unique,is_public boolean default true,
      owner_visible boolean default true,verification_status text default 'approved',deletion_requested_at timestamptz,suspended_at timestamptz,
      youtube_url text,instagram_url text,blog_url text,threads_url text,kakao_url text);
    alter table public.profiles enable row level security;
    grant select on public.profiles to anon,authenticated;
    create policy public_profiles on public.profiles for select to anon,authenticated using(
      is_public and owner_visible and verification_status='approved' and deletion_requested_at is null and suspended_at is null);
    create policy own_profiles on public.profiles for select to authenticated using(user_id=auth.uid());
    create schema posts_private;
    revoke all on schema posts_private from public,anon,authenticated,service_role;`);
  const migrations = await readdir('supabase/migrations');
  const editor = migrations.find((name) => /^\d+_profile_post_editor_tools\.sql$/.test(name));
  assert.ok(editor, 'existing URL validator dependency');
  const editorSQL = await readFile(`supabase/migrations/${editor}`, 'utf8');
  await pg.exec(editorSQL.slice(editorSQL.indexOf('create function posts_private.editor_link_valid'), editorSQL.indexOf('create function posts_private.editor_node_valid')));
  await pg.exec('revoke all on function posts_private.editor_link_valid(text) from public,anon,authenticated,service_role');
  const oldSQL = await readFile('supabase/migrations/20260813020000_profile_extra_links.sql', 'utf8');
  await pg.exec(oldSQL.slice(0, oldSQL.indexOf('CREATE OR REPLACE VIEW')));
  await pg.exec(`create view public.public_expert_detail with(security_invoker=true) as
    select p.id,p.youtube_url,p.instagram_url,p.blog_url,p.threads_url,p.kakao_url,
      coalesce(links.extra_links,'[]'::jsonb) extra_links
    from public.profiles p left join lateral (
      select jsonb_agg(jsonb_build_object('label', el.label, 'url', el.url) order by el.display_order) extra_links
      from public.profile_extra_links el where el.profile_id=p.id
    ) links on true
    where p.is_public=true and p.verification_status='approved' and p.deletion_requested_at is null
      and p.suspended_at is null and p.owner_visible=true;
    grant select on public.public_expert_detail to anon,authenticated,service_role;`);
  await pg.query(`insert into public.profiles(id,user_id,youtube_url,instagram_url,blog_url,threads_url,kakao_url) values
    ($1,$2,'https://youtube.com/@legacy','https://instagram.com/legacy','https://blog.example/','https://threads.net/@legacy','https://pf.kakao.com/legacy'),
    ($3,$4,'https://youtube.com/@other',null,null,null,null)`, [p1,u1,p2,u2]);
  await pg.query(`insert into public.profile_extra_links(profile_id,label,url,display_order) values
    ($1,'Old extra','https://old.example/',0),($1,'Duplicate','https://old.example/',1),($2,'Other','https://other.example/',0)`, [p1,p2]);
  const beforeMigration = await scalar(snapshotSQL);
  const viewACL = await scalar("select relacl::text v from pg_class where oid='public.public_expert_detail'::regclass");
  const policiesSQL = "select jsonb_agg(jsonb_build_array(policyname,cmd,roles,qual,with_check) order by policyname) v from pg_policies where schemaname='public' and tablename='profile_extra_links'";
  const policies = await scalar(policiesSQL);
  await pg.exec(await readFile('supabase/migrations/20261122091934_profile_external_links.sql', 'utf8'));
  const afterMigration = await scalar(snapshotSQL);
  eq(afterMigration.profiles, beforeMigration.profiles, 'migration does not clear or convert legacy social fields');
  eq(afterMigration.links.map(({kind,is_primary,...old}) => old), beforeMigration.links, 'original rows, IDs, timestamps unchanged');
  eq(afterMigration.links.every((row) => row.kind==='custom' && row.is_primary===false), true, 'metadata defaults only');
  eq(await scalar(policiesSQL), policies, 'RLS policies unchanged');
  eq(await scalar("select relacl::text v from pg_class where oid='public.public_expert_detail'::regclass"), viewACL, 'public view grants unchanged');
  eq(await scalar("select 'security_invoker=true'=any(reloptions) v from pg_class where oid='public.public_expert_detail'::regclass"), true, 'public view remains invoker');
  await fails('anon', 'select public.load_own_external_links()');
  await fails('anon', "select * from public.save_own_external_links('[]','[]')");
  await fails('authenticated', 'select public.load_own_external_links()');
  eq((await save([])).ok, false, 'authenticated role without user identity cannot save');
  await claim('00000000-0000-0000-0000-000000000003');
  eq(await value('authenticated', 'select public.load_own_external_links() v'), [], 'no profile load returns empty');
  eq((await save([])).ok, false, 'no profile cannot save');
  await claim(u1);
  const loaded = await value('authenticated', 'select public.load_own_external_links() v');
  eq(loaded.length, 7, 'load merges five legacy socials and existing extras');
  eq(Object.keys(loaded[0]).sort(), ['id','kind','label','url','is_primary'].sort(), 'exact owner DTO');
  eq(loaded.slice(0,5).map((row) => row.kind), ['youtube','instagram','blog','threads','kakao'], 'legacy kinds on read only');
  eq(await scalar(snapshotSQL), afterMigration, 'loading is read only');
  const rejected = [null, {}, 12, Array(16).fill(link()), [link('unknown')], [link('custom','')], [link('custom','x'.repeat(41))],
    [{...link(),id:'ignored'}], [{...link(),primary:true}], [{...link(),profile_id:p2}], [{...link(),is_primary:'true'}],
    [{label:'x',url:'https://example.com/'}], [link('custom','bad\nlabel')],
    [link('custom','x','javascript:alert(1)')], [link('custom','x','data:text/html,bad')],
    [link('custom','x','https://user:pass@example.com/')], [link('custom','x','https://example.com/\n')],
    [link('custom','x','https://example.com/a b')], [link('custom','x','https://example.com/a\\b')],
    [link('custom','x','https://example.com/<bad>')], [link('custom','x','https://')],
    [link('custom','x','https://example.com/'+ 'a'.repeat(2048))], [link('youtube','a','https://a.example',true),link('custom','b','https://b.example',true)],
  ];
  for (const invalid of rejected) {
    eq((await save(invalid)).ok, false, 'invalid input rejected');
    eq(await scalar(snapshotSQL), afterMigration, 'rejected save preserves links and legacy social fields');
  }
  const staleExpected=await baseline();
  await pg.query("update public.profiles set youtube_url='javascript:legacy-invalid' where id=$1",[p1]);
  const rawExpected=await baseline();
  eq(rawExpected[0].url,'javascript:legacy-invalid','raw invalid legacy baseline is not normalized or rejected on load');
  eq(await save([link('youtube','x'.repeat(40),'https://youtube.com/@new',true),link('custom','Second','http://example.com/path')],rawExpected), {ok:true,error:''}, 'explicit save can repair invalid legacy URL using raw expected baseline');
  const canonical = await value('authenticated', 'select public.load_own_external_links() v');
  const afterFreshSave=await scalar(snapshotSQL);
  eq(await save([link('custom','Stale replacement','https://stale.example/')],staleExpected),{ok:false,error:'External links changed'},'stale tab returns exact conflict error');
  eq(await scalar(snapshotSQL),afterFreshSave,'stale save preserves links, metadata and profile fields');
  eq(await save([],null),{ok:false,error:'External links changed'},'null expected baseline rejected');
  eq(await save([],await baseline().then((rows)=>rows.reverse())),{ok:false,error:'External links changed'},'expected baseline comparison preserves order');
  eq(await scalar(snapshotSQL),afterFreshSave,'invalid expected values perform no writes');
  await fails('authenticated',"select * from public.save_own_external_links('[]')",[],'42883');
  eq(canonical.length,2,'no duplicate legacy socials after successful save');
  eq(canonical[0].kind,'youtube','kind retained'); eq(canonical[0].is_primary,true,'primary retained');
  eq(await scalar('select jsonb_build_array(youtube_url,instagram_url,blog_url,threads_url,kakao_url) v from public.profiles where id=$1',[p1]), [null,null,null,null,null], 'only explicit valid save clears own legacy columns');
  const otherSnapshot = afterMigration.links.filter((row) => row.profile_id===p2);
  eq((await scalar(snapshotSQL)).links.filter((row) => row.profile_id===p2), otherSnapshot, 'other owner rows unchanged');
  eq(await scalar('select youtube_url v from public.profiles where id=$1',[p2]), 'https://youtube.com/@other','other owner legacy URL unchanged');
  eq((await run('authenticated',"update public.profile_extra_links set label='Stolen' where profile_id=$1 returning id",[p2])).length,0,'RLS blocks foreign updates');
  eq((await run('authenticated','delete from public.profile_extra_links where profile_id=$1 returning id',[p2])).length,0,'RLS blocks foreign deletes');
  await fails('authenticated',"insert into public.profile_extra_links(profile_id,label,url) values($1,'Stolen','https://example.com/')",[p2]);
  await fails('authenticated',"insert into public.profile_extra_links(profile_id,label,url,is_primary) values($1,'Second primary','https://example.com/',true)",[p1],'23505');
  const publicLinks = await value('anon','select extra_links v from public.public_expert_detail where id=$1',[p1]);
  eq(publicLinks[0], {label:'x'.repeat(40),url:'https://youtube.com/@new',kind:'youtube',is_primary:true}, 'same public audience gets only enriched projection');
  const legacyResult = await run('authenticated', "select * from public.save_own_extra_links('[{\"label\":\"Blind overwrite\",\"url\":\"https://stale.example/\"}]')");
  eq(legacyResult[0].ok,false,'legacy writer blocked on canonical metadata');
  eq(await value('authenticated','select public.load_own_external_links() v'),canonical,'legacy rejection preserves metadata');
  for (const change of ['is_public=false','owner_visible=false',"verification_status='pending'",'suspended_at=now()','deletion_requested_at=now()']) {
    await pg.exec(`update public.profiles set ${change} where id='${p1}'`);
    eq((await run('anon','select * from public.public_expert_detail where id=$1',[p1])).length,0,'view retains privacy/status gates');
    eq((await run('anon','select kind,is_primary from public.profile_extra_links where profile_id=$1',[p1])).length,0,'raw metadata retains public RLS');
    await claim(u2);
    eq((await run('authenticated','select kind,is_primary from public.profile_extra_links where profile_id=$1',[p1])).length,0,'other member cannot read private metadata');
    await claim(u1);
    eq((await value('authenticated','select public.load_own_external_links() v')).length,2,'private owner load remains available');
    await pg.query("update public.profiles set is_public=true,owner_visible=true,verification_status='approved',suspended_at=null,deletion_requested_at=null where id=$1",[p1]);
  }
  const fifteen=Array.from({length:15},(_,i)=>link('custom',`Link ${i}`,`https://example.com/${i}`,i===0));
  eq((await save(fifteen)).ok,true,'fifteen links allowed');
  eq((await value('authenticated','select public.load_own_external_links() v')).length,15,'fifteen links retained');
  eq((await run('authenticated',"select * from public.save_own_extra_links('[]')"))[0].ok,false,'legacy writer cannot truncate fifteen links');
  await claim(u2);
  eq((await run('authenticated',"select * from public.save_own_extra_links('[{\"label\":\"Legacy edit\",\"url\":\"https://legacy.example/\"}]')"))[0].ok,true,'plain legacy ten-slot writer remains usable');
  eq(await scalar('select youtube_url v from public.profiles where id=$1',[p2]),'https://youtube.com/@other','legacy writer does not clear fixed columns');
  await claim(u1);
  const beforeRollback=await scalar(snapshotSQL);
  await pg.exec(await readFile('supabase/rollback/profile_external_links.sql','utf8'));
  eq(await scalar(snapshotSQL),beforeRollback,'rollback preserves all rows, metadata and profile fields');
  for(const role of ['anon','authenticated']) {
    await fails(role,'select public.load_own_external_links()');
    await fails(role,"select * from public.save_own_external_links('[]','[]')");
  }
  eq((await value('anon','select extra_links v from public.public_expert_detail where id=$1',[p1]))[0],{label:'Link 0',url:'https://example.com/0'},'rollback restores original public JSON keys');
  eq(await scalar(policiesSQL),policies,'rollback preserves RLS policies');
  eq(await scalar("select relacl::text v from pg_class where oid='public.public_expert_detail'::regclass"),viewACL,'rollback preserves view grants');
  await fails('authenticated','select kind,is_primary from public.profile_extra_links');
  eq((await run('authenticated',"select * from public.save_own_extra_links('[]')"))[0].ok,false,'rollback keeps safe legacy guard');
  eq(await scalar(snapshotSQL),beforeRollback,'denied rollback calls preserve rows');
  console.log(`PASS: ${checks} isolated external-links owner/public/privacy/validation/legacy/rollback checks; no real database connection.`);
} finally { await pg.close(); }
