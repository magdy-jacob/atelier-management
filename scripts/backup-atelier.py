#!/usr/bin/env python3
"""Read-only Atelier backup, Python 3 standard library + PostgreSQL clients.
Run only while all app/admin/Storage writers are stopped for this manual window.
Credentials stay in PGDATABASE / SUPABASE_DB_URL, never output or saved.
"""
import argparse, datetime, hashlib, json, os, pathlib, re, shutil, subprocess, tempfile, urllib.request, urllib.parse, sys
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from backup_canonical import canonical

TABLES = '''profiles settings categories dresses dress_prices dress_operations dress_images customers bookings payments late_fees activity_logs notification_reads handover_records return_records image_deletion_jobs synthetic_customers synthetic_bookings portfolio_scenarios receipt_confirmations booking_cancellations employee_account_jobs employee_profile_changes booking_changes'''.split()

SIGNATURE_SQL = """select coalesce(json_agg(d order by d),'[]') from (
 select 'column|'||c.relname||'|'||a.attname||'|'||format_type(a.atttypid,a.atttypmod)||'|'||a.attnotnull::text||'|'||coalesce(pg_get_expr(ad.adbin,ad.adrelid),'') d from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid left join pg_attrdef ad on ad.adrelid=c.oid and ad.adnum=a.attnum where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped
 union all select 'constraint|'||c.relname||'|'||x.conname||'|'||pg_get_constraintdef(x.oid) from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 union all select 'function|'||pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 union all select 'policy|'||schemaname||'|'||tablename||'|'||policyname||'|'||roles::text||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'') from pg_policies where schemaname='public' or (schemaname='storage' and policyname like 'dress_images_%')
 union all select 'trigger|'||pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
 union all select 'rls|'||relname||'|'||relrowsecurity::text||'|'||relforcerowsecurity::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
 union all select 'table_grant|'||c.relname||'|'||coalesce(r.rolname,'PUBLIC')||'|'||a.privilege_type||'|'||a.is_grantable::text from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a left join pg_roles r on r.oid=a.grantee where n.nspname='public' and c.relkind='r' and (a.grantee=0 or r.rolname in ('anon','authenticated','service_role'))
 union all select 'function_grant|'||p.oid::regprocedure::text||'|'||coalesce(r.rolname,'PUBLIC')||'|'||a.privilege_type||'|'||a.is_grantable::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles r on r.oid=a.grantee where n.nspname='public' and (a.grantee=0 or r.rolname in ('anon','authenticated','service_role'))
 union all select 'function_owner|'||p.oid::regprocedure::text||'|'||pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 union all select 'event|'||e.evtname||'|'||e.evtevent||'|'||e.evtenabled::text||'|'||pg_get_userbyid(e.evtowner)||'|'||array_to_string(array(select unnest(e.evttags) order by 1),',') from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 ) descriptions"""

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def safe_name(s):
    if not isinstance(s,str) or not s or any(x in ('', '.', '..') for x in s.split('/')) or s.startswith('/') or '\\' in s or any(ord(c)<32 for c in s):
        raise RuntimeError('Unsafe Storage object name')
    return s

