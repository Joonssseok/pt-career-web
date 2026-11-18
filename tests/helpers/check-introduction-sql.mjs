import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const pg = await PGlite.create();
await pg.exec(`
 create role anon; create role authenticated;
 create table public.profiles(id uuid primary key,is_public boolean,owner_visible boolean,verification_status text,suspended_at timestamptz,deletion_requested_at timestamptz);
 create table public.profile_versions(profile_id uuid,published_content jsonb,published_expert jsonb,published_gallery jsonb,is_representative boolean);
 create table public.profile_gallery_images(id uuid,profile_id uuid,owner_visible boolean);
 create table public.public_expert_detail(id uuid,licenses jsonb,experiences jsonb,academic_records jsonb,educations jsonb,professions jsonb,specialties jsonb,workplace_region text,workplace_center_name text,workplace_phone text,workplace_address text,workplace_address_detail text,workplace_website_url text,workplace_external_contact_url text);
 create function public.profile_version_item_visible(jsonb,text,jsonb) returns boolean language sql immutable as 'select true';
 create function public.profile_activity_public(jsonb) returns jsonb language sql immutable as 'select $1';
 create function public.profile_activity_has_content(jsonb) returns boolean language sql immutable as 'select true';
 create function public.profile_version_public_order(jsonb,jsonb,jsonb) returns jsonb language sql immutable as 'select coalesce($1,''{}''::jsonb)';
`);
await pg.exec(await readFile('supabase/migrations/20261118115925_introduction_formatting.sql','utf8'));
const doc = {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'안전한 소개',marks:[{type:'bold'},{type:'highlight',attrs:{color:'#fef08a'}},{type:'textStyle',attrs:{fontSize:'22px',color:'#2563eb'}}]}]}]};
const content = {headline:'한 줄 소개',introduction:'안전한 소개',sections:[],activities:[],introductionDocument:doc};
let checks=0;
async function valid(value, expected) { const r=await pg.query('select public.profile_version_content_valid($1::jsonb) as ok',[JSON.stringify(value)]);assert.equal(r.rows[0].ok,expected);checks++; }
await valid(content,true);
const legacy={...content};delete legacy.introductionDocument;await valid(legacy,true);
await valid({...content,introduction:'다른 글'},false);
for (const type of ['image','script','iframe','link','svg']) await valid({...content,introductionDocument:{type:'doc',content:[{type,attrs:{src:'https://external.example'}}]}},false);
for (const mark of [{type:'link',attrs:{href:'javascript:alert(1)'}},{type:'textStyle',attrs:{fontSize:'999px'}},{type:'highlight',attrs:{color:'red'}},{type:'textStyle',attrs:{color:'#2563eb',onerror:'bad'}}]) {
 const bad=structuredClone(doc);bad.content[0].content[0].marks=[mark];await valid({...content,introductionDocument:bad},false);
}
const id='11111111-1111-4111-8111-111111111111';
const expert={introduction:content.introduction,experiences:[],academic_records:[],educations:[],licenses:[],professions:[],specialties:[]};
await pg.query('insert into public.profiles values ($1,true,true,\'approved\',null,null)',[id]);
await pg.query('insert into public.profile_versions values ($1,$2::jsonb,$3::jsonb,\'[]\',true)',[id,JSON.stringify(content),JSON.stringify(expert)]);
await pg.query('insert into public.public_expert_detail(id,licenses,experiences,academic_records,educations,professions,specialties) values($1,\'[]\',\'[]\',\'[]\',\'[]\',\'[]\',\'[]\')',[id]);
let r=await pg.query('select * from public.get_representative_profiles(array[$1::uuid])',[id]);
assert.deepEqual(r.rows[0].content.introductionDocument,doc);checks++;
assert.deepEqual(r.rows[0].expert.introduction_document,doc);checks++;
await pg.query('update public.profile_versions set published_content=$1::jsonb',[JSON.stringify({...content,excluded:['introduction:0']})]);
r=await pg.query('select * from public.get_representative_profiles(array[$1::uuid])',[id]);
assert.equal(r.rows[0].content.introductionDocument,undefined);checks++;
assert.equal(r.rows[0].expert.introduction_document,null);checks++;
assert.equal(r.rows[0].content.introduction,'');checks++;
await pg.query('update public.profiles set is_public=false');
r=await pg.query('select * from public.get_representative_profiles(array[$1::uuid])',[id]);assert.equal(r.rows.length,0);checks++;
r=await pg.query("select has_function_privilege('anon','public.profile_introduction_format_text(jsonb,text,integer)','execute') as ok");assert.equal(r.rows[0].ok,false);checks++;
await pg.close();console.log(`PASS: ${checks} isolated PostgreSQL formatting/legacy/privacy checks; no remote database connection.`);
