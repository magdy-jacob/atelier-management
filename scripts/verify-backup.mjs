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
  // Historical20archives predate the explicit field. Infer ONLY from their
  // complete pinned migration-checksum map, never from today's source label.
  const recorded=manifest.snapshot?.source_migrations;
  if(!recorded || typeof recorded!=='object') throw Error('missing_schema_provenance');
  const versions=Object.keys(recorded).map(name=>Number(/^20261122(\d{4})_/.exec(name)?.[1]));
  const schemaVersion=manifest.schema_version ?? Math.max(...versions);
  if(![20,21].includes(schemaVersion) || versions.length!==schemaVersion || new Set(versions).size!==schemaVersion || versions.some(v=>!Number.isInteger(v)||v<1||v>schemaVersion)) throw Error('unknown_schema_version');
  const fixture=JSON.parse(await fs.readFile(new URL('./backup-schema-v'+schemaVersion+'.json',import.meta.url),'utf8'));
  for(const [name,hash] of Object.entries(fixture.source_migrations)) if(recorded[name]!==hash) throw Error('migration_checksum_mismatch');
  return {...manifest,schema_version:schemaVersion};
}
