import { verifyBackup } from './verify-backup.mjs';
// Restore ONLY to a new replacement project, after all repository migrations.
// Never overwrites existing Storage objects. All hashes checked before upload.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export async function restoreStorage(dir,bucket) {
  const index=JSON.parse(await fs.readFile(path.join(dir,'storage-index.json'),'utf8'));
  const verified=[];
  for(const obj of index) {
    if(!/^objects\/\d{6}\.blob$/.test(obj.file) || !obj.path || obj.path.split('/').some(p=>!p||p==='.'||p==='..') || /[\\\x00-\x1f]/.test(obj.path)) throw Error('invalid_path');
    const body=await fs.readFile(path.join(dir,obj.file));
    if(crypto.createHash('sha256').update(body).digest('hex')!==obj.sha256 || body.length!==obj.bytes) throw Error('file_hash_mismatch');
    verified.push([obj,body]);
  }
  for(const [obj,body] of verified) {
    const upload=await bucket.upload(obj.path,body,{upsert:false,contentType:obj.content_type || 'image/webp'});
    if(upload.error) throw Error('upload_failed_stop_no_overwrite');
    const download=await bucket.download(obj.path);
    if(download.error || !download.data || crypto.createHash('sha256').update(Buffer.from(await download.data.arrayBuffer())).digest('hex')!==obj.sha256) throw Error('readback_failed');
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const [dir,ack]=process.argv.slice(2);
    const manifest=await verifyBackup(dir);
    if(ack!=='--new-empty-project' || !process.env.SUPABASE_URL || process.env.SUPABASE_URL===manifest.project_url) throw Error('invalid_target');
    const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    await restoreStorage(dir,service.storage.from('dress-images'));
    console.log('Storage upload and SHA256 readback verified.');
  } catch {
    console.error('Storage restore FAILED. Stop; inspect new target privately. No overwrite attempted.');process.exitCode=1;
  }
}
