// Empty, isolated PGlite only. No real database connection or production credentials.
// node tests/helpers/check-post-editor-tools-sql.mjs [path/to/pglite/dist/index.js]
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const modules = new Map();
function loadTS(file) {
  const path = resolve(file);
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} };
  modules.set(path, module);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, {
    module, exports: module.exports, URL,
    require: (name) => {
      assert.ok(name.startsWith('.'), 'validator dependencies must be local');
      return loadTS(resolve(dirname(path), `${name}.ts`));
    },
  }, { filename: path });
  return module.exports;
}
const { validatePostDocument } = loadTS('lib/profile-post-document.ts');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2] || '../introduction-sql-check/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg = await PGlite.create();
let checks = 0;
function eq(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
async function scalar(sql, params = []) { return (await pg.query(sql, params)).rows[0]?.v; }
async function as(role, sql, params = []) {
  const uid = await scalar("select current_setting('request.jwt.claim.sub',true) v");
  if (role === 'anon') await pg.query("select set_config('request.jwt.claim.sub','',false)");
  await pg.exec(`set role ${role}`);
  try { return (await pg.query(sql, params)).rows[0]?.v; }
  finally {
    await pg.exec('reset role');
    if (role === 'anon') await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || '']);
  }
}
async function fails(sql, params, code = '22023', role = 'authenticated') {
  await assert.rejects(as(role, sql, params), (error) => error.code === code);
  checks++;
}
const doc = (...content) => ({ type: 'doc', content });
const text = (value = 'Text', marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content) => ({ type: 'paragraph', content });
const mark = (type, attrs) => ({ type, ...(attrs ? { attrs } : {}) });
const link = (href, extra = {}) => mark('link', { href, ...extra });
const cell = (type = 'tableCell', attrs = {}) => ({ type, attrs, content: [paragraph(text('Table value'))] });
const row = (...content) => ({ type: 'tableRow', content });
const table = (...content) => ({ type: 'table', content });
const code = (value = 'const answer = 42;', attrs = { language: 'typescript' }) => ({ type: 'codeBlock', attrs, content: [text(value)] });
const imageId = '20000000-0000-0000-0000-000000000001';
const image = (extra = {}) => ({ type: 'profileMedia', attrs: { fileId: imageId, mime: 'image/png', ...extra } });
const youtube = { type: 'youtubeVideo', attrs: { videoId: 'abcdefghijk', widthPercent: 80 } };
const body = (document, title = 'Editor post') => ({ title, document, category: 'news', tags: ['editor'] });
const u1 = '00000000-0000-0000-0000-000000000001';
const u2 = '00000000-0000-0000-0000-000000000002';
const profile = '10000000-0000-0000-0000-000000000001';
async function claim(uid) { await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]); }
async function save(post, document, publish = false) {
  return as('authenticated', "select public.save_profile_post($1,$2::jsonb,$3,'public',$4) v", [post.id, JSON.stringify(body(document)), publish, post.updatedAt]);
}
async function valid(document, expected, label) {
  eq(validatePostDocument(document).ok, expected, `JS schema: ${label}`);
  eq(await scalar('select posts_private.editor_document_valid($1::jsonb) v', [JSON.stringify(document)]), expected, `SQL schema: ${label}`);
}
try {
  await pg.exec(await readFile('tests/profile-videos-fixture.sql', 'utf8'));
  await pg.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  const migrations = await readdir('supabase/migrations');
  for (const suffix of ['profile_videos.sql']) {
    const name = migrations.find((file) => file.endsWith(`_${suffix}`));
    assert.ok(name, `missing ${suffix}`);
    await pg.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  }
  const formatting = await readFile('supabase/migrations/20261118115925_introduction_formatting.sql', 'utf8');
  await pg.exec(formatting.slice(0, formatting.indexOf('REVOKE ALL')));
  await pg.exec(await readFile('supabase/migrations/20261119150930_youtube_video_width.sql', 'utf8'));
  const postsMigration = migrations.find((file) => /^\d+_profile_posts\.sql$/.test(file));
  assert.ok(postsMigration, 'existing posts migration');
  await pg.exec(await readFile(`supabase/migrations/${postsMigration}`, 'utf8'));
  await claim(u1);
  let post = await as('authenticated', 'select public.create_profile_post() v');
  const legacy = doc(paragraph(text('Legacy published body', [mark('bold')])));
  post = await save(post, legacy, true);
  const storedPublished = await scalar('select published v from posts_private.posts where id=$1', [post.id]);
  const originalValidator = await scalar("select pg_get_functiondef('public.profile_detail_document_valid(jsonb)'::regprocedure) v");
  const previousACL = await scalar("select jsonb_object_agg(oid::text,coalesce(proacl::text,'')) v from pg_proc where pronamespace='posts_private'::regnamespace");
  await pg.exec(await readFile('supabase/migrations/20261120110823_profile_post_editor_tools.sql', 'utf8'));
  eq(await scalar('select published v from posts_private.posts where id=$1', [post.id]), storedPublished, 'migration preserves published snapshot');
  eq(await scalar("select pg_get_functiondef('public.profile_detail_document_valid(jsonb)'::regprocedure) v"), originalValidator, 'existing profile validator unchanged');
  for (const [oid, acl] of Object.entries(previousACL)) eq(await scalar('select coalesce(proacl::text,\'\') v from pg_proc where oid=$1::oid', [oid]), acl, 'existing function privileges unchanged');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of ['posts_private.editor_node_valid(jsonb,text,integer)', 'posts_private.editor_document_valid(jsonb)', 'posts_private.editor_link_valid(text)']) {
      eq(await scalar('select has_function_privilege($1,$2,\'execute\') v', [role, signature]), false, 'new validators private');
    }
  }
  const rich = doc(
    { type: 'heading', attrs: { level: 2, textAlign: 'justify' }, content: [text('Heading')] },
    paragraph(text('Safe link', [link('https://example.com/path?q=1#part', { target: '_blank', rel: 'noopener noreferrer nofollow' })])),
    paragraph(text('Display font', [mark('textStyle', { fontFamily: 'var(--font-profile-display)', fontSize: '22px', color: '#2563eb' }), mark('highlight', { color: '#fef08a' })])),
    { type: 'blockquote', content: [paragraph(text('Quote')), { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('List')), code()] }] }] },
    table(row(cell('tableHeader', { colspan: 2, rowspan: 1, colwidth: [100, 200] })), row({ type: 'tableCell', content: [paragraph(text('Nested cell body')), code('table_code()')] }, cell())),
    code(), youtube,
  );
  for (const [name, document] of [
    ['empty draft', doc()], ['legacy', legacy], ['rich table/link/code/font/justify', rich],
    ['inline code', doc(paragraph(text('code', [mark('code')])))],
    ['all eight distinct marks', doc(paragraph(text('marked', ['bold', 'italic', 'underline', 'strike', 'code'].map((t) => mark(t)).concat([mark('highlight', { color: '#bbf7d0' }), mark('textStyle', { fontFamily: 'inherit' }), link('http://example.com')]))))],
    ['empty code block', doc({ type: 'codeBlock', attrs: { language: null }, content: [] })],
    ['cell bounds', doc(table(row(cell('tableHeader', { colspan: 100, rowspan: 200, colwidth: [25, 2000] }))))],
    ['image presentation', doc(image({ widthPercent: 50, crop: { x: 0, y: 1, width: 100, height: 99 } }))],
    ['image no presentation', doc(image())], ['YouTube', doc(youtube)],
    ['null optional attrs', doc({ type: 'paragraph', attrs: null, content: [text('Nullable', [{ type: 'textStyle', attrs: null }])] })],
    ['IPv6 link', doc(paragraph(text('link', [link('https://[::1]:443/path')])))]
  ]) await valid(document, true, name);
  const badDocs = [
    ['heading string level 2', doc({ type: 'heading', attrs: { level: '2' }, content: [text('Heading')] })],
    ['heading string level 3', doc({ type: 'heading', attrs: { level: '3' }, content: [text('Heading')] })],
    ['script node', doc({ type: 'script', content: [] })],
    ['HTML node', doc({ type: 'html', text: '<b>raw</b>' })],
    ['raw HTML field', { ...doc(paragraph()), html: '<script>bad</script>' }],
    ['onerror image', doc(image({ onerror: 'bad()' }))],
    ['external photo', doc({ type: 'image', attrs: { src: 'https://example.com/photo.png' } })],
    ['raw style', doc({ type: 'paragraph', attrs: { style: 'color:red' }, content: [] })],
    ['font injection', doc(paragraph(text('bad', [mark('textStyle', { fontFamily: 'url(https://evil.example)' })])))],
    ['wrong font', doc(paragraph(text('bad', [mark('textStyle', { fontFamily: 'Arial' })])))],
    ['wrong color', doc(paragraph(text('bad', [mark('textStyle', { color: 'red' })])))],
    ['JS link', doc(paragraph(text('bad', [link('javascript:alert(1)')])))],
    ['data link', doc(paragraph(text('bad', [link('data:text/html,bad')])))],
    ['link credentials', doc(paragraph(text('bad', [link('https://user:pass@example.com/path')])))],
    ['protocol relative', doc(paragraph(text('bad', [link('//example.com')])) )],
    ['link whitespace', doc(paragraph(text('bad', [link('https://example.com/a b')])))],
    ['link control', doc(paragraph(text('bad', [link('https://example.com/a\nb')])))],
    ['link backslash', doc(paragraph(text('bad', [link('https://example.com/a\\b')])))],
    ['link angle', doc(paragraph(text('bad', [link('https://example.com/<bad>')])))],
    ['link too long', doc(paragraph(text('bad', [link(`https://example.com/${'a'.repeat(2048)}`)])))],
    ['link unsafe rel', doc(paragraph(text('bad', [link('https://example.com', { rel: 'opener' })])))],
    ['link unsafe target', doc(paragraph(text('bad', [link('https://example.com', { target: '_self' })])))],
    ['duplicate marks', doc(paragraph(text('bad', [mark('bold'), mark('bold')])) )],
    ['code with marks', doc({ type: 'codeBlock', content: [text('bad', [mark('bold')])] })],
    ['code with breaks', doc({ type: 'codeBlock', content: [{ type: 'hardBreak' }] })],
    ['invalid language', doc(code('bad', { language: 'html onclick=bad' }))],
    ['fractional colspan', doc(table(row(cell('tableCell', { colspan: 1.5 }))))],
    ['colspan zero', doc(table(row(cell('tableCell', { colspan: 0 }))))],
    ['colspan overflow', doc(table(row(cell('tableCell', { colspan: 101 }))))],
    ['rowspan overflow', doc(table(row(cell('tableCell', { rowspan: 201 }))))],
    ['colwidth low', doc(table(row(cell('tableCell', { colwidth: [24] }))))],
    ['colwidth high', doc(table(row(cell('tableCell', { colwidth: [2001] }))))],
    ['colwidth fractional', doc(table(row(cell('tableCell', { colwidth: [25.5] }))))],
    ['colwidth count', doc(table(row(cell('tableCell', { colwidth: Array(101).fill(100) }))))],
    ['table 201 rows', doc(table(...Array.from({ length: 201 }, () => row(cell()))))],
    ['table 101 cells', doc(table(row(...Array.from({ length: 101 }, () => cell()))))],
    ['table empty', doc(table())],
    ['nested table not in schema', doc(table(row({ type: 'tableCell', content: [table(row(cell()))] })))],
    ['nested image', doc({ type: 'blockquote', content: [image()] })],
    ['nested YouTube', doc(table(row({ type: 'tableCell', content: [youtube] })))],
    ['video file', doc(image({ mime: 'video/mp4' }))],
    ['null image width', doc(image({ widthPercent: null }))],
    ['image crop overflow', doc(image({ crop: { x: 90, y: 0, width: 20, height: 100 } }))],
    ['wrong YouTube ID', doc({ type: 'youtubeVideo', attrs: { videoId: 'https://example.com' } })],
    ['oversize JSON', doc(paragraph(text('a'.repeat(1000001))))],
  ];
  for (const [name, document] of badDocs) await valid(document, false, name);
  function nested(depth) { let node = paragraph(text('Depth')); for (let i = 0; i < depth; i++) node = { type: 'blockquote', content: [node] }; return doc(node); }
  await valid(nested(14), true, 'depth exactly 16');
  await valid(nested(15), false, 'depth over 16');
  await valid(doc(...Array.from({ length: 9999 }, () => paragraph())), true, '10000 nodes including root');
  await valid(doc(...Array.from({ length: 10000 }, () => paragraph())), false, '10001 nodes');

  post = await save(post, rich, false);
  eq(await as('anon', 'select public.get_profile_post($1,$2) v', [profile, post.id]).then((r) => r.document), legacy, 'new editor draft does not change published document');
  eq((await as('authenticated', 'select public.get_profile_post($1,$2,true) v', [profile, post.id])).document, rich, 'new editor draft round trip');
  post = await save(post, rich, true);
  const published = await as('anon', 'select public.get_profile_post($1,$2) v', [profile, post.id]);
  eq(published.document, rich, 'new editor publish/read round trip');
  eq(published.summary.includes('Table value'), true, 'table text appears in summary');
  eq(published.summary.includes('table_code()'), true, 'code text appears in summary');
  eq((await as('anon', 'select public.list_profile_posts($1,false,0,10,$2) v', [profile, 'table_code()'])).length, 1, 'recursive text searchable');
  for (const [, bad] of badDocs.slice(0, 15)) {
    await fails("select public.save_profile_post($1,$2::jsonb,true,'public',$3) v", [post.id, JSON.stringify(body(bad)), post.updatedAt]);
  }
  eq((await as('anon', 'select public.get_profile_post($1,$2) v', [profile, post.id])).document, rich, 'invalid saves preserve published snapshot');
  const reservation = await as('authenticated', "select public.reserve_profile_post_image($1,$2,'photo.png','image/png') v", [imageId, post.id]);
  await fails("select public.save_profile_post($1,$2::jsonb,false,'public',$3) v", [post.id, JSON.stringify(body(doc(image()))), post.updatedAt]);
  await pg.query("insert into storage.objects(bucket_id,name,metadata) values('profile-post-images',$1,'{\"size\":123,\"mimetype\":\"image/png\"}')", [reservation.path]);
  await as('authenticated', 'select public.finish_profile_post_image($1)', [imageId]);
  post = await save(post, doc(...rich.content, image()), true);
  eq((await as('anon', 'select public.get_profile_post($1,$2) v', [profile, post.id])).images.length, 1, 'owned ready image remains supported');
  await fails("select public.save_profile_post($1,$2::jsonb,true,'public',$3) v", [post.id, JSON.stringify(body(doc({ type: 'blockquote', content: [image()] }))), post.updatedAt]);
  await claim(u2);
  const other = await as('authenticated', 'select public.create_profile_post() v');
  await fails("select public.save_profile_post($1,$2::jsonb,true,'public',$3) v", [other.id, JSON.stringify(body(doc(image()))), other.updatedAt]);
  console.log(`PASS: ${checks} isolated PostgreSQL editor schema/JS parity/bounds/ownership/snapshot checks; no real database connection.`);
} finally {
  await pg.close();
}
