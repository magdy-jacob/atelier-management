# Manual backup and isolated restore, source v0.21.0

النسخة هنا يدوية على الخطة المجانية، وليست نسخًا سحابية تلقائية. ثبت محليًا أخذ نسخة واستعادتها إلى PostgreSQL معزول. لا توجد مطالبة بأن استعادة مشروع Supabase ثانٍ بالكامل جُرّبت سحابيًا. لا تُنفّذ الاستعادة على المشروع الأصلي.

## Scope and facts

- Free does not provide automatic database backups. Supabase recommends regular CLI dumps and off-site copies: https://supabase.com/kb/faqs/platform/free-plan-backups and https://supabase.com/docs/guides/platform/backups
- Database backups do not contain Storage object bytes. This package copies them separately, including unlinked objects in `dress-images`.
- The vendor warning about omitted passwords in its downloadable backups concerns custom PostgreSQL roles. It is not a blanket claim that Supabase never backs up Auth passwords. THIS package deliberately excludes Auth password hashes, tokens, sessions, MFA secrets and unrelated Auth users. Existing passwords will therefore not survive THIS recovery; provide new passwords securely.
- Free project pausing currently has a one-year dashboard resume window. The official guide describes a warning email before pausing and confirmation after pausing, not two advance warnings: https://supabase.com/docs/guides/platform/free-project-pausing
- Supported Auth recovery preserves UUIDs using `auth.admin.createUser({id, email, password, email_confirm, app_metadata})`. Supabase explicitly documents custom UUIDs: https://supabase.com/kb/guides/migrate-from-auth0 . This is also how this project's `src/app/staff-actions.ts` creates job-bound staff accounts. No direct SQL writes to provider-owned `auth` tables are recommended.

## Coverage

1. One custom-format `database.dump` of ALL `public` schema objects/data from ONE exported repeatable-read snapshot. This includes 24 tables at source v21, versions, account jobs, staff-change/booking-change history, receipts, audit JSON and unchanged identity UUIDs.
2. Independent `storage.objects` inventory of EVERY object in `dress-images`, not just paths linked by `dress_images`. Each object is copied to a numbered local blob, avoiding filesystem-name collisions. `storage-index.json` maps original object paths to blob names/hashes/byte lengths/content type. Objects are downloaded again and checked for unchanged bytes.
3. Only required Auth identifiers/emails/confirmation state and the two application binding fields (`lovely_staff_job`, `lovely_staff_actor`). Includes every existing account referenced by profiles or employee jobs, including an Auth-created but still-pending job. Missing completed-job identities, wrong emails/bindings, active bans or enrolled MFA cause capture to fail rather than imply incomplete recovery is safe.
4. A pinned source-v21 schema signature plus migration checksums. The real project has NO Supabase CLI migration-history relation: migrations1-20 were applied as ordered direct SQL. The manifest records CLI history as `null` when absent. Source checksums are source provenance, NOT a fabricated claim of recorded applied migrations. The signature compares columns/defaults, constraints, function definitions, public RLS/policies/triggers/app-role grants and project-owned dress-image policies. Unknown signatures fail closed for review.
5. A final manifest with exact snapshot row counts/content hashes and SHA256 for the archive, identity/index files and image blobs. The complete directory is published by one atomic rename only after success. Partial output is removed on error. No secret connection string is printed or saved.

Not included: old passwords, sessions, OAuth/MFA recovery, unrelated accounts, custom database role passwords, provider-wide settings, Vercel credentials/environment settings or a deployment/audience change. The six original generated images also remain in private Git source, but Git is not the changing database backup.

## Requirements

- Python 3 standard library; Node.js 22 and existing project dependencies for recovery helpers.
- PostgreSQL clients `psql`, `pg_dump`, `pg_restore`, with client major at least server major. Set `PGBIN=/path/to/postgresql/bin` when the clients are not already on PATH; the test AND Python capture prepend it for all subprocesses. The isolated test uses PG18.7 clients against the embedded PG18 server. `pg_dump` has COPY output by default; `--use-copy` is a Supabase CLI option, not a `pg_dump` option.
- A trusted, private machine and off-site destination controlled by the owner. `backups/` MUST be ignored by Git. Keep backup directories private even though project data is synthetic.

## Capture

Stop ALL application/admin/Storage writers for this short manual window. Database snapshots cannot make Storage copies atomic. Do not use the `--quiescent` acknowledgement while anyone is uploading, deleting or changing records. The script also compares final live metadata/table hashes to the original snapshot and fails if it detects change, but that is a check, not a replacement for stopping writers. It does NOT toggle live project settings automatically.

Provide `SUPABASE_DB_URL` and `SUPABASE_PROJECT_URL` securely in the process environment. Use the verified dashboard connection string, with TLS as provided, not a guessed host. For an agent-run capture, credentials must come through approved vault execution, never conversation text. Then:

