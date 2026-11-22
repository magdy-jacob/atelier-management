import { verifyBackup } from './verify-backup.mjs';
// Supported Auth API recovery for a NEW disposable/replacement project only.
// Not a live-project reset. Never writes auth.* SQL or exports password hashes.
// npm dependencies are the repository's existing @supabase/supabase-js.
// node scripts/restore-auth.mjs BACKUP_DIR PASSWORD_DIR --new-empty-project
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are NEW-project server-only env.
// PASSWORD_DIR/<uuid>.txt contains a freshly chosen password for each identity.
// Use secure password/vault tooling to provide those files, never chat or git.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
export async function restoreIdentities(identities, admin, passwordFor) {
  for (const identity of identities) {
    const read=await admin.getUserById(identity.id);
    let user=read.data?.user;
    if (read.error && read.error.status!==404 && read.error.code!=='user_not_found') throw Error('auth_read_failed');
    if (!user) {
      const password=await passwordFor(identity.id);
      if (password.length<12 || Buffer.byteLength(password)>72) throw Error('password_length');
      const created=await admin.createUser({id:identity.id,email:identity.email,password,email_confirm:identity.email_confirmed,app_metadata:identity.app_metadata});
      if (created.error || !created.data?.user) throw Error('auth_create_failed');
      user=created.data.user;
    }
    assert.equal(Boolean(user.email_confirmed_at),identity.email_confirmed);
    assert.equal(user.id,identity.id);
    assert.equal(user.email?.toLowerCase(),identity.email.toLowerCase());
    for (const key of ['lovely_staff_job','lovely_staff_actor']) assert.equal(user.app_metadata?.[key],identity.app_metadata[key]);
    // Read back actual provider state; response to create alone is insufficient.
    const verify=await admin.getUserById(identity.id);
    if (verify.error || !verify.data?.user) throw Error('auth_verify_failed');
    assert.equal(Boolean(verify.data.user.email_confirmed_at),identity.email_confirmed);
    assert.equal(verify.data.user.id,identity.id);
    assert.equal(verify.data.user.email?.toLowerCase(),identity.email.toLowerCase());
    for (const key of ['lovely_staff_job','lovely_staff_actor']) assert.equal(verify.data.user.app_metadata?.[key],identity.app_metadata[key]);
  }
}
if (process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const [dir,passwordDir,ack]=process.argv.slice(2);
    if (ack!=='--new-empty-project') throw Error('new_project_required');
    const manifest=await verifyBackup(dir);
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL===manifest.project_url) throw Error('source_target_forbidden');
    const identities=JSON.parse(await fs.readFile(path.join(dir,'identities.json'),'utf8'));
    const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    await restoreIdentities(identities,service.auth.admin,async id => {
      if (!/^[0-9a-f-]{36}$/.test(id)) throw Error('invalid_uuid');
      return (await fs.readFile(path.join(passwordDir,id+'.txt'),'utf8')).trimEnd();
    });
    console.log('Auth identities and application bindings verified. Passwords were not printed.');
  } catch {
    console.error('Auth recovery FAILED. Stop before database restore. No credentials printed. Check target and identity bindings privately.');
    process.exitCode=1;
  }
}
