import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export async function verifyBackup(dir) {
  const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  if(manifest.format!==3 || !manifest.files?.['database.dump'] || !manifest.files?.['identities.json'] || !manifest.files?.['storage-index.json']) throw Error('invalid_manifest');
  for(const [name,hash] of Object.entries(manifest.files)) {
    if(!/^(database\.dump|identities\.json|storage-index\.json|objects\/\d{6}\.blob)$/.test(name)) throw Error('unsafe_manifest_path');
    const filename=path.join(dir,name);
    if(!(await fs.lstat(filename)).isFile()) throw Error('not_regular_file');
    if(crypto.createHash('sha256').update(await fs.readFile(filename)).digest('hex')!==hash) throw Error('backup_hash_mismatch');
  }
  return manifest;
}