```bash
bash scripts/backup-atelier.sh --quiescent --provider-profile supabase-studio-v1
```

The named provider profile is for the reviewed Supabase Studio setup. Omit it for a plain local schema. It adds ONLY the exact independently sourced Studio `rls_auto_enable` function, its `ensure_rls` enabled/O event registration owned by postgres with the three exact tags, and non-grantable `MAINTAIN/REFERENCES/TRIGGER/TRUNCATE` privileges for service_role on the24 known tables. There is no anon/authenticated grant exception. Official Studio source was independently fetched and pinned in `provider-studio-rls.sql`: https://raw.githubusercontent.com/supabase/supabase/master/apps/studio/components/interfaces/Database/Triggers/EventTriggersList/EventTriggers.constants.ts . The observed live project is PG17.12; PG18-only NOT NULL constraint catalog rows are normalized away while every column's `attnotnull` remains checked. Function whitespace is tokenized outside quoted literals, identifiers and comments. Changed literals, token boundaries, bodies, owners, policies or grants still reject. Unknown provider functions are not ignored.

The default capture expects schema21. `--schema-version 20` is available ONLY for a genuine20source and still must match its separate exact20fixture; it never relabels a21database. Historical20archives without an explicit version field are identified from their complete pinned20migration-checksum provenance. Unknown versions or mismatched checksums reject.

Optional `--output PRIVATE_DIRECTORY` changes the destination. Successful output is a new `backups/<UTC-seconds>-<random-suffix>/` directory. A failed capture prints a generic error, exits nonzero and publishes no completed backup. No tokens or password hashes belong in the output. Copy the entire completed directory off the machine before resuming normal work.

RPO is the last successful manual capture. Suggested manual cadence: after an accepted release and after significant test-data changes. There is no scheduler, GitHub secret, paid service or keep-alive in this package. Free inactivity pause remains acceptable.

## Restore, NEW isolated project only

These are recovery instructions, not authority to reset the existing project or create another resource. Do not reuse the original project URL. A cloud restore still requires its own separately approved disposable target and hosted acceptance. No destructive restore was run on the original project.

1. Verify backup file hashes before any mutation:

```bash
node --input-type=module -e 'import {verifyBackup} from "./scripts/verify-backup.mjs"; const m=await verifyBackup(process.argv[1]); console.log("Hashes verified; restore schema version",m.schema_version);' PRIVATE_BACKUP_DIR
```

2. Create/configure a NEW empty target project on the free plan only when authorized. Disable public signup, keep audience restricted and preserve the prototype constraints. Read the snapshot version returned by step1. For the already delivered historical20backup, apply ONLY migrations1-20 before data restore. For a new21backup, apply1-21 before data restore. Use filename order and the pinned checksums, not the current app version label. This is the supported schema route. It recreates project-owned Storage policies/bucket settings and the `btree_gist` extension; a `public`-only schema dump by itself does NOT recreate all vendor-schema policies. Never combine migration application with a second schema restore. If the backup manifest names the Studio provider profile, apply the reviewed `scripts/provider-studio-rls.sql` to this NEW target as owner as well, then verify the exact function/event registration and server-only service_role grants. Do not apply it to the original as part of recovery. The target's managed service_role may already have its standard defaults; reconcile to the named profile, never extend anon/authenticated grants.

3. Recover Auth via the supported server-side Admin API. Supply NEW-project `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` privately in the environment. The key never goes into source, output, browser, chat or `NEXT_PUBLIC_` variables. Supply fresh passwords through secure local/vault tooling as `PRIVATE_PASSWORD_DIR/<uuid>.txt`, one per identity in `identities.json`. Do not paste secrets into chat. Then:

```bash
node scripts/restore-auth.mjs PRIVATE_BACKUP_DIR PRIVATE_PASSWORD_DIR --new-empty-project
```

The helper creates identities with the ORIGINAL UUIDs and exact required job/actor binding metadata, then reads them back, including exact confirmation-state equality. A matching-but-unconfirmed existing identity cannot pass when the backup requires confirmation; the helper fails without resetting its password or silently confirming it. It never rewrites an existing mismatched account and never automatically adopts another identity with the same email. Any API error/conflict stops recovery before database loading. Use a clean isolated target; investigate partial recovery there instead of touching the original. Delete the temporary password files through the same secure tooling after use. Existing profile inactive status and versions come back from the database archive. No UUID remap is needed anywhere, so jobs/history/audit JSON and pending job targets remain unchanged.

4. Load the data into the migration-built target. Migrations insert a settings singleton and audit rows, so remove ONLY that new target's seed rows first. The commands below are destructive and are for the NEW target only. Supply its verified owner connection as `NEW_DB_URL` privately; never substitute the original URL.

