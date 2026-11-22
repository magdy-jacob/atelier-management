// Local backup/restore round-trip verification, not a live Supabase test.
// Run: npm run test:backup. Needs embedded-postgres (devDependency) and a
// pg_dump/pg_restore/psql whose major version is >= the embedded server's
// (PostgreSQL 18): put their bin directory on PATH or pass PGBIN=/path/to/bin.
//
// Uses three temporary local PostgreSQL instances:
//   A: stub vendor schemas + all migrations + representative fixture rows (the "source project")
//   B: stub + all migrations, then DATA-ONLY pg_restore from A's dump (recommended path: repo holds schema)
//   C: fresh migration-built target for the named Studio-profile archive
// The backup is ONE custom-format pg_dump (single consistent snapshot).
// The migration-based restore reads that exact file. Original Auth UUIDs are preserved by
// the supported Admin API payload helper using a LOCAL provider adapter.
// This verifies payload/binding logic, not real GoTrue service operation.
// Any failed step fails the whole run with exit 1.
import EmbeddedPostgres from "embedded-postgres";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { restoreIdentities } from '../scripts/restore-auth.mjs';
import { restoreStorage } from '../scripts/restore-storage.mjs';
import { verifyBackup } from '../scripts/verify-backup.mjs';
async function restoreAuth(source,target) {
  const identities=(await source.query("select id,email,true email_confirmed,raw_app_meta_data app_metadata from auth.users order by id")).rows;
  const admin={
    async getUserById(id) {
      const r=await target.query('select id,email,email_confirmed_at,raw_app_meta_data app_metadata from auth.users where id=$1',[id]);
      return r.rows[0]?{data:{user:r.rows[0]}}:{data:{user:null},error:{status:404}};
    },
    async createUser(value) {
      await target.query('insert into auth.users(id,email,raw_app_meta_data,email_confirmed_at) values($1,$2,$3,$4)',[value.id,value.email,value.app_metadata,value.email_confirm?new Date():null]);
      return this.getUserById(value.id);
    }
  };
  await restoreIdentities(identities,admin,async()=> 'isolated-test-only-password');
  // Wrong binding must reject instead of silently accepting existing identity.
  const bad=structuredClone(identities); bad[0].email='different@example.invalid';
  await assert.rejects(()=>restoreIdentities(bad,admin,async()=>''));
  const unconfirmed=structuredClone(identities);unconfirmed[0].email_confirmed=false;
  await assert.rejects(()=>restoreIdentities(unconfirmed,admin,async()=>''));
  await target.query('update auth.users set email_confirmed_at=null where id=$1',[identities[0].id]);
  await assert.rejects(()=>restoreIdentities(identities,admin,async()=>{throw Error('must_not_reset_existing_password');}));
  assert.equal((await admin.getUserById(identities[0].id)).data.user.email_confirmed_at,null);
  await target.query('update auth.users set email_confirmed_at=now() where id=$1',[identities[0].id]);
  console.log('PASS existing-identity confirmation-state mismatch fails closed without update');
}

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR
  ?? fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const PGBIN = process.env.PGBIN ?? "";
const pgRestore = PGBIN ? path.join(PGBIN,"pg_restore") : "pg_restore";
const psqlBin = PGBIN ? path.join(PGBIN,"psql") : "psql";
const toolEnv = { ...process.env, PATH:PGBIN ? PGBIN+path.delimiter+process.env.PATH : process.env.PATH };
const PASSWORD = "local-test-only";

const OLD_ADMIN = "11111111-1111-4111-8111-111111111111";
const OLD_EMPLOYEE = "22222222-2222-4222-8222-222222222222";
const OLD_EMPLOYEE2 = "33333333-3333-4333-8333-333333333333";
const PENDING_JOB_USER = "55555555-5555-4555-8555-555555555555";
const DRESS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUB_SQL = `create role anon nologin;create role authenticated nologin;create role service_role nologin;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}'::jsonb,email_confirmed_at timestamptz,banned_until timestamptz);create table auth.mfa_factors(user_id uuid);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;`;

let failures = 0;
function fail(label, detail) {
  failures++;
  console.log("FAIL", label, detail ?? "");
}

async function makeCluster(port) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `atelier-bkp-${port}-`));
  const cluster = new EmbeddedPostgres({
    databaseDir: dir, user: "postgres", password: PASSWORD, port,
    persistent: false, postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => {}, onError: (m) => console.error(m),
  });
  await cluster.initialise();
  await cluster.start();
  const client = cluster.getPgClient();
  await client.connect();
  return { cluster, client, url: `postgresql://postgres:${PASSWORD}@127.0.0.1:${port}/postgres` };
}