class Session:
    def __init__(self, env):
        self.p = subprocess.Popen(['psql','--dbname',env['PGDATABASE'],'-X','-qAt','-v','ON_ERROR_STOP=1'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, env=env)
    def query(self, sql):
        self.p.stdin.write(sql.rstrip(';')+';\n'); self.p.stdin.flush()
        line=self.p.stdout.readline()
        if not line: raise RuntimeError('Database query failed')
        return json.loads(line) if line.strip() else None
    def close(self):
        try: self.p.communicate('rollback;\n', timeout=10)
        except Exception: self.p.kill(); self.p.wait()

def capture(s,provider_profile=None,schema_version=22):
    signature=sorted(s.query(SIGNATURE_SQL))
    expected=json.loads(pathlib.Path(__file__).with_name(f'backup-schema-v{schema_version}.json').read_text())
    wanted=canonical(expected['signature'])
    if provider_profile=='supabase-studio-v1':
        wanted += canonical([expected['provider_function']])
        wanted += ['function_owner|rls_auto_enable()|postgres','event|ensure_rls|ddl_command_end|O|postgres|CREATE TABLE,CREATE TABLE AS,SELECT INTO']
        wanted += [f'table_grant|{t}|service_role|{p}|false' for t in TABLES for p in ('MAINTAIN','REFERENCES','TRIGGER','TRUNCATE')]
    if canonical(signature)!=sorted(wanted): raise RuntimeError('Unknown schema signature; refuse backup until source-coordinated review')
    tables=s.query("select coalesce(json_agg(tablename order by tablename),'[]') from pg_tables where schemaname='public'")
    if sorted(tables)!=sorted(TABLES): raise RuntimeError('Unexpected schema version: expected versioned public table set')
    rows={}
    for t in tables:
        rows[t]=s.query('select json_build_object(\'count\',count(*),\'hash\',md5(coalesce(string_agg(h,\'\' order by h),\'\'))) from (select md5(row_to_json(t)::text) h from public."'+t+'" t) x')
    objects=s.query("select coalesce(json_agg(json_build_object('path',name,'metadata',metadata,'id',id) order by name),'[]') from storage.objects where bucket_id='dress-images'")
    paths=s.query("select coalesce(json_agg(path order by path),'[]') from public.dress_images")
    identities=s.query("""select coalesce(json_agg(json_build_object('id',id,'email',email,'email_confirmed',email_confirmed_at is not null,'app_metadata', jsonb_strip_nulls(jsonb_build_object('lovely_staff_job',raw_app_meta_data->'lovely_staff_job','lovely_staff_actor',raw_app_meta_data->'lovely_staff_actor'))) order by id),'[]') from auth.users where id in (select id from public.profiles union select user_id from public.employee_account_jobs)""")
    missing=s.query("select to_json(count(*)) from public.profiles p left join auth.users u on u.id=p.id where u.id is null")
    badjobs=s.query("select to_json(count(*)) from public.employee_account_jobs j left join auth.users u on u.id=j.user_id where (j.status='completed' and u.id is null) or (u.id is not null and (u.email is distinct from j.email or u.raw_app_meta_data->>'lovely_staff_job' is distinct from j.id::text or u.raw_app_meta_data->>'lovely_staff_actor' is distinct from j.actor_id::text))")
    if missing or badjobs or any(not x['email'] for x in identities): raise RuntimeError('Missing or conflicting Auth application binding')
    unsupported=s.query("""select json_build_object('mfa', (select count(*) from auth.mfa_factors where user_id in (select id from public.profiles union select user_id from public.employee_account_jobs)), 'banned',(select count(*) from auth.users where id in (select id from public.profiles union select user_id from public.employee_account_jobs) and banned_until>now()))""")
    if unsupported['mfa'] or unsupported['banned']: raise RuntimeError('MFA or active bans need separate recovery, refusing incomplete backup')
    tracker=s.query("select to_json(to_regclass('supabase_migrations.schema_migrations')::text)")
    migrations=s.query("select coalesce(json_agg(json_build_object('version',version,'name',name) order by version),'[]') from supabase_migrations.schema_migrations") if tracker else None
    return dict(tables=rows, objects=objects, paths=paths, identities=identities, migrations=migrations, source_migrations=expected['source_migrations'], schema_signature_sha256=hashlib.sha256(json.dumps(signature).encode()).hexdigest())

def download(base, name):
    url=base+'/storage/v1/object/public/dress-images/'+urllib.parse.quote(safe_name(name),safe='/')
    with urllib.request.urlopen(url, timeout=60) as response:
        if response.status!=200: raise RuntimeError('Storage HTTP error')
        return response.read()

def main():
    p=argparse.ArgumentParser(); p.add_argument('--quiescent',action='store_true',help='Confirm all writers are stopped until backup finishes'); p.add_argument('--output',default='backups'); p.add_argument('--schema-version',type=int,choices=[20,21,22],default=22); p.add_argument('--provider-profile',choices=['supabase-studio-v1']); a=p.parse_args()
    if not a.quiescent: raise RuntimeError('Stop app/admin/Storage writers first, then pass --quiescent')
    env=dict(os.environ)
    if env.get('PGBIN'): env['PATH']=env['PGBIN']+os.pathsep+env.get('PATH','')
    env['PGDATABASE']=env.get('SUPABASE_DB_URL') or env.get('PGDATABASE','')
    if not env['PGDATABASE']: raise RuntimeError('Set SUPABASE_DB_URL securely')
    base=env.get('SUPABASE_PROJECT_URL','').rstrip('/')
    if not re.fullmatch(r'https://[a-z0-9]+\.supabase\.co',base): raise RuntimeError('Expected Supabase HTTPS project URL')
    root=pathlib.Path(a.output); root.mkdir(mode=0o700,parents=True,exist_ok=True)
    partial=pathlib.Path(tempfile.mkdtemp(prefix='.partial-',dir=root)); os.chmod(partial,0o700)
    session=None
    try:
        session=Session(env)
        session.p.stdin.write('begin isolation level repeatable read read only;set local search_path=public,pg_catalog;\n'); session.p.stdin.flush()
        version=session.query("select to_json(current_setting('server_version_num')::int)")//10000
        client=int(re.search(r'\d+',subprocess.check_output(['pg_dump','--version'],text=True,env=env)).group())
        if client<version: raise RuntimeError('pg_dump client older than server')
        snapshot=session.query('select to_json(pg_export_snapshot())')
        before=capture(session,a.provider_profile,a.schema_version)
        # Independent Storage inventory covers ALL bucket objects, including unlinked ones.
        names=[safe_name(x['path']) for x in before['objects']]
        if len(names)!=len(set(names)) or not set(before['paths']).issubset(names): raise RuntimeError('Storage inventory missing linked images or duplicate names')
        subprocess.run(['pg_dump','--dbname',env['PGDATABASE'],'--format=custom','--schema=public','--no-owner','--snapshot='+snapshot,'--file',str(partial/'database.dump')],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        (partial/'objects').mkdir()
        index=[]
        for n,obj in enumerate(before['objects']):
            body=download(base,obj['path']); filename=f'{n:06d}.blob'; (partial/'objects'/filename).write_bytes(body)
            expected=obj['metadata'].get('size') if isinstance(obj['metadata'],dict) else None
            if expected is not None and len(body)!=int(expected): raise RuntimeError('Storage size differs from independent metadata')
            index.append(dict(path=obj['path'],content_type=(obj['metadata'] or {}).get('mimetype','image/webp'),file='objects/'+filename,sha256=hashlib.sha256(body).hexdigest(),bytes=len(body)))
        # Re-download to detect overwrites during copy; metadata read at the end
        # also detects insert/delete/update. Quiescence is still mandatory.
        for obj in index:
            if hashlib.sha256(download(base,obj['path'])).hexdigest()!=obj['sha256']: raise RuntimeError('Storage object changed during backup')
        check=Session(env)
        try:
            check.p.stdin.write('begin isolation level repeatable read read only;set local search_path=public,pg_catalog;\n'); check.p.stdin.flush()
            after=capture(check,a.provider_profile,a.schema_version)
        finally: check.close()
        if before!=after: raise RuntimeError('Source changed during backup; retry with all writers stopped')
        (partial/'identities.json').write_text(json.dumps(before['identities'],ensure_ascii=False,indent=2)+'\n')
        (partial/'storage-index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
        manifest=dict(format=3,schema_version=a.schema_version,project_url=base,provider_profile=a.provider_profile,scope='versioned public schema + dress-images + email/Auth application bindings; no passwords or MFA',created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),snapshot=before,files={str(f.relative_to(partial)):digest(f) for f in sorted(partial.rglob('*')) if f.is_file()})
        # Manifest is written last, then the WHOLE backup is atomically renamed.
        (partial/'manifest.json.tmp').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        os.replace(partial/'manifest.json.tmp',partial/'manifest.json')
        final=root/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+partial.name.removeprefix('.partial-'))
        os.rename(partial,final)
        print('Backup complete:',final)
    except Exception:
        shutil.rmtree(partial,ignore_errors=True)
        raise
    finally:
        if session: session.close()

if __name__=='__main__':
    os.umask(0o077)
    try: main()
    except Exception:
        # Never echo tool stderr, connection strings, or secret-bearing args.
        print('Backup FAILED. No complete backup was published. Check client versions, permissions, expected schema version, writer quiescence, and Storage availability.'); raise SystemExit(1)