```bash
psql --dbname "$NEW_DB_URL" -X --single-transaction --variable ON_ERROR_STOP=1 \
  --command "do \$\$ declare t text; begin for t in select tablename from pg_tables where schemaname='public' loop execute format('truncate table public.%I restart identity cascade',t); end loop; end \$\$"
PGOPTIONS='-c session_replication_role=replica' pg_restore \
  --dbname "$NEW_DB_URL" --data-only --schema=public --no-owner \
  --single-transaction --exit-on-error PRIVATE_BACKUP_DIR/database.dump
psql --dbname "$NEW_DB_URL" -X --variable ON_ERROR_STOP=1 \
  --file scripts/validate-restored.sql
```

The trigger suppression prevents COPY from rewriting restored versions/history. Therefore `validate-restored.sql` explicitly scans EVERY public-schema FK for dangling existing rows and verifies completed/present pending Auth-job bindings. It does not merely trust constraint metadata marked validated. A failed check means STOP; do not deploy the target. The isolated test deliberately deletes an Auth parent and verifies this check fails.

5. Upload Storage objects to the new target, after migrations created `dress-images`. Same NEW-project environment as step3:

```bash
node scripts/restore-storage.mjs PRIVATE_BACKUP_DIR --new-empty-project
```

The helper checks file hashes, uploads with `upsert:false`, then downloads and verifies SHA256. It refuses overwrite and stops on any failure. Provider-generated metadata/object IDs/timestamps will be new; application paths, bytes and content types are preserved. An interrupted partial upload is a new-target cleanup/retry decision, never permission to overwrite original Storage.

6. For a historical20snapshot, verify restored20data and integrity FIRST, then apply `202611220021_daily_dashboard_completion.sql` once. This upgrades only the read-only admin dashboard function and its grants, not any table data. Do not call the historical backup a21capture or reapply1-20. The local regression proves the exact20restore-then21upgrade order leaves all24table hashes unchanged and gives the new manual-label dashboard counts. A second live capture is not required solely to incorporate this function-only upgrade. Any later migration changing data/table shape needs its own reviewed route.

7. Compare all public table counts/hashes to `manifest.snapshot.tables`, verify every original image path/byte hash and check employee/admin login plus pending-account recovery. Restore the documented signup/Vercel environment/prototype/protection settings separately from README and `.env.example`; the source project/audience must not be changed. Do not claim cloud recovery until these hosted checks actually pass.

## Verification record and limits

The delivered `npm run test:backup` entry should run `node tests/backup-restore.mjs`.

The local test runs the REAL Python capture against disposable PostgreSQL18 with the complete21-migration schema and no CLI history table, exports a single snapshot/archive, then restores THAT archive into a second migration-built database. It uses local adapters for HTTPS Storage and the supported Auth API, not the real GoTrue/Storage services.

Passed locally:

- Default source-relative invocation without `MIGRATIONS_DIR` or `PGBIN`, with PG18 clients on PATH. No URL-vs-path error; clients close before clusters stop; clean exit.
- Capture of four existing Auth identities (admin, two employees and an Auth-created pending job), with UUIDs, completed/pending job metadata and nondefault profile version preserved. Wrong existing identity/email and either direction of confirmation-state mismatch are rejected without modifying the existing account.
- Two independently listed Storage objects but only one app-linked image. The unlinked object is literally named `paths.txt`, proving the old index-file collision cannot occur. Both bytes round-trip through the restore helper; overwrite retry rejects.
- Historical20capture -> migrations1-20 -> data restore/integrity ->21upgrade: every table hash unchanged; new dashboard label counts correct. An old20manifest without the newer version field is correctly inferred as20 from pinned checksum provenance.
- Exact content hashes on all24 public tables after restore, including staff account jobs, staff-change and booking-change history;39 functions,26 public policies,38 triggers.
- Explicit all-FK/account-binding integrity sweep passes; deliberately missing Auth parent fails.
- Failed HTTP copy publishes no complete manifest/directory. Schema mismatch, corrupt-file, source-change or query failure is fail-closed by implementation. The tests also exercise schema drift, corrupted file rejection and a changed app policy under the provider profile. Other guards remain code-reviewed unless separately listed.
- Existing live six original images were previously downloaded read-only and SHA256-compared to source assets; all six matched. That does not replace a current real backup capture.

The accepted20schema passed hosted preflight and a real manual20backup was captured and delivered privately on22November2026. Keep that historical20snapshot/version unchanged. This21source update adds the tested20restore-then21upgrade route; it does not claim a second live capture or live cloud restore. A second real Supabase project restore/GoTrue login/Storage acceptance has NOT been executed. Any future21capture still needs its own matching21preflight and coordinated writer-free window. No automatic cloud backup is claimed. Do not mark full hosted backup/recovery complete from local tests alone.

## Changes and review

Separate schema fixtures are pinned to source migrations1-20 and1-21 and must be regenerated in an isolated source-coordinated test/review for any later migration, with new checksums and restore regression. Never automatically accept a live unknown signature or weaken it to make capture pass. Do not publish backup artifacts or credentials to Git, the image bucket, conversation or a wider audience.
