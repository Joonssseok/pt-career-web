// Isolated synthetic PostgreSQL only. No real database connection or credentials.
// node tests/helpers/check-profile-contact-inquiry-sql.mjs [path/to/pglite/dist/index.js]
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url), ts=require('typescript'), modules=new Map();
function loadTS(file) {
 const path=resolve(file); if(modules.has(path)) return modules.get(path).exports;
 const module={exports:{}}; modules.set(path,module);
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  module,exports:module.exports,URL,require:(name)=>{
   assert.ok(name.startsWith('.')||name.startsWith('@/'),'local validator dependencies only');
   return loadTS(name.startsWith('@/')?resolve(name.slice(2)+'.ts'):resolve(dirname(path),name+'.ts'));
  },
 },{filename:path}); return module.exports;
}
const {validateContactInquiry,publicContactInquiry,emptyContactInquiry}=loadTS('lib/profile-versions/contact-inquiry.ts');
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2]||'../introduction-sql-check/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg=await PGlite.create(); let checks=0;
const owner='11111111-1111-4111-8111-111111111111', profile='22222222-2222-4222-8222-222222222222', version='33333333-3333-4333-8333-333333333333';
const other='55555555-5555-4555-8555-555555555555';
const plain=(v)=>JSON.parse(JSON.stringify(v));
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);checks++;}
async function scalar(sql,params=[]){return(await pg.query(sql,params)).rows[0]?.v;}
async function claim(uid){await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);}
async function run(role,sql,params=[]){
 const uid=await scalar("select current_setting('request.jwt.claim.sub',true) v");
 if(role==='anon') await claim(''); await pg.exec(`set role ${role}`);
 try{return(await pg.query(sql,params)).rows;}finally{await pg.exec('reset role');if(role==='anon') await claim(uid||'');}
}
async function value(role,sql,params=[]){return(await run(role,sql,params))[0]?.v;}
async function fails(role,sql,params=[],code='42501'){await assert.rejects(run(role,sql,params),(error)=>error.code===code);checks++;}
const legacy={headline:'Legacy headline',introduction:'Legacy introduction',sections:[],activities:[]};
const complete=()=>({
 inquiryLabel:'상담 문의',inquiry:{value:'https://example.test/private-inquiry',visible:false},
 phone:{value:'010-9876-5432',visible:false},email:{value:'private@example.test',visible:false},
 address:{value:'PRIVATE BASE ADDRESS',visible:false},location:{name:'PRIVATE PLACE NAME',address:'PRIVATE BASE ADDRESS',latitude:37.56789,longitude:127.12345},
 detailAddress:'PRIVATE DETAIL 987',mapVisible:false,
});
async function valid(contact,expected,label){
 const checked=validateContactInquiry(contact); eq(checked.ok,expected,`TS ${label}`);
 const payload=checked.ok?checked.contact:contact;
 eq(await scalar('select public.profile_contact_inquiry_valid($1::jsonb) v',[JSON.stringify(payload)]),expected,`SQL ${label}`);
 eq(await value('authenticated','select public.profile_version_content_valid($1::jsonb) v',[JSON.stringify({...legacy,contactInquiry:payload})]),expected,`version ${label}`);
}
async function representative(role='anon'){return(await run(role,'select * from public.get_representative_profiles(array[$1::uuid])',[profile]))[0];}
async function save(contact,content={...legacy,contactInquiry:contact}){
 return value('authenticated',"select public.save_profile_version($1,'Profile',$2::jsonb) v",[version,JSON.stringify(content)]);
}
const rowsSQL=`select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
 'versions',(select jsonb_agg(to_jsonb(v) order by id) from public.profile_versions v),
 'uploads',(select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) from public.profile_detail_uploads f)) v`;
