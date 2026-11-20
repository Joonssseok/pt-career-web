// Isolated only: node tests/helpers/check-detail-editor-tools-sql.mjs [path/to/pglite/dist/index.js]
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
  const module = { exports: {} }; modules.set(path, module);
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, URL,
    require: (name) => {
      assert.ok(name.startsWith('.'), 'validator imports must remain local');
      return loadTS(resolve(dirname(path), `${name}.ts`));
    },
  }, { filename: path });
  return module.exports;
}
const { validateDetailDocument } = loadTS('lib/profile-versions/detail-document.ts');
const { introductionText } = loadTS('lib/profile-versions/introduction-format.ts');
const pglitePath = resolve(process.argv[2] || '../introduction-sql-check/node_modules/@electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(pglitePath).href);
const pg = await PGlite.create();
const migrations = await readdir('supabase/migrations');
const postsEditor = migrations.find((file) => /^\d+_profile_post_editor_tools\.sql$/.test(file));
assert.ok(postsEditor, 'posts editor dependency');
const detailMigration = 'supabase/migrations/20261120114023_detail_editor_tools.sql';
let checks = 0;
function eq(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
async function scalar(sql, params = []) { return (await pg.query(sql, params)).rows[0]?.v; }
const doc = (...content) => ({ type: 'doc', content });
const text = (value = 'Text', marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const p = (...content) => ({ type: 'paragraph', content });
const cell = (content = [p(text('Cell'))], attrs = {}) => ({ type: 'tableCell', attrs, content });
const row = (...content) => ({ type: 'tableRow', content });
const table = (...content) => ({ type: 'table', content });
const code = (value = 'const answer = 42;') => ({ type: 'codeBlock', attrs: { language: 'typescript' }, content: [text(value)] });
const file = '44444444-4444-4444-8444-444444444444';
const image = (mime = 'image/png', attrs = {}) => ({ type: 'profileMedia', attrs: { fileId: file, mime, ...attrs } });
const youtube = (attrs = {}) => ({ type: 'youtubeVideo', attrs: { videoId: 'abcdefghijk', ...attrs } });
const link = (href, attrs = {}) => ({ type: 'link', attrs: { href, ...attrs } });
async function valid(value, expected, label) {
  eq(validateDetailDocument(value).ok, expected, `JS: ${label}`);
  eq(await scalar('select public.profile_detail_document_valid($1::jsonb) v', [JSON.stringify(value)]), expected, `SQL: ${label}`);
}
try {
  await pg.exec(`create role anon; create role authenticated; create role service_role;
    create schema posts_private;
    revoke all on schema posts_private from public,anon,authenticated,service_role;
    alter default privileges in schema posts_private revoke execute on functions from public;
    create table public.detail_fixture(id integer primary key,content jsonb);`);
  const formatting = await readFile('supabase/migrations/20261118115925_introduction_formatting.sql', 'utf8');
  await pg.exec(formatting.slice(0, formatting.indexOf('REVOKE ALL')));
  await pg.exec(await readFile('supabase/migrations/20261119150930_youtube_video_width.sql', 'utf8'));
  await pg.exec(`revoke all on function public.profile_detail_document_valid(jsonb) from public,anon;
    grant execute on function public.profile_detail_document_valid(jsonb) to authenticated;`);
  await pg.exec(await readFile(`supabase/migrations/${postsEditor}`, 'utf8'));
  const legacy = doc(p(text('Legacy detail', [{ type: 'bold' }])), image('video/mp4'), youtube({ widthPercent: 50 }));
  await pg.query('insert into public.detail_fixture values(1,$1::jsonb)', [JSON.stringify(legacy)]);
  const acl = await scalar("select proacl::text v from pg_proc where oid='public.profile_detail_document_valid(jsonb)'::regprocedure");
  const introDefinition = await scalar("select pg_get_functiondef('public.profile_introduction_format_text(jsonb,text,integer)'::regprocedure) v");
  await pg.exec(await readFile(detailMigration, 'utf8'));
  eq(await scalar('select content v from public.detail_fixture where id=1'), legacy, 'existing document unchanged');
  eq(await scalar("select proacl::text v from pg_proc where oid='public.profile_detail_document_valid(jsonb)'::regprocedure"), acl, 'detail function grants unchanged');
  eq(await scalar("select pg_get_functiondef('public.profile_introduction_format_text(jsonb,text,integer)'::regprocedure) v"), introDefinition, 'introduction validator unchanged');
  eq(await scalar("select has_function_privilege('authenticated','posts_private.editor_document_valid(jsonb)','execute') v"), false, 'posts helper remains private');
  const rich = doc(
    { type: 'heading', attrs: { level: 2, textAlign: 'justify' }, content: [text('Rich detail')] },
    p(text('Safe link', [link('https://example.com/path', { target: '_blank', rel: 'noopener noreferrer nofollow' })])),
    p(text('Font', [{ type: 'textStyle', attrs: { fontFamily: 'var(--font-profile-display)', fontSize: '22px', color: '#2563eb' } }, { type: 'code' }])),
    { type: 'blockquote', content: [p(text('Quote')), { type: 'orderedList', attrs: { start: 2 }, content: [{ type: 'listItem', content: [p(text('Item')), code()] }] }] },
    table(row({ type: 'tableHeader', attrs: { colspan: 2, rowspan: 1, colwidth: [100, 200] }, content: [p(text('Header'))] }), row(cell([code('table_code()')]), cell())),
    code(), image('video/webm'), youtube({ widthPercent: 60 }),
  );
  await valid(legacy, true, 'legacy media document');
  await valid(rich, true, 'rich table/link/code/fonts/justify mixed with video files');
  await pg.exec('set role authenticated');
  try { eq(await scalar('select public.profile_detail_document_valid($1) v', [JSON.stringify(rich)]), true, 'authenticated entry point works without private helper grant'); }
  finally { await pg.exec('reset role'); }
  await pg.exec('set role anon');
  try { await assert.rejects(pg.query('select public.profile_detail_document_valid($1)', [JSON.stringify(rich)]), (error) => error.code === '42501'); checks++; }
  finally { await pg.exec('reset role'); }
  for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']) await valid(doc(image(mime)), true, `original MIME ${mime}`);
  await valid(doc(image('image/gif', { widthPercent: 50, crop: { x: 10, y: 5, width: 60, height: 80 } })), true, 'image presentation');
  await valid(doc(...Array.from({ length: 20 }, () => youtube())), true, '20 media allowed');
  await valid(doc(...Array.from({ length: 21 }, () => youtube())), false, '21 media rejected');
  await valid(doc(image(), image()), false, 'duplicate file ID');
  for (const attrs of [
    { widthPercent: null }, { widthPercent: 9 }, { widthPercent: 101 }, { widthPercent: 50.5 },
    { widthPercent: '50' }, { crop: null }, { crop: { x: 90, y: 0, width: 20, height: 100 } },
    { crop: { x: 0, y: 0, width: 50, height: 100, src: 'https://evil.example' } },
  ]) await valid(doc(image('image/png', attrs)), false, 'invalid image geometry');
  await valid(doc(image('video/mp4', { widthPercent: 50 })), false, 'video file width prohibited');
  await valid(doc(image('video/webm', { crop: { x: 0, y: 0, width: 100, height: 100 } })), false, 'video file crop prohibited');
  await valid(doc(youtube({ widthPercent: null })), false, 'original YouTube null width rejected');
  await valid(doc(youtube({ widthPercent: 9 })), false, 'YouTube width bounds');
  for (const node of [
    { type: 'script', content: [] }, { type: 'html', text: '<b>raw</b>' },
    { type: 'image', attrs: { src: 'https://evil.example/photo.png' } },
    image('image/png', { onerror: 'bad()' }),
    { type: 'paragraph', attrs: { style: 'color:red' }, content: [] },
    p(text('bad', [link('javascript:alert(1)')])), p(text('bad', [link('data:text/html,bad')])),
    p(text('bad', [link('https://user:pass@example.com')])),
    p(text('bad', [{ type: 'textStyle', attrs: { fontFamily: 'Arial' } }])),
    { type: 'heading', attrs: { level: '2' }, content: [] },
    { type: 'codeBlock', content: [text('bad', [{ type: 'bold' }])] },
    table(row(cell([p()], { colspan: 101 }))),
    { type: 'blockquote', content: [image()] }, table(row(cell([youtube()]))),
  ]) await valid(doc(node), false, 'closed rich schema rejection');
  await valid(doc(p(text('a'.repeat(5000)))), true, '5000 text units');
  await valid(doc(p(text('a'.repeat(5001)))), false, '5001 text units');
  await valid(doc(p(text('😀'.repeat(2500)))), true, '5000 UTF-16 units');
  await valid(doc(p(text('😀'.repeat(2501)))), false, '5002 UTF-16 units');
  const exactTableText = doc(table(row(cell([p(text('a'.repeat(2500)))]), cell([code('b'.repeat(2500))]))));
  eq(introductionText(exactTableText).length, 5000, 'table and code have no added separators');
  await valid(exactTableText, true, 'table/code exact text bound');
  await valid(doc(table(row(cell([p(text('a'.repeat(5001)))])))), false, 'table text exceeds bound');
  await valid(doc(p(text('a'.repeat(2499))), p(text('b'.repeat(2500)))), true, 'document separator counts toward 5000');
  await valid(doc(p(text('a'.repeat(2500))), p(text('b'.repeat(2500)))), false, 'document separator makes 5001');
  function nested(depth) { let node = p(text('Depth')); for (let i = 0; i < depth; i++) node = { type: 'blockquote', content: [node] }; return doc(node); }
  await valid(nested(10), true, 'depth exactly 12');
  await valid(nested(11), false, 'depth 13 rejected');
  await valid(doc(...Array.from({ length: 2499 }, () => p())), true, '2500 nodes including root');
  await valid(doc(...Array.from({ length: 2500 }, () => p())), false, '2501 nodes rejected');
  await valid(doc(), false, 'original empty document rejected');
  const longLink = link(`https://example.com/${'a'.repeat(1900)}`);
  await valid(doc(p(...Array.from({ length: 55 }, () => text('a', [longLink])))), false, 'original 100k JSON bound');
  console.log(`PASS: ${checks} isolated detail-editor SQL/JS parity/media/bounds/ACL checks; no real database connection.`);
} finally { await pg.close(); }

// Run the unchanged existing media/ownership/snapshot suite with real new dependencies.
const previousSuite = await readFile('tests/helpers/check-detail-rich-media.mjs', 'utf8');
const marker = "await pg.exec(await readFile('supabase/migrations/20261118130222_image_presentation.sql','utf8'));";
assert.ok(previousSuite.includes(marker), 'existing detail suite bootstrap changed');
const injected = previousSuite.replace('resolve(process.argv[2])', `resolve(${JSON.stringify(pglitePath)})`).replace(marker, `${marker}
await pg.exec('create role service_role; create schema posts_private; alter default privileges in schema posts_private revoke execute on functions from public;');
await pg.exec(await readFile('supabase/migrations/20261119150930_youtube_video_width.sql','utf8'));
await pg.exec(await readFile(${JSON.stringify(`supabase/migrations/${postsEditor}`)},'utf8'));
await pg.exec(await readFile(${JSON.stringify(detailMigration)},'utf8'));`);
await import(`data:text/javascript;base64,${Buffer.from(injected).toString('base64')}`);
