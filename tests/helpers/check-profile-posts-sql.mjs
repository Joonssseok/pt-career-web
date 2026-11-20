// Isolated only: node tests/helpers/check-profile-posts-sql.mjs [path/to/pglite/dist/index.js]
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2] || '../introduction-sql-check/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg = await PGlite.create();
let checks = 0;
const u1 = '00000000-0000-0000-0000-000000000001';
const u2 = '00000000-0000-0000-0000-000000000002';
const profile = '10000000-0000-0000-0000-000000000001';
const profile2 = '10000000-0000-0000-0000-000000000002';
const image1 = '20000000-0000-0000-0000-000000000001';
const image2 = '20000000-0000-0000-0000-000000000002';
const image3 = '20000000-0000-0000-0000-000000000003';
const missing = '20000000-0000-0000-0000-000000000099';
const blank = { title: '', document: { type: 'doc', content: [] }, category: '', tags: [] };
const textNode = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const photo = (id, mime = 'image/png') => ({ type: 'profileMedia', attrs: { fileId: id, mime } });
const content = (title, nodes = [textNode('Published body')]) => ({ title, document: { type: 'doc', content: nodes }, category: 'news', tags: ['tag'] });
async function run(role, sql, params = []) {
  const previousUid = (await pg.query("select current_setting('request.jwt.claim.sub',true) uid")).rows[0].uid || '';
  if (role === 'anon') await claim('');
  await pg.exec(`set role ${role}`);
  try { return (await pg.query(sql, params)).rows; }
  finally {
    await pg.exec('reset role');
    if (role === 'anon') await claim(previousUid);
  }
}
async function value(role, sql, params = []) { return (await run(role, sql, params))[0]?.v; }
function eq(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
async function fails(role, sql, params = [], code = '42501') {
  await assert.rejects(run(role, sql, params), (error) => error.code === code);
  checks++;
}
async function claim(uid) { await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]); }
async function create() { return value('authenticated', 'select public.create_profile_post() v'); }
async function save(post, body, publish = false, visibility = 'public', expected = post.updatedAt) {
  return value('authenticated', 'select public.save_profile_post($1,$2::jsonb,$3,$4,$5::timestamptz) v',
    [post.id, JSON.stringify(body), publish, visibility, expected]);
}
async function get(post, own = false, who = own ? 'authenticated' : 'anon') {
  return value(who, 'select public.get_profile_post($1,$2,$3) v', [profile, post.id, own]);
}
async function list(own = false, query = null, category = null) {
  return value(own ? 'authenticated' : 'anon', 'select public.list_profile_posts($1,$2,0,100,$3,$4) v', [profile, own, query, category]);
}
async function reserve(id, post, mime = 'image/png') {
  return value('authenticated', 'select public.reserve_profile_post_image($1,$2,$3,$4) v', [id, post.id, 'photo.png', mime]);
}
async function upload(path, size = 123, mime = 'image/png') {
  return run('authenticated', "insert into storage.objects(bucket_id,name,metadata) values('profile-post-images',$1,$2::jsonb)",
    [path, JSON.stringify({ size, mimetype: mime })]);
}
async function finish(id) { await run('authenticated', 'select public.finish_profile_post_image($1)', [id]); }
async function imagePath(id, role = 'anon') { return value(role, 'select public.profile_post_image_path($1) v', [id]); }
async function storageCount(path, role = 'anon') {
  return Number(await value(role, "select count(*)::int v from storage.objects where bucket_id='profile-post-images' and name=$1", [path]));
}
try {
  await pg.exec(await readFile('tests/profile-videos-fixture.sql', 'utf8'));
  await pg.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create policy adversarial_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true);
    insert into storage.buckets values('existing-bucket','Existing',false,1234,array['text/plain']);
    insert into storage.objects(bucket_id,name,metadata) values('existing-bucket','unchanged','{"size":7}');`);
  const files = await readdir('supabase/migrations');
  const videoMigration = files.find((file) => /^\d+_profile_videos\.sql$/.test(file));
  assert.ok(videoMigration, 'existing video migration');
  await pg.exec(await readFile(`supabase/migrations/${videoMigration}`, 'utf8'));
  // Load the actual strict validators, not a permissive fixture stub.
  const formatting = await readFile('supabase/migrations/20261118115925_introduction_formatting.sql', 'utf8');
  await pg.exec(formatting.slice(0, formatting.indexOf('REVOKE ALL')));
  await pg.exec(await readFile('supabase/migrations/20261119150930_youtube_video_width.sql', 'utf8'));
  await pg.exec(await readFile('supabase/migrations/20261120102049_profile_posts.sql', 'utf8'));
  await pg.exec(await readFile('supabase/migrations/20261120110823_profile_post_editor_tools.sql', 'utf8'));

  eq(await value('postgres', "select count(*)::int v from pg_class where relnamespace='posts_private'::regnamespace and relkind='r' and relrowsecurity"), 3, 'RLS on posts, files and cleanup tombstones');
  eq(await value('postgres', "select bool_or(prosecdef) v from pg_proc where pronamespace='public'::regnamespace and proname in ('create_profile_post','save_profile_post','list_profile_posts','get_profile_post','delete_profile_post','reserve_profile_post_image','finish_profile_post_image','profile_post_image_path','profile_post_cleanup_batch','ack_profile_post_cleanup')"), false, 'public invoker wrappers');
  eq(await value('postgres', "select has_function_privilege('authenticated','video_private.own_profile(boolean)','execute') v"), false, 'video helper remains private');
  eq(await value('postgres', "select has_function_privilege('anon','posts_private.read_posts(uuid,boolean,uuid,integer,integer,text,text)','execute') v"), false, 'internal reader not granted');
  eq(await value('postgres', "select has_table_privilege('authenticated','posts_private.posts','select,insert,update,delete') v"), false, 'no posts grants');
  eq(await value('postgres', "select has_table_privilege('anon','posts_private.files','select,insert,update,delete') v"), false, 'no file grants');
  eq(await value('postgres', "select has_table_privilege('service_role','posts_private.file_cleanup','select,insert,update,delete') v"), false, 'no direct cleanup grants even for worker');
  for (const role of ['anon', 'authenticated']) {
    await fails(role, 'select public.profile_post_cleanup_batch()');
    await fails(role, 'select public.ack_profile_post_cleanup($1)', [image1]);
    await fails(role, 'select posts_private.profile_post_cleanup_batch()');
    await fails(role, 'select posts_private.ack_profile_post_cleanup($1)', [image1]);
  }
  await fails('service_role', 'select public.profile_post_cleanup_batch(101)', [], '22023');
  eq(await value('service_role', 'select public.profile_post_cleanup_batch() v'), [], 'empty worker queue without auth UID');
  eq(await value('postgres', "select file_size_limit v from storage.buckets where id='profile-post-images'"), null, 'platform default size');
  await fails('anon', 'select public.create_profile_post()');
  await fails('authenticated', 'select public.create_profile_post()');
  await claim(u1);
  let post = await create();
  eq(Object.keys(post).sort(), ['id', 'updatedAt'], 'create DTO');
  eq(await get(post), null, 'empty draft not public');
  eq((await get(post, true)).status, 'draft', 'own empty draft');
  post = await save(post, blank, false, 'private');
  await fails('authenticated', 'select public.save_profile_post($1,$2,true,\'public\',$3)', [post.id, JSON.stringify(blank), post.updatedAt], '22023');
  post = await save(post, content('Published title'), true);
  eq((await get(post)).title, 'Published title', 'published snapshot');
  const published = await get(post);
  post = await save(post, content('Secret draft', [textNode('Secret draft body')]), false);
  eq((await get(post)).title, published.title, 'draft edits do not replace published title');
  eq((await get(post)).document, published.document, 'draft edits do not replace published document');
  post = await save(post, content('Secret draft', [textNode('Secret draft body')]), false, 'private');
  eq((await get(post)).visibility, 'public', 'draft private input preserves public visibility');
  eq((await get(post)).document, published.document, 'draft private input preserves public body');
  eq((await get(post)).publishedAt, published.publishedAt, 'draft preserves first publication time');
  eq((await get(post, true)).title, 'Secret draft', 'owner gets draft');
  eq((await list(false, 'Secret draft')).length, 0, 'public search ignores draft');
  eq((await list(false, 'published BODY')).length, 1, 'public literal body search');
  eq((await list(false, '%')).length, 0, 'query percent literal');
  eq((await list(false, null, 'missing')).length, 0, 'category filtering');
  const stale = post;
  post = await save(post, content('Private revision'), true, 'private');
  eq((await get(post, true)).publishedAt, published.publishedAt, 'republish preserves first publication time');
  post = await save(post, content('Private new draft'), false, 'public');
  eq((await get(post, true)).visibility, 'private', 'draft public input preserves private publication');
  eq(await get(post), null, 'draft public input cannot expose private publication');
  eq((await list(false)).length, 0, 'draft public input cannot expose private list');
  await fails('authenticated', "select public.save_profile_post($1,$2,true,'public',$3)", [post.id, JSON.stringify(content('Stale publish')), stale.updatedAt], '40001');
  eq(await get(post), null, 'stale edit cannot republish');
  eq((await get(post, true)).visibility, 'private', 'current private remains');
  post = await save(post, content('Published title'), true);
  await pg.query('update posts_private.posts set admin_hidden=true where id=$1', [post.id]);
  post = await save(post, content('Hidden edit'), true);
  eq(await get(post), null, 'admin hide preserved');
  eq((await get(post, true)).adminHidden, true, 'owner sees moderation');
  await pg.query('update posts_private.posts set admin_hidden=false where id=$1', [post.id]);

  await claim(u2);
  await fails('authenticated', 'select public.get_profile_post($1,$2,true)', [profile, post.id]);
  await fails('authenticated', "select public.save_profile_post($1,$2,true,'public',$3)", [post.id, JSON.stringify(content('Stolen')), post.updatedAt]);
  await fails('authenticated', 'select public.delete_profile_post($1,$2)', [post.id, post.updatedAt]);
  await fails('authenticated', "select public.reserve_profile_post_image($1,$2,'photo.png','image/png')", [image1, post.id]);
  const other = await create();
  const foreignFile = await reserve(image2, other);
  await upload(foreignFile.path);
  await finish(image2);
  await claim(u1);
  await fails('authenticated', "select public.save_profile_post($1,$2,false,'private',$3)", [post.id, JSON.stringify(content('Foreign', [photo(image2)])), post.updatedAt], '22023');
  await fails('authenticated', "select public.save_profile_post($1,$2,false,'private',$3)", [post.id, JSON.stringify(content('Missing', [photo(missing)])), post.updatedAt], '22023');
  for (const id of [image2, missing]) {
    await fails('authenticated', "select public.save_profile_post($1,$2,true,'public',$3)", [post.id, JSON.stringify(content('Invalid publish ref', [photo(id)])), post.updatedAt], '22023');
  }
  await fails('authenticated', "select public.reserve_profile_post_image($1,$2,'bad.mp4','video/mp4')", [image1, post.id], '22023');
  const reserved = await reserve(image1, post);
  eq(reserved, { path: image1, ready: false }, 'opaque file UUID path contains no owner identity');
  eq(await imagePath(image1, 'authenticated'), null, 'not ready file not downloadable');
  await fails('authenticated', 'select public.finish_profile_post_image($1)', [image1], '22023');
  await fails('authenticated', "select public.save_profile_post($1,$2,false,'private',$3)", [post.id, JSON.stringify(content('Not ready', [photo(image1)])), post.updatedAt], '22023');
  await fails('authenticated', "select public.save_profile_post($1,$2,true,'public',$3)", [post.id, JSON.stringify(content('Not ready publish', [photo(image1)])), post.updatedAt], '22023');
  await fails('authenticated', "insert into storage.objects(bucket_id,name,metadata) values('profile-post-images','unreserved','{}')");
  await fails('anon', "insert into storage.objects(bucket_id,name,metadata) values('profile-post-images',$1,'{}')", [reserved.path]);
  await upload(reserved.path, 0);
  await fails('authenticated', 'select public.finish_profile_post_image($1)', [image1], '22023');
  await pg.query("update storage.objects set metadata=$1::jsonb where bucket_id='profile-post-images' and name=$2", [JSON.stringify({ size: 123, mimetype: 'video/mp4' }), reserved.path]);
  await fails('authenticated', 'select public.finish_profile_post_image($1)', [image1], '22023');
  await pg.query("update storage.objects set metadata=$1::jsonb where bucket_id='profile-post-images' and name=$2", [JSON.stringify({ size: 123, mimetype: 'image/png' }), reserved.path]);
  await finish(image1);
  eq(await imagePath(image1), null, 'unpublished image path private');
  eq(await storageCount(reserved.path), 0, 'unpublished image direct storage denied');
  eq(await imagePath(image1, 'authenticated'), reserved.path, 'owner ready image allowed');
  const unrelated = await create();
  await fails('authenticated', "select public.save_profile_post($1,$2,false,'private',$3)", [unrelated.id, JSON.stringify(content('Wrong post', [photo(image1)])), unrelated.updatedAt], '22023');
  post = await save(post, content('Photo publication', [photo(image1)]), true);
  eq(await imagePath(image1), reserved.path, 'published image path public');
  eq(await storageCount(reserved.path), 1, 'published image direct storage allowed');
  // An inconsistent queued live reference must never be returned to the worker.
  await pg.query('insert into posts_private.file_cleanup(path) values($1)', [reserved.path]);
  eq(await value('service_role', 'select public.profile_post_cleanup_batch() v'), [], 'live file reference cannot be claimed');
  await run('service_role', 'select public.ack_profile_post_cleanup($1)', [reserved.path]);
  eq(await value('postgres', 'select done v from posts_private.file_cleanup where path=$1', [reserved.path]), false, 'live reference cannot be acknowledged');
  eq((await get(post)).images, [{ id: image1, name: '', size: 123, mime: 'image/png', src: `/api/profile-post-images/${image1}` }], 'anonymous image DTO hides original filename');
  eq((await get(post, true)).images[0].name, 'photo.png', 'owner image DTO preserves filename');
  eq(Object.keys(await get(post)).sort(), ['id', 'title', 'document', 'category', 'tags', 'summary', 'visibility', 'status', 'adminHidden', 'publishedAt', 'updatedAt', 'images'].sort(), 'safe post DTO');
  eq((await run('authenticated', "update storage.objects set metadata='{}' where name=$1 returning id", [reserved.path])).length, 0, 'immutable upload');
  eq((await run('authenticated', 'delete from storage.objects where name=$1 returning id', [reserved.path])).length, 0, 'no delete policy');
  await fails('authenticated', "insert into storage.objects(bucket_id,name,metadata) values('profile-post-images',$1,'{}')", [reserved.path]);
  const draftFile = await reserve(image3, post);
  await upload(draftFile.path);
  await finish(image3);
  post = await save(post, content('Draft new image', [photo(image3)]), false);
  eq(await imagePath(image1), reserved.path, 'old published image remains accessible during draft edits');
  eq(await imagePath(image3), null, 'draft-only image cannot leak');
  eq(await storageCount(draftFile.path), 0, 'draft-only direct storage denied');
  post = await save(post, content('Replacement image', [photo(image3)]), true);
  eq(await imagePath(image1), null, 'replaced published image revoked');
  eq(await imagePath(image3), draftFile.path, 'new publication grants exact image');

  for (const change of ['is_public=false', 'owner_visible=false', "verification_status='pending'", 'suspended_at=now()', 'deletion_requested_at=now()']) {
    await pg.exec(`update public.profiles set ${change} where user_id='${u1}'`);
    eq(await get(post), null, `public post gate ${change}`);
    eq(await imagePath(image3), null, `public image gate ${change}`);
    eq(await storageCount(draftFile.path), 0, `storage gate ${change}`);
    await fails('authenticated', 'select public.create_profile_post()');
    if (change.startsWith('suspended') || change.startsWith('deletion')) {
      await fails('authenticated', 'select public.get_profile_post($1,$2,true)', [profile, post.id]);
      eq(await imagePath(image3, 'authenticated'), null, 'blocked owner image denied');
    } else {
      eq((await get(post, true)).id, post.id, 'readonly private owner can read');
      eq(await imagePath(image3, 'authenticated'), draftFile.path, 'readonly private owner can download');
    }
    await pg.query("update public.profiles set is_public=true,owner_visible=true,verification_status='approved',suspended_at=null,deletion_requested_at=null where user_id=$1", [u1]);
  }
  for (const change of ['email_confirmed_at=null', 'is_anonymous=true', "banned_until=now()+interval '1 day'", 'deleted_at=now()']) {
    await pg.exec(`update auth.users set ${change} where id='${u1}'`);
    await fails('authenticated', 'select public.create_profile_post()');
    await fails('authenticated', 'select public.list_profile_posts($1,true)', [profile]);
    await pg.query('update auth.users set email_confirmed_at=now(),is_anonymous=false,banned_until=null,deleted_at=null where id=$1', [u1]);
  }

  const invalids = [
    { ...content('x'), unexpected: true }, { ...content('x'), title: 'x'.repeat(81) },
    { ...content('x'), category: 'x'.repeat(13) }, { ...content('x'), tags: Array(11).fill('tag') },
    { ...content('x'), tags: ['x'.repeat(21)] }, { ...content('x'), tags: [7] },
    content('x', [{ type: 'iframe', attrs: { src: 'https://evil.example' } }]),
    content('x', [{ type: 'youtubeVideo', attrs: { videoId: 'https://evil.example' } }]),
    content('x', [photo(image3, 'video/mp4')]),
    content('x', [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:bad' } }] }] }]),
    content('x', [textNode('x'.repeat(1000001))]),
  ];
  for (const bad of invalids) await fails('authenticated', "select public.save_profile_post($1,$2,false,'public',$3)", [post.id, JSON.stringify(bad), post.updatedAt], '22023');
  post = await save(post, content('YouTube only', [{ type: 'youtubeVideo', attrs: { videoId: 'abcdefghijk', widthPercent: 50 } }]), true);
  eq((await get(post)).title, 'YouTube only', 'YouTube-only publication');
  post = await save(post, content('Many media', Array.from({ length: 25 }, () => ({ type: 'youtubeVideo', attrs: { videoId: 'abcdefghijk' } }))), true);
  eq((await get(post)).document.content.length, 25, 'no inherited 20-media product cap');
  const manyImages = [];
  for (let index = 0; index < 25; index++) {
    const id = randomUUID();
    const image = await reserve(id, post);
    await upload(image.path, 123 + index);
    await finish(id);
    manyImages.push(photo(id));
  }
  post = await save(post, content('Many photos', manyImages), true);
  eq((await get(post)).images.length, 25, 'more than 20 real ready photo references allowed');
  await fails('authenticated', 'select public.delete_profile_post($1,$2)', [post.id, stale.updatedAt], '40001');
  await run('authenticated', 'select public.delete_profile_post($1,$2)', [post.id, post.updatedAt]);
  eq(await get(post), null, 'owned delete');
  eq(await imagePath(image3, 'authenticated'), null, 'post deletion revokes files');
  eq(await value('postgres', 'select count(*)::int v from posts_private.files where post_id=$1', [post.id]), 0, 'file metadata cascade');
  eq(await storageCount(draftFile.path, 'authenticated'), 0, 'retained storage bytes inaccessible after deletion');
  eq(await value('postgres', 'select count(*)::int v from posts_private.file_cleanup where path=$1 and not done', [draftFile.path]), 1, 'post cascade enqueues cleanup');
  const pendingCleanup = await value('service_role', 'select public.profile_post_cleanup_batch(100) v');
  eq(pendingCleanup.includes(draftFile.path), true, 'worker claims deleted post object');
  eq((await value('service_role', 'select public.profile_post_cleanup_batch(1) v')).length, 1, 'worker batch bound');
  await run('service_role', 'select public.ack_profile_post_cleanup($1)', [draftFile.path]);
  eq(await value('postgres', 'select done v from posts_private.file_cleanup where path=$1', [draftFile.path]), false, 'object still present prevents acknowledgement');
  await claim(u2);
  await fails('authenticated', "select public.reserve_profile_post_image($1,$2,'photo.png','image/png')", [image3, other.id]);
  // Simulate the worker's successful Storage API removal inside this fake database.
  await pg.query("delete from storage.objects where bucket_id='profile-post-images' and name=$1", [draftFile.path]);
  await run('service_role', 'select public.ack_profile_post_cleanup($1)', [draftFile.path]);
  eq(await value('postgres', 'select done v from posts_private.file_cleanup where path=$1', [draftFile.path]), true, 'removed object acknowledged with retained tombstone');
  eq((await value('service_role', 'select public.profile_post_cleanup_batch(100) v')).includes(draftFile.path), false, 'completed path no longer returned');
  await fails('authenticated', "select public.reserve_profile_post_image($1,$2,'photo.png','image/png')", [image3, other.id]);
  const orphanId = randomUUID();
  await pg.query("insert into storage.objects(bucket_id,name,metadata) values('profile-post-images',$1,'{\"size\":123,\"mimetype\":\"image/png\"}')", [orphanId]);
  await fails('authenticated', "select public.reserve_profile_post_image($1,$2,'photo.png','image/png')", [orphanId, other.id]);
  await fails('authenticated', 'select public.finish_profile_post_image($1)', [orphanId]);
  await claim(u1);

  // Fresh member purge removes only their new metadata; other member remains.
  await claim(u2);
  const otherBefore = await value('authenticated', 'select public.get_profile_post($1,$2,true) v', [profile2, other.id]);
  await claim(u1);
  const purgedPost = await create();
  await reserve(missing, purgedPost);
  eq(await value('postgres', 'select count(*)::int v from posts_private.file_cleanup where path=$1', [missing]), 0, 'new reservation not queued');
  await pg.query('delete from auth.users where id=$1', [u1]);
  eq(await value('postgres', 'select count(*)::int v from posts_private.posts where owner_id=$1', [u1]), 0, 'account purge post cascade');
  eq(await value('postgres', 'select count(*)::int v from posts_private.files where owner_id=$1', [u1]), 0, 'account purge file cascade');
  eq(await value('postgres', 'select done v from posts_private.file_cleanup where path=$1', [missing]), false, 'queue survives account purge without owner FK');
  eq((await value('service_role', 'select public.profile_post_cleanup_batch(100) v')).includes(missing), true, 'purged account reservation claimable');
  await run('service_role', 'select public.ack_profile_post_cleanup($1)', [missing]);
  eq(await value('postgres', 'select done v from posts_private.file_cleanup where path=$1', [missing]), true, 'never-uploaded purged reservation acknowledged');
  eq(await value('postgres', "select count(*)::int v from pg_constraint where conrelid='posts_private.file_cleanup'::regclass and contype='f'"), 0, 'cleanup has no owner or account foreign keys');
  await claim(u2);
  eq(await value('authenticated', 'select public.get_profile_post($1,$2,true) v', [profile2, other.id]), otherBefore, 'other account unchanged');
  eq(await value('postgres', "select file_size_limit::int v from storage.buckets where id='existing-bucket'"), 1234, 'existing bucket unchanged');
  eq(await value('anon', "select metadata v from storage.objects where bucket_id='existing-bucket' and name='unchanged'"), { size: 7 }, 'existing storage unchanged');
  const countSnapshot = `select jsonb_build_object(
    'posts',(select count(*) from posts_private.posts),
    'files',(select count(*) from posts_private.files),
    'objects',(select count(*) from storage.objects),
    'cleanup',(select count(*) from posts_private.file_cleanup)) v`;
  const beforeRollback = await value('postgres', countSnapshot);
  eq(await storageCount(foreignFile.path, 'authenticated'), 1, 'new bucket owner access works before rollback');
  await pg.exec(await readFile('supabase/rollback/profile_posts.sql', 'utf8'));
  eq(await value('postgres', countSnapshot), beforeRollback, 'rollback preserves posts, files, objects and cleanup counts');
  const disabledCalls = [
    ['select public.create_profile_post()', []],
    ["select public.save_profile_post($1,$2::jsonb,false,'private',$3::timestamptz)", [other.id, JSON.stringify(blank), other.updatedAt]],
    ['select public.list_profile_posts($1)', [profile2]],
    ['select public.get_profile_post($1,$2)', [profile2, other.id]],
    ['select public.delete_profile_post($1,$2::timestamptz)', [other.id, other.updatedAt]],
    ["select public.reserve_profile_post_image($1,$2,'photo.png','image/png')", [randomUUID(), other.id]],
    ['select public.finish_profile_post_image($1)', [image2]],
    ['select public.profile_post_image_path($1)', [image2]],
    ['select public.profile_post_cleanup_batch()', []],
    ['select public.ack_profile_post_cleanup($1)', [foreignFile.path]],
  ];
  for (const role of ['anon', 'authenticated']) {
    for (const [sql, params] of disabledCalls) await fails(role, sql, params);
    await fails(role, 'select posts_private.can_read_file($1)', [foreignFile.path]);
    eq(await storageCount(foreignFile.path, role), 0, `${role} direct new bucket access denied after rollback`);
    eq(await value(role, "select metadata v from storage.objects where bucket_id='existing-bucket' and name='unchanged'"), { size: 7 }, `${role} existing bucket remains readable after rollback`);
  }
  await fails('service_role', 'select public.profile_post_cleanup_batch()');
  await fails('service_role', 'select public.ack_profile_post_cleanup($1)', [foreignFile.path]);
  eq(await value('postgres', "select bool_or(has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('anon',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute')) v from pg_proc p where p.pronamespace='posts_private'::regnamespace"), false, 'rollback revokes all private implementation execution');
  eq(await value('postgres', countSnapshot), beforeRollback, 'denied post-rollback requests preserve data counts');
  console.log(`PASS: ${checks} isolated PostgreSQL posts/strict document/storage/auth/revision/purge/rollback checks; no real database connection.`);
} finally {
  await pg.close();
}