async function applyMigrations(client) {
  const dir = await fs.readdir(MIGRATIONS_DIR);
  for (const file of dir.filter((f) => f.endsWith(".sql")).sort()) {
    await client.query(await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
}

// Hash full rows, including all unchanged identity UUIDs and versions.
async function tableHash(client, table) {
  const rowExpr = "t::text";
  const r = await client.query(
    `select coalesce(md5(string_agg(h, '' order by h)), 'empty') as hash
     from (select md5(${rowExpr}) as h from public."${table}" t) s`,
  );
  return r.rows[0].hash;
}

async function catalogCounts(client) {
  const r = await client.query(
    `select
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,
       (select count(*) from pg_policy pol join pg_class c on c.oid=pol.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') as policies,
       (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal) as triggers`,
  );
  return r.rows[0];
}

async function validateBindings(client,label) {
  const missing=await client.query("select count(*)::int n from public.profiles p left join auth.users u on u.id=p.id where u.id is null");
  assert.equal(missing.rows[0].n,0);
  const jobs=await client.query("select j.*,u.raw_app_meta_data from public.employee_account_jobs j left join auth.users u on u.id=j.user_id where j.status='completed'");
  for(const j of jobs.rows) {
    assert.equal(j.raw_app_meta_data?.lovely_staff_job,j.id);
    assert.equal(j.raw_app_meta_data?.lovely_staff_actor,j.actor_id);
  }
  assert.equal((await client.query("select version from public.profiles where id=$1",[OLD_ADMIN])).rows[0].version,3);
  console.log('PASS '+label+': original identities, completed-job Auth bindings and profile versions preserved');
}

const clusters = [];
async function cleanup() {
  // Close clients before stopping their clusters, or shutdown races the
  // open connection and prints spurious termination errors.
  for (const { client } of clusters) { try { await client.end(); } catch {} }
  for (const { cluster } of clusters) { try { await cluster.stop(); } catch {} }
}
try {
  const A = await makeCluster(55441);
  clusters.push(A);
  await A.client.query(STUB_SQL);
  await applyMigrations(A.client);

  // Representative fixture rows across the operational tables, exercising
  // every column that references staff profiles or auth users.
  await A.client.query(
    `update public.settings set date_precision='day', business_timezone='Africa/Cairo',
       same_day_allowed=false, payment_methods='{cash,instapay}' where id=true`,
  );
  await A.client.query("insert into auth.users(id) values($1),($2),($3),($4)", [OLD_ADMIN, OLD_EMPLOYEE, OLD_EMPLOYEE2,PENDING_JOB_USER]);
  await A.client.query(
    `insert into public.profiles(id,full_name,role,active) values
       ($1,'Backup Admin','admin',true),($2,'اختبار موظف أول','employee',true),($3,'اختبار موظف ثان','employee',true)`,
    [OLD_ADMIN, OLD_EMPLOYEE, OLD_EMPLOYEE2],
  );
  // Give the admin profile a non-default version so the restore must preserve it.
  await A.client.query("update public.profiles set full_name='Backup Admin A' where id=$1", [OLD_ADMIN]);
  await A.client.query("update public.profiles set full_name='Backup Admin' where id=$1", [OLD_ADMIN]);
  const category = (await A.client.query("insert into public.categories(name) values('فساتين سهرة') returning id")).rows[0].id;
  await A.client.query(
    "insert into public.dresses(id,code,name,color,size,category_id,public_availability) values($1,'BKP-001','فستان اختبار النسخ','سيج','M',$2,'available')",
    [DRESS, category],
  );
  await A.client.query("insert into public.dress_prices(dress_id,advisory_price_piasters) values($1,300000)", [DRESS]);
  await A.client.query("insert into public.dress_operations(dress_id,status) values($1,'in_atelier')", [DRESS]);
  await A.client.query("insert into public.dress_images(dress_id,path,sort_order) values($1,'prototype-demo/backup/main.webp',0)", [DRESS]);
  const customer = (await A.client.query("insert into public.customers(full_name,phone) values('عميلة اختبار النسخ','TEST-001') returning id")).rows[0].id;
  const booking = (await A.client.query(
    `insert into public.bookings(request_id,dress_id,customer_id,starts_on,returns_on,agreed_price_piasters,status,created_by,assigned_to)
     values(gen_random_uuid(),$1,$2,date '2026-12-01',date '2026-12-03',100000,'returned',$3,$4) returning id`,
    [DRESS, customer, OLD_ADMIN, OLD_EMPLOYEE],
  )).rows[0].id;
  const payment = (await A.client.query(
    "insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by) values(gen_random_uuid(),$1,25000,'cash','deposit',$2) returning id",
    [booking, OLD_ADMIN],
  )).rows[0].id;
  await A.client.query("insert into public.late_fees(booking_id,amount_piasters,reason,recorded_by) values($1,5000,'تأخير اختبار النسخ',$2)", [booking, OLD_ADMIN]);
  await A.client.query("insert into public.handover_records(request_id,booking_id,card_received,ready_confirmed,recorded_by) values(gen_random_uuid(),$1,true,true,$2)", [booking, OLD_EMPLOYEE]);
  await A.client.query("insert into public.return_records(request_id,booking_id,card_released,inspection,issues,recorded_by) values(gen_random_uuid(),$1,true,'maintenance','{zipper,sewing}',$2)", [booking, OLD_ADMIN]);
  await A.client.query("insert into public.receipt_confirmations(payment_id,booking_id,request_id,context,customer_returned_on,recorded_by) values($1,$2,gen_random_uuid(),'return_balance',date '2026-12-03',$3)", [payment, booking, OLD_ADMIN]);
  const cancelled = (await A.client.query(
    `insert into public.bookings(request_id,dress_id,customer_id,starts_on,returns_on,agreed_price_piasters,status,created_by)
     values(gen_random_uuid(),$1,$2,date '2026-12-10',date '2026-12-11',80000,'cancelled',$3) returning id`,
    [DRESS, customer, OLD_ADMIN],
  )).rows[0].id;
  await A.client.query("insert into public.booking_cancellations(request_id,booking_id,reason,retained_deposit_piasters,recorded_by) values(gen_random_uuid(),$1,'إلغاء اختبار النسخ',20000,$2)", [cancelled, OLD_ADMIN]);
  await A.client.query("insert into public.booking_changes(request_id,booking_id,recorded_by,reason,old_start,old_return,new_start,new_return,old_price_piasters,new_price_piasters,before_version,after_version) values(gen_random_uuid(),$1,$2,'تعديل اختبار النسخ',date '2026-12-01',date '2026-12-03',date '2026-12-02',date '2026-12-04',100000,120000,1,2)", [booking, OLD_ADMIN]);
  await A.client.query("insert into public.notification_reads(user_id,booking_id,kind,event_on) values($1,$2,'overdue',date '2026-12-04')", [OLD_ADMIN, booking]);
  await A.client.query("insert into public.image_deletion_jobs(request_id,image_id,dress_id,path,status,recorded_by) values(gen_random_uuid(),gen_random_uuid(),$1,'prototype-demo/backup/old.webp','pending',$2)", [DRESS, OLD_ADMIN]);
  await A.client.query(
    `insert into public.employee_account_jobs(request_id,actor_id,user_id,full_name,email,status,completed_at)
     values(gen_random_uuid(),$1,$2,'اختبار موظف ثان','test-second@example.invalid','completed',now())`,
    [OLD_ADMIN, OLD_EMPLOYEE2],
  );
  await A.client.query(
    `insert into public.employee_account_jobs(request_id,actor_id,user_id,full_name,email,status)
     values(gen_random_uuid(),$1,$2,'اختبار موظف معلق','test-pending@example.invalid','pending')`,
    [OLD_ADMIN, PENDING_JOB_USER],
  );
  await A.client.query(
    `insert into public.employee_profile_changes(request_id,employee_id,actor_id,reason,old_name,new_name,old_active,new_active,before_version,after_version)
     values(gen_random_uuid(),$1,$2,'سبب اختبار النسخ','اختبار موظف أول','اختبار موظف أول معدل',true,true,1,2)`,
    [OLD_EMPLOYEE, OLD_ADMIN],
  );
  await A.client.query("update auth.users set email=id::text || '@example.invalid',email_confirmed_at=now()");
  await A.client.query("update auth.users u set email=j.email,raw_app_meta_data=jsonb_build_object('lovely_staff_job',j.id,'lovely_staff_actor',j.actor_id) from public.employee_account_jobs j where j.user_id=u.id");
  console.log("PASS fixture rows inserted into source instance A");

  await A.client.query("insert into storage.objects(bucket_id,name,metadata) values('dress-images','prototype-demo/backup/main.webp','{\"size\":7}'),('dress-images','paths.txt','{\"size\":7}')");
  // Signature fixture is generated ONLY by this explicit local test switch,
  // never by backup capture. The distributed fixture is pinned to 20 migrations.
  if(process.env.REGENERATE_BACKUP_SCHEMA==='1') {
    const modulePath=fileURLToPath(new URL('../scripts/backup-atelier.py',import.meta.url));
    const getSQL="import importlib.util,sys; s=importlib.util.spec_from_file_location('m',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(m.SIGNATURE_SQL)";
    const sql=execFileSync('python3',['-c',getSQL,modulePath],{encoding:'utf8'});
    await A.client.query('set search_path=public,pg_catalog');
    const signature=(await A.client.query(sql)).rows[0].coalesce;
    await A.client.query('begin');
    await A.client.query(await fs.readFile(new URL('../scripts/provider-studio-rls.sql',import.meta.url),'utf8'));
    const provider_function=(await A.client.query("select 'function|' || pg_get_functiondef('public.rls_auto_enable()'::regprocedure) val")).rows[0].val;
    await A.client.query('rollback');
    const crypto=await import('node:crypto'); const source_migrations={};
    for(const f of (await fs.readdir(MIGRATIONS_DIR)).filter(f=>f.endsWith('.sql')).sort()) source_migrations[f]=crypto.createHash('sha256').update(await fs.readFile(path.join(MIGRATIONS_DIR,f))).digest('hex');
    await fs.writeFile(fileURLToPath(new URL('../scripts/backup-schema-v20.json',import.meta.url)),JSON.stringify({signature,source_migrations,provider_function,provider_source:'https://raw.githubusercontent.com/supabase/supabase/master/apps/studio/components/interfaces/Database/Triggers/EventTriggersList/EventTriggers.constants.ts'},null,2)+'\n');
  }
  const canonicalModule=fileURLToPath(new URL('../scripts/backup_canonical.py',import.meta.url));
  execFileSync('python3',['-c',`import importlib.util,sys
s=importlib.util.spec_from_file_location('c',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
assert m.tokens("select  a, 'same  literal'")==m.tokens("select"+chr(10)+" a , 'same  literal'")
assert m.tokens("select 'two  spaces'")!=m.tokens("select 'two spaces'")
assert m.tokens('select a b')!=m.tokens('select ab')
assert m.canonical_entry('constraint|t|n|NOT NULL id') is None
assert m.canonical_entry('column|t|id|uuid|true|')!=m.canonical_entry('column|t|id|uuid|false|')
print('PASS SQL canonicalization preserves literal content, token boundaries and nullable-state differences')`,canonicalModule],{stdio:'inherit'});
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-capture-'));
  const capturePy=fileURLToPath(new URL('../scripts/backup-atelier.py',import.meta.url));
  const pythonAdapter=`import importlib.util,sys
spec=importlib.util.spec_from_file_location('backup',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.download=lambda base,name: b'FAKEIMG'
sys.argv=['backup','--quiescent','--output',sys.argv[2]]
m.main()`;
  execFileSync('python3',['-c',pythonAdapter,capturePy,root],{env:{...toolEnv,SUPABASE_DB_URL:A.url,SUPABASE_PROJECT_URL:'https://isolatedtest.supabase.co'},stdio:'inherit'});
  const entries=await fs.readdir(root);assert.equal(entries.length,1);
  const manifest=JSON.parse(await fs.readFile(path.join(root,entries[0],'manifest.json'),'utf8'));
  assert.equal(manifest.snapshot.objects.length,2);assert.equal(manifest.snapshot.paths.length,1);
  assert.equal(manifest.snapshot.identities.length,4);
  assert.equal(manifest.snapshot.migrations,null);
  assert.equal(manifest.snapshot.tables.profiles.count,3);
  console.log('PASS real backup capture: single snapshot, 4 Auth bindings, 2 independently listed Storage objects including unlinked paths.txt');
  // Failed download must publish no complete or partial backup directory.
  const failRoot=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-capture-fail-'));
  const failingAdapter=pythonAdapter.replace("m.download=lambda base,name: b'FAKEIMG'","def fail(base,name): raise RuntimeError('simulated HTTP failure')\nm.download=fail");
  assert.throws(()=>execFileSync('python3',['-c',failingAdapter,capturePy,failRoot],{env:{...toolEnv,SUPABASE_DB_URL:A.url,SUPABASE_PROJECT_URL:'https://isolatedtest.supabase.co'},stdio:'pipe'}));
  assert.deepEqual(await fs.readdir(failRoot),[]);
  console.log('PASS failed Storage capture leaves no completed manifest or partial directory');
  // An unknown live schema must not quietly become an accepted backup.
  await A.client.query('create table public.unexpected_backup_test(id int)');
  assert.throws(()=>execFileSync('python3',['-c',pythonAdapter,capturePy,failRoot],{env:{...toolEnv,SUPABASE_DB_URL:A.url,SUPABASE_PROJECT_URL:'https://isolatedtest.supabase.co'},stdio:'pipe'}));
  assert.deepEqual(await fs.readdir(failRoot),[]);
  await A.client.query('drop table public.unexpected_backup_test');
  console.log('PASS unknown source schema rejected with no published backup');
  // Explicit optional Studio profile, independently pinned to official source.
  const providerSQL=await fs.readFile(new URL('../scripts/provider-studio-rls.sql',import.meta.url),'utf8');
  await A.client.query(providerSQL);
  await A.client.query('revoke all on function public.rls_auto_enable() from public,anon,authenticated,service_role');
  const tableNames=Object.keys(manifest.snapshot.tables);
  for(const t of tableNames) await A.client.query('grant maintain,references,trigger,truncate on public."'+t+'" to service_role');
  const profileRoot=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-provider-'));
  const providerAdapter=pythonAdapter.replace("'--quiescent','--output'","'--quiescent','--provider-profile','supabase-studio-v1','--output'");
  execFileSync('python3',['-c',providerAdapter,capturePy,profileRoot],{env:{...toolEnv,SUPABASE_DB_URL:A.url,SUPABASE_PROJECT_URL:'https://isolatedtest.supabase.co'},stdio:'inherit'});
  // Altering a policy is not tolerated by the provider profile.
  await A.client.query('alter policy bookings_read on public.bookings using(true)');
  assert.throws(()=>execFileSync('python3',['-c',providerAdapter,capturePy,failRoot],{env:{...toolEnv,SUPABASE_DB_URL:A.url,SUPABASE_PROJECT_URL:'https://isolatedtest.supabase.co'},stdio:'pipe'}));
  await A.client.query('alter policy bookings_read on public.bookings using(public.can_view_booking(id))');
  await A.client.query('drop event trigger ensure_rls;drop function public.rls_auto_enable()');
  for(const t of tableNames) await A.client.query('revoke maintain,references,trigger,truncate on public."'+t+'" from service_role');
  console.log('PASS exact optional Studio profile accepts provider-only differences but rejects changed app policy');



  // ONE custom-format dump: a single consistent snapshot for the migration restore path.
  const backupDir=path.join(root,entries[0]);
  await verifyBackup(backupDir);
  const dumpFile=path.join(backupDir,'database.dump');
  const stored=new Map();
  const bucket={
    async upload(name,body,options){assert.equal(options.upsert,false);if(stored.has(name))return{error:{}};stored.set(name,body);return{error:null};},
    async download(name){return{error:null,data:new Blob([stored.get(name)])};}
  };
  await restoreStorage(backupDir,bucket);
  assert.equal(stored.size,2);
  assert.equal(stored.get('paths.txt').toString(),'FAKEIMG');
  await assert.rejects(()=>restoreStorage(backupDir,bucket));
  const originalIndex=await fs.readFile(path.join(backupDir,'storage-index.json'));
  await fs.appendFile(path.join(backupDir,'storage-index.json'),' ');
  await assert.rejects(()=>verifyBackup(backupDir));
  await fs.writeFile(path.join(backupDir,'storage-index.json'),originalIndex);
  await verifyBackup(backupDir);
  console.log('PASS corrupted backup file fails integrity verification');

  console.log('PASS Storage recovery uploads both objects and verifies bytes, rejects overwrite retry');
  console.log("PASS single-snapshot custom-format pg_dump completed");

  const restoreEnv = { ...toolEnv, PGOPTIONS: "-c session_replication_role=replica" };

  // Path 1 (recommended): fresh schema from migrations + data-only restore.
  const B = await makeCluster(55442);
  clusters.push(B);
  await B.client.query(STUB_SQL);
  // Supported preserved-ID Auth API helper, with local provider adapter.
  await restoreAuth(A.client, B.client);
  await applyMigrations(B.client);
  const TRUNCATE_PUBLIC = "do $$ declare t text; begin for t in select tablename from pg_tables where schemaname='public' loop execute format('truncate table public.%I restart identity cascade', t); end loop; end $$";
  execFileSync(psqlBin, ["--single-transaction", "--variable", "ON_ERROR_STOP=1", "--dbname", B.url,
    "--command", TRUNCATE_PUBLIC], { stdio: "inherit", env: toolEnv });
  execFileSync(pgRestore, ["--data-only", "--schema=public", "--no-owner", "--single-transaction", "--exit-on-error", "--dbname", B.url, dumpFile], { stdio: "inherit", env: restoreEnv });
  console.log("PASS path 1: data-only pg_restore into migration-built schema");
  await validateBindings(B.client, "path 1");
  const integritySQL=await fs.readFile(new URL('../scripts/validate-restored.sql',import.meta.url),'utf8');
  await B.client.query(integritySQL);
  await B.client.query('begin;set local session_replication_role=replica');
  await B.client.query('delete from auth.users where id=$1',[OLD_ADMIN]);
  await assert.rejects(()=>B.client.query(integritySQL));
  await B.client.query('rollback');
  console.log('PASS all-FK integrity sweep succeeds and deliberately missing Auth parent fails closed');

  // Restore the actual Studio-profile capture as well, including the
  // independent provider function/event setup and exact service-role grants.
  const C=await makeCluster(55443);clusters.push(C);
  await C.client.query(STUB_SQL);await restoreAuth(A.client,C.client);await applyMigrations(C.client);
  await C.client.query(providerSQL);
  await C.client.query('revoke all on function public.rls_auto_enable() from public,anon,authenticated,service_role');
  for(const t of tableNames) await C.client.query('grant maintain,references,trigger,truncate on public."'+t+'" to service_role');
  execFileSync(psqlBin,['--single-transaction','--variable','ON_ERROR_STOP=1','--dbname',C.url,'--command',TRUNCATE_PUBLIC],{env:toolEnv,stdio:'inherit'});
  const profileEntries=await fs.readdir(profileRoot);
  execFileSync(pgRestore,['--data-only','--schema=public','--no-owner','--single-transaction','--exit-on-error','--dbname',C.url,path.join(profileRoot,profileEntries[0],'database.dump')],{env:restoreEnv,stdio:'inherit'});
  await C.client.query(integritySQL);await validateBindings(C.client,'Studio-profile restore');
  for(const t of tableNames) assert.equal(await tableHash(C.client,t),await tableHash(A.client,t),t);
  const providerCat=await catalogCounts(C.client);assert.equal(providerCat.functions,'40');
  console.log('PASS actual Studio-profile archive round-trip:24 tables identical plus reviewed provider function/event configuration');

  // Content comparison on every public table.
  const tables = (await A.client.query(
    "select tablename from pg_tables where schemaname='public' order by tablename",
  )).rows.map((r) => r.tablename);
  for (const table of tables) {
    const hashA = await tableHash(A.client, table);
    for (const [label, inst] of [["migration restore", B]]) {
      const hashR = await tableHash(inst.client, table);
      if (hashR !== hashA) fail(`${label}: content mismatch`, table);
    }
  }
  if (failures === 0) console.log(`PASS per-table content identical on ${tables.length} public tables for the migration restore path`);

  const catA = await catalogCounts(A.client);
  for (const [label, inst] of [["migration restore", B]]) {
    const catR = await catalogCounts(inst.client);
    if (JSON.stringify(catR) !== JSON.stringify(catA)) fail(`${label}: catalog mismatch`, JSON.stringify(catR));
  }
  if (failures === 0) console.log(`PASS catalog objects match after restore: ${catA.functions} functions, ${catA.policies} policies, ${catA.triggers} triggers`);

  // Restored schema still enforces RLS: anonymous role reads nothing from payments on B.
  await B.client.query("begin");
  await B.client.query("set local role anon");
  await assert.rejects(() => B.client.query("select count(*) from public.payments"));
  await B.client.query("rollback");
  console.log("PASS restored instance still enforces RLS for anonymous role");
} catch (error) {
  fail("unexpected error", String(error && error.message ? error.message : error).slice(0, 500));
} finally {
  await cleanup();
}
if (failures > 0) {
  console.log(`RESULT FAIL: ${failures} failing check(s)`);
  process.exitCode=1;
}
if (failures===0) console.log("RESULT PASS: backup/restore round-trip verification complete");
