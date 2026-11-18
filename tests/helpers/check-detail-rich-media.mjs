import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);
const pg=new PGlite();
await pg.exec(`
create role anon;create role authenticated;create schema auth;create schema storage;create schema profile_images_internal;
create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
create table public.profiles(id uuid primary key,user_id uuid,is_public boolean,owner_visible boolean,verification_status text,suspended_at timestamptz,deletion_requested_at timestamptz);
create table public.profile_versions(id uuid primary key default gen_random_uuid(),owner_id uuid,title text,draft_content jsonb,updated_at timestamptz default now(),published_at timestamptz,profile_id uuid,published_content jsonb,published_expert jsonb,published_gallery jsonb,is_representative boolean);
create table public.profile_gallery_images(id uuid,profile_id uuid,owner_visible boolean);
create table public.public_expert_detail(id uuid,licenses jsonb,experiences jsonb,academic_records jsonb,educations jsonb,professions jsonb,specialties jsonb,workplace_region text,workplace_center_name text,workplace_phone text,workplace_address text,workplace_address_detail text,workplace_website_url text,workplace_external_contact_url text);
create function public.profile_version_item_visible(jsonb,text,jsonb) returns boolean language sql immutable as 'select true';
create function public.profile_activity_public(jsonb) returns jsonb language sql immutable as 'select $1';
create function public.profile_activity_has_content(jsonb) returns boolean language sql immutable as 'select true';
create function public.profile_version_public_order(jsonb,jsonb,jsonb) returns jsonb language sql immutable as 'select coalesce($1,''{}''::jsonb)';
create table public.profile_detail_uploads(owner_id uuid,id uuid,group_id uuid,name text,mime text constraint profile_detail_uploads_mime_check check(mime in ('image/jpeg','image/png','image/webp')),path text,bytes bigint,ready boolean,deleting boolean);
create table public.profile_detail_attachments(version_id uuid primary key,owner_id uuid,draft_file_ids uuid[],published_file_ids uuid[],updated_at timestamptz default now());
create table storage.buckets(id text,allowed_mime_types text[],public boolean,file_size_limit bigint);
insert into storage.buckets values('profile-detail-images',array['image/jpeg','image/png','image/webp'],false,20971520);
`);
await pg.exec(await readFile('supabase/migrations/20261118115925_introduction_formatting.sql','utf8'));
await pg.exec(await readFile('supabase/migrations/20261118123253_detail_rich_media.sql','utf8'));
await pg.exec(await readFile('supabase/migrations/20261118130222_image_presentation.sql','utf8'));
await pg.exec(`create trigger detail_snapshot after update of published_at on public.profile_versions for each row execute function profile_images_internal.publish_detail_images();`);
let checks=0;
const owner='11111111-1111-4111-8111-111111111111',profile='22222222-2222-4222-8222-222222222222',version='33333333-3333-4333-8333-333333333333',file='44444444-4444-4444-8444-444444444444';
const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'상세 소개',marks:[{type:'bold'}]}]},{type:'profileMedia',attrs:{fileId:file,mime:'image/gif'}},{type:'youtubeVideo',attrs:{videoId:'abcdefghijk'}}]};
const legacy={headline:'한줄',introduction:'기존 소개',sections:[],activities:[]};
const content={...legacy,detailDocument:doc};
async function valid(value,expected){const r=await pg.query('select public.profile_version_content_valid($1::jsonb) as ok',[JSON.stringify(value)]);assert.equal(r.rows[0].ok,expected);checks++;}
await valid(legacy,true);await valid(content,true);
for(const mime of ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']){const d=structuredClone(doc);d.content[1].attrs.mime=mime;await valid({...content,detailDocument:d},true);}
for(const bad of [{type:'image',attrs:{src:'https://outside.example/a'}},{type:'iframe',attrs:{src:'javascript:bad'}},{type:'profileMedia',attrs:{fileId:file,mime:'text/html'}},{type:'profileMedia',attrs:{fileId:file,mime:'image/gif',src:'https://outside.example/a'}},{type:'youtubeVideo',attrs:{videoId:'../bad'}},{type:'youtubeVideo',attrs:{videoId:'abcdefghijk',src:'https://evil.example'}}])await valid({...content,detailDocument:{type:'doc',content:[bad]}},false);
await valid({...content,detailDocument:{type:'doc',content:Array(21).fill(doc.content[2])}},false);
await valid({...content,detailDocument:{type:'doc',content:[doc.content[1],doc.content[1]]}},false);
await pg.query('insert into public.profiles values($1,$2,true,true,\'approved\',null,null)',[profile,owner]);
await pg.query('insert into public.profile_versions(id,owner_id,title,draft_content,profile_id,is_representative,published_content,published_expert,published_gallery) values($1,$2,\'프로필\',$3,$4,true,$3,$5,\'[]\')',[version,owner,JSON.stringify(legacy),profile,JSON.stringify({experiences:[],licenses:[],academic_records:[],educations:[],professions:[],specialties:[]})]);
await pg.query('insert into public.profile_detail_uploads values($1,$2,$2,\'사진.gif\',\'image/gif\',\'owner/file\',100,true,false)',[owner,file]);
await pg.query('insert into public.public_expert_detail(id,licenses,experiences,academic_records,educations,professions,specialties) values($1,\'[]\',\'[]\',\'[]\',\'[]\',\'[]\',\'[]\')',[profile]);
await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
async function rejected(query,args){await assert.rejects(pg.query(query,args));checks++;}
await rejected('select public.save_profile_with_detail_images($1,\'프로필\',$2,\'{}\',null)',[version,JSON.stringify(content)]);
await pg.query('select public.save_profile_with_detail_images($1,\'프로필\',$2,array[$3::uuid],null)',[version,JSON.stringify(content),file]);checks++;
let r=await pg.query('select draft_content,published_content from public.profile_versions where id=$1',[version]);assert.deepEqual(r.rows[0].draft_content,content);assert.deepEqual(r.rows[0].published_content,legacy);checks++;
const mismatch=structuredClone(content);mismatch.detailDocument.content[1].attrs.mime='video/mp4';await rejected('select public.save_profile_version($1,\'프로필\',$2)',[version,JSON.stringify(mismatch)]);
await pg.query('update public.profile_versions set published_content=draft_content,published_at=now() where id=$1',[version]);
r=await pg.query('select * from public.get_representative_profiles(array[$1::uuid])',[profile]);assert.deepEqual(r.rows[0].content.detailDocument,doc);assert.deepEqual(r.rows[0].expert.detail_document,doc);checks++;
await pg.query('update public.profile_detail_attachments set draft_file_ids=\'{}\'');await rejected('update public.profile_versions set published_at=clock_timestamp() where id=$1',[version]);
await pg.query("select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false)");await rejected('select public.save_profile_version($1,\'프로필\',$2)',[version,JSON.stringify(content)]);
await pg.query("select set_config('request.jwt.claim.sub','',false)");await rejected('select public.save_profile_version($1,\'프로필\',$2)',[version,JSON.stringify(content)]);
r=await pg.query("select has_function_privilege('anon','public.profile_detail_document_valid(jsonb)','execute') as allowed");assert.equal(r.rows[0].allowed,false);checks++;
r=await pg.query("select public,file_size_limit,allowed_mime_types from storage.buckets");assert.equal(r.rows[0].public,false);assert.equal(Number(r.rows[0].file_size_limit),20971520);assert.ok(r.rows[0].allowed_mime_types.includes('video/mp4'));checks++;
const geometry=structuredClone(content);geometry.detailDocument.content[1].attrs.widthPercent=50;geometry.detailDocument.content[1].attrs.crop={x:10,y:5,width:60,height:80};
await valid(geometry,true);
for(const patch of [
 {widthPercent:9},{widthPercent:101},{widthPercent:50.5},{widthPercent:'50%'},{widthPercent:null},
 {crop:{x:90,y:0,width:20,height:100}}, {crop:{x:0,y:0,width:0,height:100}},
 {crop:{x:-1,y:0,width:50,height:100}}, {crop:{x:0,y:0,width:50,height:100,src:'https://outside.example'}},
 {crop:{x:0,y:0,width:50,height:'100'}}, {crop:null},
]) {const d=structuredClone(geometry);Object.assign(d.detailDocument.content[1].attrs,patch);await valid(d,false);}
const videoGeometry=structuredClone(geometry);videoGeometry.detailDocument.content[1].attrs.mime='video/mp4';await valid(videoGeometry,false);
await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
await pg.query('select public.save_profile_version($1,\'프로필\',$2)',[version,JSON.stringify(geometry)]);
r=await pg.query('select draft_content,published_content from public.profile_versions where id=$1',[version]);assert.deepEqual(r.rows[0].draft_content.detailDocument,geometry.detailDocument);assert.deepEqual(r.rows[0].published_content,content);checks++;
r=await pg.query('select mime,bytes,path from public.profile_detail_uploads where id=$1',[file]);assert.equal(r.rows[0].mime,'image/gif');assert.equal(Number(r.rows[0].bytes),100);assert.equal(r.rows[0].path,'owner/file');checks++;
await pg.query('update public.profile_detail_attachments set draft_file_ids=array[$1::uuid]',[file]);
await pg.query('update public.profile_versions set published_content=draft_content,published_at=clock_timestamp() where id=$1',[version]);
r=await pg.query('select * from public.get_representative_profiles(array[$1::uuid])',[profile]);assert.deepEqual(r.rows[0].expert.detail_document,geometry.detailDocument);assert.deepEqual(r.rows[0].content.detailDocument,geometry.detailDocument);checks++;
await pg.close();console.log(`PASS: ${checks} isolated detail-media SQL checks; no remote data written.`);