try{
 await pg.exec(`create role anon;create role authenticated;create role service_role;
  create schema auth;create schema storage;create schema profile_images_internal;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated,service_role;
  create table public.profiles(id uuid primary key,user_id uuid,is_public boolean,owner_visible boolean,verification_status text,suspended_at timestamptz,deletion_requested_at timestamptz,headline text,introduction text);
  create table public.profile_versions(id uuid primary key default gen_random_uuid(),owner_id uuid,title text,draft_content jsonb,updated_at timestamptz default now(),published_at timestamptz,profile_id uuid,published_content jsonb,published_expert jsonb,published_gallery jsonb,is_representative boolean);
  alter table public.profile_versions enable row level security;
  grant select on public.profile_versions to authenticated;
  create policy profile_versions_owner_read on public.profile_versions for select to authenticated using(owner_id=(select auth.uid()));
  create table public.profile_gallery_images(id uuid,profile_id uuid,owner_visible boolean,image_path text,caption text,display_order integer);
  create table public.public_expert_detail(id uuid,licenses jsonb,experiences jsonb,academic_records jsonb,educations jsonb,professions jsonb,specialties jsonb,workplace_region text,workplace_center_name text,workplace_phone text,workplace_address text,workplace_address_detail text,workplace_website_url text,workplace_external_contact_url text);
  create function public.profile_version_item_visible(jsonb,text,jsonb) returns boolean language sql immutable as 'select true';
  create function public.profile_activity_public(jsonb) returns jsonb language sql immutable as 'select $1';
  create function public.profile_activity_has_content(jsonb) returns boolean language sql immutable as 'select true';
  create function public.profile_version_public_order(jsonb,jsonb,jsonb) returns jsonb language sql immutable as 'select coalesce($1,''{}''::jsonb)';
  create table public.profile_detail_uploads(owner_id uuid,id uuid,group_id uuid,name text,mime text constraint profile_detail_uploads_mime_check check(mime in ('image/jpeg','image/png','image/webp')),path text,bytes bigint,ready boolean,deleting boolean);
  create table public.profile_detail_attachments(version_id uuid primary key,owner_id uuid,draft_file_ids uuid[],published_file_ids uuid[],updated_at timestamptz default now());
  create table storage.buckets(id text,allowed_mime_types text[],public boolean,file_size_limit bigint);
  insert into storage.buckets values('profile-detail-images',array['image/jpeg','image/png','image/webp'],false,20971520);`);
 await pg.exec(await readFile('supabase/migrations/20261118115925_introduction_formatting.sql','utf8'));
 await pg.exec(await readFile('supabase/migrations/20261118123253_detail_rich_media.sql','utf8'));
 const publisher=await readFile('supabase/migrations/20261102081944_enable_profile_publishing.sql','utf8');
 await pg.exec(publisher.slice(publisher.indexOf('create or replace function public.publish_profile_version'),publisher.indexOf('-- Public reads honor')));
 await pg.exec(`alter table public.profile_versions add check(public.profile_version_content_valid(draft_content));
  revoke all on function public.profile_version_content_valid(jsonb),public.profile_version_visible_expert(jsonb,jsonb),public.save_profile_version(uuid,text,jsonb),public.save_profile_with_detail_images(uuid,text,jsonb,uuid[],timestamptz),public.get_representative_profiles(uuid[]) from public,anon,authenticated,service_role;
  grant execute on function public.profile_version_content_valid(jsonb),public.profile_version_visible_expert(jsonb,jsonb),public.save_profile_version(uuid,text,jsonb),public.save_profile_with_detail_images(uuid,text,jsonb,uuid[],timestamptz),public.get_representative_profiles(uuid[]) to authenticated,service_role;
  grant execute on function public.get_representative_profiles(uuid[]) to anon;`);
 await pg.query("insert into public.profiles values($1,$2,true,true,'approved',null,null,'Legacy headline','Legacy introduction')",[profile,owner]);
 await pg.query("insert into public.public_expert_detail(id,licenses,experiences,academic_records,educations,professions,specialties) values($1,'[]','[]','[]','[]','[]','[]')",[profile]);
 const expert={introduction:'Legacy introduction',experiences:[],academic_records:[],educations:[],licenses:[],professions:[],specialties:[]};
 await pg.query("insert into public.profile_versions(id,owner_id,title,draft_content,profile_id,is_representative,published_content,published_expert,published_gallery,published_at) values($1,$2,'Legacy',$3,$4,true,$3,$5,'[]',now())",[version,owner,JSON.stringify(legacy),profile,JSON.stringify(expert)]);
 await claim(owner);
 const before=await scalar(rowsSQL), oldPublic=await representative();
 const names=['profile_version_content_valid','profile_version_visible_expert','get_representative_profiles','save_profile_version','save_profile_with_detail_images'];
 const aclSQL="select jsonb_object_agg(proname,jsonb_build_object('acl',proacl::text,'definer',prosecdef,'config',proconfig)) v from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[])";
 const acl=await scalar(aclSQL,[names]);
 const getter=await scalar("select pg_get_functiondef('public.get_representative_profiles(uuid[])'::regprocedure) v");
 const migrations=await readdir('supabase/migrations');
 const migration=migrations.find((f)=>/^\d+_profile_contact_inquiry\.sql$/.test(f)); assert.ok(migration);
 await pg.exec(await readFile(`supabase/migrations/${migration}`,'utf8'));
 eq(await scalar(rowsSQL),before,'migration preserves all synthetic rows');
 eq(await scalar(aclSQL,[names]),acl,'existing ACLs/security modes/search paths unchanged');
 eq(await scalar("select pg_get_functiondef('public.get_representative_profiles(uuid[])'::regprocedure) v"),getter,'public getter unchanged');
 const newPublic=await representative(); eq(newPublic.content,oldPublic.content,'legacy content projection unchanged');
 eq(newPublic.expert.contact_inquiry,null,'legacy contact explicitly null');
 const {contact_inquiry,...oldExpert}=newPublic.expert;eq(oldExpert,oldPublic.expert,'legacy expert fields unchanged');
 for(const name of ['profile_contact_inquiry_valid','profile_contact_inquiry_public']){
  await fails('anon',`select public.${name}($1::jsonb) v`,[JSON.stringify(complete())]);
  eq(await value('service_role','select public.profile_contact_inquiry_valid($1) v',[JSON.stringify(complete())]),true,'service role can call pure validator');
 }
 await valid(complete(),true,'complete private configuration');
 await valid(plain(emptyContactInquiry()),true,'empty optional values');
 const blankVisible=plain(emptyContactInquiry());for(const k of ['inquiry','phone','email','address'])blankVisible[k].visible=true;
 await valid(blankVisible,true,'blank optional fields may be visible');
 const phoneBoundary=complete();phoneBoundary.phone.value='+'+'1'.repeat(15);await valid(phoneBoundary,true,'phone permits at most fifteen actual digits');
 for(const number of ['-------','(1)----','1'.repeat(16),'+'+'1'.repeat(16)])for(const visible of [false,true]){
  const c=complete();c.phone={value:number,visible};await valid(c,false,'phone requires seven to fifteen actual digits even when hidden');
 }
 for(const [path,value] of [
  ['inquiryLabel','x'.repeat(25)],['inquiryLabel','bad\nlabel'],['detailAddress','x'.repeat(121)],['detailAddress','bad\naddress'],
  ['inquiry.value','https://example.test/'+ 'x'.repeat(500)],['inquiry.value','javascript:alert(1)'],['inquiry.value','data:text/html,bad'],
  ['inquiry.value','https://u:p@example.test'],['inquiry.value','https://example.test/a b'],['inquiry.value','https://example.test/a\\b'],
  ['inquiry.value','https://example.test/\n'],['inquiry.value','https://example.test/<bad>'],['inquiry.value','https://example.test/"bad"'],['inquiry.value',"https://example.test/'bad'"],
  ['phone.value','123'],['phone.value','letters'],['phone.value','1'.repeat(26)],['phone.value','1234567\n'],
  ['email.value','bad-email'],['email.value','x'.repeat(161)],['email.value','x\ny@example.test'],
  ['address.value','x'.repeat(301)],['location.name','x'.repeat(161)],['location.name','place\nname'],
  ['location.latitude',91],['location.longitude',181],['location.latitude','37'],['location.address',''],['mapVisible','true'],['phone.visible',1],
 ]){
  const c=complete(),parts=path.split('.');if(parts.length===1)c[path]=value;else c[parts[0]][parts[1]]=value;
  await valid(c,false,path);
 }
 for(const key of Object.keys(complete())){const c=complete();delete c[key];await valid(c,false,`missing ${key}`);}
 const extra=complete();extra.privateNotes='not allowed';await valid(extra,false,'unknown top key');
 const extraField=complete();extraField.phone.extra=true;await valid(extraField,false,'unknown field key');
 const extraLocation=complete();extraLocation.location.extra=true;await valid(extraLocation,false,'unknown location key');
 const zero=complete();zero.location.latitude=0;zero.location.longitude=0;await valid(zero,false,'zero coordinate pair');
 const noLocation=complete();noLocation.location=null;await valid(noLocation,false,'no location cannot retain address');
 await valid(null,false,'null is not a saved object');
 eq(await value('authenticated','select public.profile_contact_inquiry_public(null::jsonb) v'),null,'absent SQL NULL preserves legacy fallback semantics');
 for(const invalid of [null,[],{}, {...complete(),unknown:true}]){
  eq(await value('authenticated','select public.profile_contact_inquiry_public($1::jsonb) v',[JSON.stringify(invalid)]),{},'present invalid JSON returns empty DTO to suppress legacy fallback');
 }
 eq(await value('authenticated','select public.profile_version_content_valid($1) v',[JSON.stringify(legacy)]),true,'old document remains valid');
 const formatDoc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Formatted introduction',marks:[{type:'bold'}]}]}]};
 const formatted={...legacy,introduction:'Formatted introduction',introductionDocument:formatDoc,detailDocument:formatDoc,contactInquiry:complete()};
 eq(await value('authenticated','select public.profile_version_content_valid($1) v',[JSON.stringify(formatted)]),true,'existing introduction and detail documents remain valid with optional contacts');
 const visibleFormatted=await value('authenticated','select public.profile_version_visible_expert($1,$2) v',[JSON.stringify(expert),JSON.stringify(formatted)]);
 eq(visibleFormatted.introduction_document,formatDoc,'formatted introduction projection preserved');
 eq(visibleFormatted.detail_document,formatDoc,'detail document projection preserved');
 eq(visibleFormatted.contact_inquiry,{},'valid all-private contact configuration projects empty object');
 await save(complete());
 eq((await representative()).expert.contact_inquiry,null,'draft save does not publish contacts');
 await fails('anon','select draft_content from public.profile_versions');
 await claim(other);eq((await run('authenticated','select draft_content from public.profile_versions')).length,0,'unrelated member cannot read private drafts');
 await fails('authenticated',"select public.save_profile_version($1,'stolen',$2) v",[version,JSON.stringify({...legacy,contactInquiry:complete()})],'P0001');
 await claim(owner);eq((await value('authenticated','select draft_content v from public.profile_versions where id=$1',[version])).contactInquiry,complete(),'owner retains full private contact');
 for(const addressVisible of [false,true])for(const mapVisible of [false,true]){
  const c=complete();c.address.visible=addressVisible;c.mapVisible=mapVisible;
  await save(c);await run('authenticated','select public.publish_profile_version($1)',[version]);
  const result=await representative(),expected=plain(publicContactInquiry(c));
  eq(result.expert.contact_inquiry,expected,'public address/map combination matches TS projection');
  eq(Object.hasOwn(result.content,'contactInquiry'),false,'public content never includes private configuration');
  for(const role of ['authenticated','service_role'])eq((await representative(role)).expert.contact_inquiry,expected,'all public RPC audiences get same safe DTO');
  await claim(other);eq((await representative('authenticated')).expert.contact_inquiry,expected,'unrelated reader receives public projection only');await claim(owner);
  const serialized=JSON.stringify(result);for(const secret of [c.inquiry.value,c.phone.value,c.email.value,c.location.name])eq(serialized.includes(secret),false,'hidden contact/name absent throughout public response');
  if(!addressVisible){eq(serialized.includes(c.address.value),false,'hidden base address absent');eq(serialized.includes(c.detailAddress),false,'hidden detailed address absent');}
  if(!mapVisible){eq(serialized.includes(String(c.location.latitude)),false,'hidden latitude absent');eq(serialized.includes(String(c.location.longitude)),false,'hidden longitude absent');}
 }
 const allVisible=complete();for(const key of ['inquiry','phone','email','address'])allVisible[key].visible=true;allVisible.mapVisible=true;
 await save(allVisible);await run('authenticated','select public.publish_profile_version($1)',[version]);
 eq((await representative()).expert.contact_inquiry,plain(publicContactInquiry(allVisible)),'all explicitly visible fields projected');
 const defaultLabel=complete();defaultLabel.inquiryLabel='';defaultLabel.inquiry.visible=true;
 eq(await value('authenticated','select public.profile_contact_inquiry_public($1) v',[JSON.stringify(defaultLabel)]),plain(publicContactInquiry(defaultLabel)),'blank inquiry label uses existing fallback');
 const malformed={...complete(),unexpected:'PRIVATE MALFORMED SECRET'};
 await pg.query('update public.profile_versions set published_content=$1,published_expert=published_expert||$2::jsonb where id=$3',[JSON.stringify({...legacy,contactInquiry:malformed}),JSON.stringify({contactInquiry:malformed,contact_inquiry:malformed}),version]);
 const malformedResult=await representative();eq(malformedResult.expert.contact_inquiry,{},'invalid saved metadata suppresses legacy contact fallback');
 eq(JSON.stringify(malformedResult).includes('PRIVATE MALFORMED SECRET'),false,'stale expert payload cannot leak invalid raw metadata');
 await pg.query('update public.profile_versions set published_content=$1 where id=$2',[JSON.stringify(legacy),version]);
 eq((await representative()).expert.contact_inquiry,null,'legacy absent configuration replaces stale contact projection');
 await save(complete());await run('authenticated','select public.publish_profile_version($1)',[version]);
 for(const change of ['is_public=false','owner_visible=false',"verification_status='pending'",'suspended_at=now()','deletion_requested_at=now()']){
  await pg.exec(`update public.profiles set ${change}`);
  eq((await run('anon','select * from public.get_representative_profiles(array[$1::uuid])',[profile])).length,0,'existing profile availability gate preserved');
  await pg.exec("update public.profiles set is_public=true,owner_visible=true,verification_status='approved',suspended_at=null,deletion_requested_at=null");
 }
 await pg.query('update public.profile_versions set published_expert=published_expert||$1::jsonb where id=$2',[JSON.stringify({contactInquiry:complete(),contact_inquiry:complete()}),version]);
 const beforeRollback=await scalar(rowsSQL);
 await pg.exec(await readFile('supabase/rollback/profile_contact_inquiry.sql','utf8'));
 eq(await scalar(rowsSQL),beforeRollback,'rollback preserves private drafts and published rows');
 eq(await scalar(aclSQL,[names]),acl,'rollback preserves existing grants/security modes');
 eq((await representative()).expert.contact_inquiry,{},'rollback explicit configuration keeps empty DTO to suppress legacy contact CTAs');
 const rollbackLegacy=await value('authenticated','select public.profile_version_visible_expert($1::jsonb,$2::jsonb) v',[
  JSON.stringify({...expert,contactInquiry:complete(),contact_inquiry:complete()}),JSON.stringify(legacy),
 ]);
 eq(Object.hasOwn(rollbackLegacy,'contact_inquiry'),false,'rollback legacy profiles without configuration preserve contact field absence');
 eq(Object.hasOwn(rollbackLegacy,'contactInquiry'),false,'rollback legacy path also strips stale raw contact configuration');
 const rollbackConfigured=await value('authenticated','select public.profile_version_visible_expert($1::jsonb,$2::jsonb) v',[
  JSON.stringify(expert),JSON.stringify({...legacy,contactInquiry:null}),
 ]);
 eq(rollbackConfigured.contact_inquiry,{},'rollback present invalid configuration also suppresses legacy CTAs');
 eq(JSON.stringify((await representative()).expert).includes(complete().phone.value),false,'rollback strips stale raw private expert contact values');
 eq(Object.hasOwn((await representative()).content,'contactInquiry'),false,'rollback getter still excludes full private configuration');
 await save(complete());eq((await value('authenticated','select draft_content v from public.profile_versions where id=$1',[version])).contactInquiry,complete(),'contact-bearing drafts editable after rollback');
 await save(null,legacy);eq(await value('authenticated','select draft_content v from public.profile_versions where id=$1',[version]),legacy,'legacy saves remain usable after rollback');
 await save(complete());await run('authenticated',"select public.save_profile_with_detail_images($1,'Profile',$2,'{}',null) v",[version,JSON.stringify({...legacy,contactInquiry:complete()})]);
 eq((await value('authenticated','select draft_content v from public.profile_versions where id=$1',[version])).contactInquiry,complete(),'detail-image save path retains contacts after rollback');
 console.log(`PASS: ${checks} isolated contact schema/TS projection/owner/public/privacy/snapshot/rollback checks; no real database connection.`);
}catch(error){console.error('FAIL:',error.code||'',error.message,'line',error.query&&error.position?error.query.slice(0,Number(error.position)).split('\n').length:'unknown');process.exitCode=1;}
finally{await pg.close();}
