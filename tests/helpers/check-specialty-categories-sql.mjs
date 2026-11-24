// Synthetic isolated PostgreSQL only; no real DB, credentials, or application calls.
// node tests/helpers/check-specialty-categories-sql.mjs [path/to/pglite/dist/index.js]
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2]||'../introduction-sql-check/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg=await PGlite.create();let checks=0;
function eq(a,b,label){assert.deepEqual(a,b,label);checks++;}
async function scalar(sql,params=[]){return(await pg.query(sql,params)).rows[0]?.v;}
function table(source,name){const start=source.indexOf(`CREATE TABLE public.${name} (`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n);',start)+4);}
function fn(source,name){
 const pattern=new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+${name.replaceAll('.','\\.')}\\s*\\(`,'i');
 const start=source.search(pattern);assert.ok(start>=0,name);const tail=source.slice(start),delimiter=tail.match(/\bas\s+(\$\w*\$)/i);
 assert.ok(delimiter,name);const open=delimiter.index+delimiter[0].length;return tail.slice(0,tail.indexOf(delimiter[1],open)+delimiter[1].length+1);
}
const uid=(i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
const pid=(i)=>`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
async function claim(i){await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[i?uid(i):'']);}
async function run(role,sql,params=[]){
 const old=await scalar("select current_setting('request.jwt.claim.sub',true) v");if(role==='anon')await claim(0);
 await pg.exec(`set role ${role}`);try{return(await pg.query(sql,params)).rows;}finally{await pg.exec('reset role');if(role==='anon')await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[old||'']);}
}
async function fails(role,sql,params=[],code='23514'){
 await assert.rejects(run(role,sql,params),(e)=>e.code===code);checks++;
}
let ids={},prof={};
async function selectSpecialties(slugs,visible=true){return(await run('authenticated','select * from public.replace_profile_specialties($1::jsonb)',[JSON.stringify(slugs.map(slug=>({specialty_id:ids[slug],owner_visible:visible})))]))[0];}
async function selectProfessions(slugs){return(await run('authenticated','select * from public.replace_profile_professions($1::jsonb)',[JSON.stringify(slugs.map(slug=>({profession_id:prof[slug],custom_label:slug==='custom'?'Custom role':null,owner_visible:true})))]))[0];}
async function publicSlugs(i){const r=await run('anon','select * from public.get_representative_profiles(array[$1::uuid])',[pid(i)]);return r[0]?.expert.specialties.map(s=>s.slug)||[];}
const stateSQL=`select jsonb_build_object(
 'specialties',(select jsonb_agg(to_jsonb(s) order by slug) from public.specialties s),
 'professions',(select jsonb_agg(to_jsonb(p) order by slug) from public.professions p),
 'selections',(select coalesce(jsonb_agg(to_jsonb(s) order by profile_id,specialty_id),'[]') from public.profile_specialties s),
 'professionSelections',(select jsonb_agg(to_jsonb(p) order by profile_id,profession_id) from public.profile_professions p),
 'versions',(select jsonb_agg(to_jsonb(v) order by id) from public.profile_versions v)) v`;
let migrationSQL,rollbackSQL;
try{
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;
 create table public.profiles(id uuid primary key,user_id uuid unique,verification_status text default 'approved',is_public boolean default true,owner_visible boolean default true,suspended_at timestamptz,deletion_requested_at timestamptz);
 alter table public.profiles enable row level security;
 grant select on public.profiles to anon,authenticated;
 create policy visible_profile on public.profiles for select to anon,authenticated using(is_public and owner_visible and verification_status='approved' and suspended_at is null and deletion_requested_at is null);
 create policy own_profile on public.profiles for select to authenticated using(user_id=auth.uid());
 create table public.profile_versions(id uuid primary key default gen_random_uuid(),profile_id uuid,owner_id uuid,draft_content jsonb,published_content jsonb,published_expert jsonb,published_gallery jsonb default '[]',is_representative boolean default true,updated_at timestamptz default now());
 create table public.profile_gallery_images(id uuid,profile_id uuid,owner_visible boolean);
 create function public.profile_version_visible_expert(jsonb,jsonb) returns jsonb language sql immutable as $$select $1$$;
 create function public.profile_activity_public(jsonb) returns jsonb language sql immutable as $$select $1$$;
 create function public.profile_activity_has_content(jsonb) returns boolean language sql immutable as $$select true$$;
 create function public.profile_version_public_order(jsonb,jsonb,jsonb) returns jsonb language sql immutable as $$select coalesce($1,'{}')$$;`);
 const baseline=await readFile('supabase/migrations/20260719000000_m2_baseline_reconstructed.sql','utf8');
 const projection=await readFile('supabase/migrations/20260728000000_m4_public_projection.sql','utf8');
 const specialtySource=await readFile('supabase/migrations/20260731010000_license_evidence_and_visibility_toggle.sql','utf8');
 const professionSource=await readFile('supabase/migrations/20260801010000_professions_multi_select.sql','utf8');
 await pg.exec(table(baseline,'specialties'));await pg.exec(table(baseline,'profile_specialties'));
 await pg.exec('alter table public.profile_specialties add column owner_visible boolean not null default true');
 await pg.exec(table(professionSource,'professions'));await pg.exec(table(professionSource,'profile_professions'));
 for(const [s,marker] of [[baseline,'INSERT INTO public.specialties (slug, name, sort_order) VALUES'],[professionSource,'INSERT INTO public.professions (slug, name, sort_order) VALUES']]){const start=s.indexOf(marker);await pg.exec(s.slice(start,s.indexOf(';',start)+1));}
 await pg.exec(fn(specialtySource,'public.replace_profile_specialties'));await pg.exec(fn(professionSource,'public.replace_profile_professions'));
 await pg.exec(`revoke all on function public.replace_profile_specialties(jsonb),public.replace_profile_professions(jsonb) from public,anon,authenticated,service_role;
 grant execute on function public.replace_profile_specialties(jsonb) to authenticated;
 grant execute on function public.replace_profile_professions(jsonb) to authenticated,service_role;
 alter table public.specialties enable row level security;alter table public.professions enable row level security;
 create policy active_specialty on public.specialties for select to anon,authenticated using(is_active);
 create policy active_profession on public.professions for select to anon,authenticated using(is_active);
 grant select on public.specialties,public.professions to anon,authenticated;
 alter table public.profile_specialties enable row level security;alter table public.profile_professions enable row level security;
 create policy own_specialty on public.profile_specialties for all to authenticated using(profile_id in(select id from public.profiles where user_id=auth.uid())) with check(profile_id in(select id from public.profiles where user_id=auth.uid()));
 create policy public_specialty on public.profile_specialties for select to anon,authenticated using(owner_visible and profile_id in(select id from public.profiles where is_public and owner_visible and verification_status='approved' and suspended_at is null and deletion_requested_at is null));
 create policy own_profession on public.profile_professions for all to authenticated using(profile_id in(select id from public.profiles where user_id=auth.uid())) with check(profile_id in(select id from public.profiles where user_id=auth.uid()));
 create policy public_profession on public.profile_professions for select to anon,authenticated using(owner_visible and profile_id in(select id from public.profiles where is_public and owner_visible and verification_status='approved' and suspended_at is null and deletion_requested_at is null));
 grant select on public.profile_specialties,public.profile_professions to anon;
 grant select,insert,update,delete on public.profile_specialties,public.profile_professions to authenticated;`);
 await pg.exec(fn(projection,'public.check_max_specialties'));await pg.exec(fn(projection,'public.check_max_primary_specialty'));
 await pg.exec(`create trigger check_max_specialties_before_insert before insert on public.profile_specialties for each row execute function public.check_max_specialties();
 create trigger check_max_primary_specialty_before_insert before insert on public.profile_specialties for each row execute function public.check_max_primary_specialty();
 create trigger check_max_primary_specialty_before_update before update on public.profile_specialties for each row execute function public.check_max_primary_specialty();`);
 ids=Object.fromEntries((await pg.query('select slug,id from public.specialties')).rows.map(r=>[r.slug,r.id]));
 prof=Object.fromEntries((await pg.query('select slug,id from public.professions')).rows.map(r=>[r.slug,r.id]));
 for(let i=1;i<=11;i++){
  await pg.query('insert into public.profiles(id,user_id) values($1,$2)',[pid(i),uid(i)]);
  const medical=[1,3,6,8].includes(i);
  await pg.query('insert into public.profile_professions(profile_id,profession_id,is_primary) values($1,$2,true)',[pid(i),prof[medical?'physical-therapist':'personal-trainer']]);
 }
 const selections=[
 [1,'sports-performance',false,2,true],[1,'conditioning',true,0,false],[1,'sport-specific-training',false,1,true],
 [2,'sport-specific-training',true,4,true],[3,'sports-performance',true,2,true],[3,'conditioning',false,0,true],
 [4,'conditioning',true,5,false],[5,'conditioning',true,3,true],[6,'weight-management',true,7,true],
 [7,'weight-management',true,0,true],[8,'weight-management',true,0,true],
 [9,'sports-performance',false,1,true],[9,'conditioning',true,0,true],
 [10,'sports-performance',false,1,true],[10,'conditioning',true,0,false],
 [11,'sport-specific-training',false,4,true],[11,'weight-management',true,1,true],
 ];
 for(const [i,slug,primary,order,visible]of selections)await pg.query('insert into public.profile_specialties(profile_id,specialty_id,is_primary,display_order,owner_visible) values($1,$2,$3,$4,$5)',[pid(i),ids[slug],primary,order,visible]);
 await pg.exec(`create view public.public_expert_detail with(security_invoker=true) as
 select p.id,'[]'::jsonb licenses,'[]'::jsonb experiences,'[]'::jsonb academic_records,'[]'::jsonb educations,'[]'::jsonb professions,
 coalesce((select jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,'is_primary',ps.is_primary) order by ps.display_order) from public.profile_specialties ps join public.specialties s on s.id=ps.specialty_id where ps.profile_id=p.id and ps.owner_visible),'[]'::jsonb) specialties,
 null::text workplace_region,null::text workplace_center_name,null::text workplace_phone,null::text workplace_address,null::text workplace_address_detail,null::text workplace_website_url,null::text workplace_external_contact_url
 from public.profiles p where p.is_public and p.owner_visible and p.verification_status='approved' and p.suspended_at is null and p.deletion_requested_at is null;
 grant select on public.public_expert_detail to anon,authenticated;`);
 const rich=await readFile('supabase/migrations/20261118123253_detail_rich_media.sql','utf8');
 await pg.exec(fn(rich,'public.get_representative_profiles'));
 await pg.exec('revoke all on function public.get_representative_profiles(uuid[]) from public;grant execute on function public.get_representative_profiles(uuid[]) to anon,authenticated');
 for(let i=1;i<=11;i++){
  const content={headline:`Unrelated ${i}`,introduction:'unchanged',sections:[],activities:[],privateSentinel:'synthetic only'};
  let specialties=await scalar('select specialties v from public.public_expert_detail where id=$1',[pid(i)]);
  if(i===3)specialties=specialties.filter(s=>s.slug==='conditioning');
  if(i===5)specialties=[{slug:'conditioning',name:'stale nonmatching name'}];
  if(i===6)specialties.push({slug:'weight-management',name:specialties[0].name,is_primary:true,unpublishedExtra:'must never become public'});
  if(i===11)specialties=specialties.map(({is_primary,...item})=>item);
  if(i===9)specialties=[{slug:'sports-performance',name:specialties.find(s=>s.slug==='sports-performance').name,is_primary:true},...specialties.filter(s=>s.slug==='conditioning')];
  await pg.query("insert into public.profile_versions(profile_id,owner_id,draft_content,published_content,published_expert) values($1,$2,$3,$3,$4)",[pid(i),uid(i),JSON.stringify(content),JSON.stringify({specialties,otherUnrelated:{sentinel:i},experiences:[]})]);
 }
 const before=await scalar(stateSQL), beforeVisible={};for(let i=1;i<=11;i++)beforeVisible[i]=await publicSlugs(i);
 eq(beforeVisible[5],[],'stale snapshot missing primary is not public before migration');
 eq(beforeVisible[6],['weight-management'],'extra object fields fail getter containment');
 eq(beforeVisible[11],['weight-management','sport-specific-training'],'missing primary field still matches getter containment when other fields match');
 const aclSQL="select jsonb_object_agg(proname,jsonb_build_object('acl',proacl::text,'definer',prosecdef)) v from pg_proc where pronamespace='public'::regnamespace and proname in('replace_profile_specialties','replace_profile_professions','check_max_specialties','check_max_primary_specialty','get_representative_profiles')";
 const originalACL=await scalar(aclSQL);
 const beforeGetter=await scalar("select pg_get_functiondef('public.get_representative_profiles(uuid[])'::regprocedure) v");
 const migrations=await readdir('supabase/migrations');const name=migrations.find(x=>/^\d+_specialty_categories\.sql$/.test(x));assert.ok(name);
 migrationSQL=await readFile(`supabase/migrations/${name}`,'utf8');rollbackSQL=await readFile('supabase/rollback/specialty_categories.sql','utf8');
 async function migrationPreflightFailure(change,expected){
  await pg.exec('begin');await change();
  await assert.rejects(pg.exec(migrationSQL),e=>e.message.includes(expected));checks++;
  await pg.exec('rollback');eq(await scalar(stateSQL),before,'failed preparation rolls back every data and DDL change');
  eq(await scalar("select to_regnamespace('specialty_taxonomy_private')::text v"),null,'failed migration leaves no private backup schema');
 }
 await migrationPreflightFailure(()=>pg.exec("insert into public.specialties(slug,name,sort_order) values('conflicting-new','스포츠·컨디셔닝',99)"),'specialty_taxonomy_catalog_conflict');
 const driftedWriter=fn(specialtySource,'public.replace_profile_specialties').replace('FROM public.profiles WHERE user_id = v_user_id;','FROM public.profiles WHERE user_id = v_user_id /* unexpected live definition */;');
 await migrationPreflightFailure(()=>pg.exec(driftedWriter),'specialty_taxonomy_writer_definition_drift');
 await pg.exec(migrationSQL);
 ids=Object.fromEntries((await pg.query('select slug,id from public.specialties')).rows.map(r=>[r.slug,r.id]));
 const after=await scalar(stateSQL);
 eq(await scalar(aclSQL),originalACL,'public function ACLs and definer modes unchanged');
 eq(await scalar("select pg_get_functiondef('public.get_representative_profiles(uuid[])'::regprocedure) v"),beforeGetter,'public getter unchanged');
 eq((await run('anon','select slug from public.specialties order by sort_order')).map(r=>r.slug),['weight-management','strength-body-profile','posture-pain-management','rehab-post-surgery','sports-performance','pilates-yoga-flexibility','prenatal-postnatal','youth-exercise','senior-fall-prevention','chronic-special-populations','hospital-work'],'eleven active categories in handoff order');
 eq(await scalar("select count(*)::int v from public.specialties"),13,'both retired source rows preserved');
 eq(await scalar("select array_agg(slug order by slug) v from public.professions where is_medical_technician"),['physical-therapist'],'only existing stable physical therapist slug seeded');
 eq(await scalar("select array_agg(slug) v from public.specialties where medical_technician_only"),['hospital-work'],'only hospital restricted');
 const merged=await scalar('select to_jsonb(ps) v from public.profile_specialties ps where profile_id=$1 and specialty_id=$2',[pid(1),ids['sports-performance']]);
 eq([merged.is_primary,merged.display_order,merged.owner_visible],[true,0,false],'merge OR primary, earliest order, hidden wins');
 for(const i of [2,3,6,9,11])eq(await publicSlugs(i),[...new Set(beforeVisible[i].map(s=>['conditioning','sport-specific-training'].includes(s)?'sports-performance':s))],'old visible specialty intersection remains compatible');
 for(const i of [1,4,5,10])eq(await publicSlugs(i),[],'hidden/stale items never become newly public');
 for(let i=0;i<before.versions.length;i++){
  const original=before.versions[i],current=after.versions.find(v=>v.id===original.id);
  eq(current.draft_content,original.draft_content,'draft content untouched');eq(current.published_content,original.published_content,'published content untouched');
  const {specialties:oldSpecialties,...oldRest}=original.published_expert,{specialties:newSpecialties,...newRest}=current.published_expert;eq(newRest,oldRest,'unrelated expert content untouched');
 }
 eq(await scalar("select bool_and(relrowsecurity) v from pg_class where relnamespace='specialty_taxonomy_private'::regnamespace and relkind='r'"),true,'private backup RLS');
 for(const role of ['anon','authenticated','service_role']){
  await fails(role,'select * from specialty_taxonomy_private.snapshot_backup',[],'42501');
  eq(await scalar("select has_schema_privilege($1,'specialty_taxonomy_private','usage') v",[role]),false,'no backup schema usage');
 }
 const runsBefore=await scalar('select count(*)::int v from specialty_taxonomy_private.runs');
 await pg.exec(migrationSQL);eq(await scalar(stateSQL),after,'migration rerun is data-idempotent');eq(await scalar('select count(*)::int v from specialty_taxonomy_private.runs'),runsBefore,'rerun does not duplicate backups');
 async function rollbackConflict(change,label){
  const unchanged=await scalar(stateSQL);await pg.exec('begin');await change();
  await assert.rejects(pg.exec(rollbackSQL),e=>e.message.includes('specialty_taxonomy_rollback_conflict'));checks++;
  await pg.exec('rollback');eq(await scalar(stateSQL),unchanged,`${label}: no partial rollback`);
 }
 await rollbackConflict(()=>pg.query('update public.profile_specialties set owner_visible=not owner_visible where profile_id=$1 and specialty_id=$2',[pid(1),ids['sports-performance']]),'subsequent selection edit');
 await rollbackConflict(()=>pg.exec("update public.specialties set name='Later admin edit' where slug='weight-management'"),'catalog edit');
 await rollbackConflict(()=>pg.exec("update public.specialties set slug='later-admin-slug' where slug='weight-management'"),'stable slug edit');
 await rollbackConflict(()=>pg.exec("insert into public.specialties(slug,name,sort_order) values('unrelated-later','스포츠 퍼포먼스',99)"),'new category collides with restored old name');
 await rollbackConflict(()=>pg.query("update public.profile_versions set published_expert=jsonb_set(published_expert,'{specialties}','[]') where profile_id=$1",[pid(2)]),'snapshot edit');
 await rollbackConflict(()=>pg.exec("alter function public.replace_profile_specialties(jsonb) set search_path='pg_catalog'"),'function definition drift');
 await rollbackConflict(async()=>{await claim(8);eq((await selectSpecialties(['hospital-work'])).ok,true,'medical hospital selected');},'new hospital choice');

 await fails('anon',"select * from public.replace_profile_specialties('[]')",[],'42501');
 await claim(0);eq((await selectSpecialties(['weight-management'])).ok,false,'no authenticated uid');
 await claim(7);eq((await selectSpecialties(['hospital-work'])).ok,false,'nonmedical RPC rejects hospital');
 await fails('authenticated','insert into public.profile_specialties(profile_id,specialty_id) values($1,$2)',[pid(7),ids['hospital-work']]);
 await fails('authenticated','update public.profile_specialties set specialty_id=$1 where profile_id=$2',[ids['hospital-work'],pid(7)]);
 await fails('authenticated','insert into public.profile_specialties(profile_id,specialty_id) values($1,$2)',[pid(8),ids['posture-pain-management']],'42501');
 await fails('authenticated','insert into public.profile_specialties(profile_id,specialty_id) values($1,$2)',[pid(7),ids['conditioning']]);
 eq((await selectSpecialties([])).ok,false,'zero specialties rejected');
 eq((await selectSpecialties(['weight-management','strength-body-profile','posture-pain-management','rehab-post-surgery'])).ok,false,'four specialties rejected');
 eq((await selectProfessions([])).ok,false,'zero professions rejected');
 eq((await selectProfessions(['physical-therapist','personal-trainer','health-exercise-manager','athletic-trainer','pilates-instructor','rehab-exercise-specialist'])).ok,false,'six professions rejected');
 eq((await selectProfessions(['physical-therapist'])).ok,true,'medical profession set first');
 eq((await selectSpecialties(['hospital-work'],false)).ok,true,'hospital alone meets minimum even when owner hides it');
 const hospitalSelection=await scalar('select jsonb_agg(to_jsonb(ps)) v from public.profile_specialties ps where profile_id=$1',[pid(7)]);
 eq((await selectProfessions(['personal-trainer'])).ok,false,'cannot remove last medical profession while hospital selected');
 eq(await scalar('select jsonb_agg(to_jsonb(ps)) v from public.profile_specialties ps where profile_id=$1',[pid(7)]),hospitalSelection,'rejection never auto-deletes selection');
 await fails('authenticated','delete from public.profile_professions where profile_id=$1',[pid(7)]);
 await fails('authenticated','update public.profile_professions set profession_id=$1 where profile_id=$2',[prof['personal-trainer'],pid(7)]);
 eq((await selectProfessions(['physical-therapist','personal-trainer'])).ok,true,'replace-all retains medical eligibility through deferred check');
 eq((await selectProfessions(['physical-therapist','personal-trainer','health-exercise-manager','athletic-trainer','custom'])).ok,true,'five professions including validated custom role remain supported');
 eq((await selectSpecialties(['hospital-work','weight-management','strength-body-profile'])).ok,true,'medical user combined maximum three');
 await fails('postgres','update public.professions set is_medical_technician=false where id=$1',[prof['physical-therapist']]);
 await fails('postgres','update public.professions set is_active=false where id=$1',[prof['physical-therapist']]);
 await fails('authenticated','insert into public.profile_specialties(profile_id,specialty_id) values($1,$2)',[pid(7),ids['posture-pain-management']]);
 eq((await selectSpecialties(['weight-management'])).ok,true,'explicitly remove hospital before changing profession');
 eq((await selectProfessions(['personal-trainer'])).ok,true,'profession removal succeeds after explicit hospital removal');
 eq((await selectSpecialties(['hospital-work'])).ok,false,'opposite writer order: committed profession removal blocks later hospital selection');
 for(const status of ['draft','rejected','approved']){
  await pg.query('update public.profiles set verification_status=$1 where id=$2',[status,pid(7)]);
  eq((await selectSpecialties(['weight-management'])).ok,true,'existing allowed specialty status preserved');
  eq((await selectProfessions(['personal-trainer'])).ok,true,'existing allowed profession status preserved');
 }
 await pg.query("update public.profiles set verification_status='pending' where id=$1",[pid(7)]);
 eq((await selectSpecialties(['weight-management'])).ok,false,'pending status still blocked');eq((await selectProfessions(['personal-trainer'])).ok,false,'pending profession status blocked');
 await pg.query("update public.profiles set verification_status='approved' where id=$1",[pid(7)]);
 const medical=await scalar('select specialty_taxonomy_private.is_medical($1) v',[pid(8)]);eq(medical,true,'eligibility from current stored profession');
 await pg.query('update public.profile_professions set owner_visible=false where profile_id=$1',[pid(8)]);eq(await scalar('select specialty_taxonomy_private.is_medical($1) v',[pid(8)]),true,'private profession still counts as real qualification');
 const rowLockDefinitions=await scalar("select bool_and(position('FOR UPDATE' in upper(pg_get_functiondef(signature::regprocedure)))>0) v from specialty_taxonomy_private.function_backup where run_id in(select id from specialty_taxonomy_private.runs where applied)");
 eq(rowLockDefinitions,true,'both existing writers lock actual profile row');
 eq(await scalar("select exists(select 1 from pg_trigger where tgname='profession_medical_taxonomy_guard' and tgdeferrable and tginitdeferred) v"),true,'direct profession writes have final-state constraint');
 const beforeRollback=await scalar(stateSQL);
 await pg.exec(rollbackSQL);
 const restored=await scalar(stateSQL);
 eq(restored.specialties.filter(s=>s.slug!=='hospital-work').map(({medical_technician_only,...s})=>s),before.specialties,'catalog originals restored without deleting source rows');
 eq(restored.specialties.find(s=>s.slug==='hospital-work').is_active,false,'new hospital row retained inactive');
 eq(restored.selections.filter(s=>s.profile_id!==pid(7)),before.selections.filter(s=>s.profile_id!==pid(7)),'original merged selections fully restored including timestamps and visibility');
 eq(restored.versions,before.versions,'specialty arrays and all other version data restored');
 eq(restored.professionSelections,beforeRollback.professionSelections,'rollback preserves later unrelated profession edits');
 eq(await scalar(aclSQL),originalACL,'rollback preserves narrow function ACLs');
 const restoredState=await scalar(stateSQL);await pg.exec(rollbackSQL);eq(await scalar(stateSQL),restoredState,'rollback rerun idempotent');
 await pg.exec(migrationSQL);eq(await scalar('select count(*)::int v from specialty_taxonomy_private.runs'),2,'reapply records fresh run and retains previous backup');
 await pg.exec(rollbackSQL);eq(await scalar(stateSQL),restoredState,'second apply/rollback restores same state');
 console.log(`PASS: ${checks} isolated taxonomy/merge/privacy/snapshot/owner/eligibility/limits/rerun/rollback checks. No real DB. PGlite serializes sessions; true concurrent-client scheduling is not exercised.`);
}catch(error){console.error('FAIL:',error.code||'',error.message,'line',error.query&&error.position?error.query.slice(0,Number(error.position)).split('\n').length:'unknown');process.exitCode=1;}
finally{await pg.close();}
