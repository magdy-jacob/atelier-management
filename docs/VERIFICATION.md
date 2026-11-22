# Verification record, 0.20.1

Checked locally on 22 November 2026. This source checkpoint is not a claim that hosted acceptance or the complete MVP has finished. Historical sections below record earlier versions and are superseded by this current section.

## Current passed checks

- ESLint and TypeScript: pass.
- 48 unit tests: pass.
- 248 checks against an actual temporary local PostgreSQL instance: pass. Auth/Storage schemas are local substitutes, not vendor services.
- Optimized Next.js builds with functional portfolio flag off and on: pass.
- 24 Chrome browser scenarios in each optimized functional/default-flag build: pass.
- npm audit with production dependencies: zero reported vulnerabilities at this checkpoint. An audit is not a security guarantee.

## Functional synthetic mode coverage

- Mode-off baseline remains closed. Application flags must agree with database configuration.
- Invalid real-looking new customer names/phone values reject; matching test identifiers pass server and native browser validation.
- Private registry tables cannot be edited by application roles. Unregistered records reject operational/financial changes in synthetic mode.
- Ordinary same-day booking and pre-window handover still reject. A returned dress cannot be marked ready before its full preparation day.
- Admin-only current-day scenario setup rejects an inactive assignee or invalid case, preserves original review-booking fingerprints, and exact retry returns one booking. Changed replay payload rejects.
- Assigned employee can complete deposit handover, remaining receipt and balance-gated return. Since20, unrelated active staff can view every booking and record its initial deposit/return balance, but cannot perform handover/return/readiness. A fully paid return case accepts multi-select maintenance. An overdue case appears in actual SQL notifications and accepts an optional admin fee, exact balance receipt and return.
- These scenarios fabricate their labelled setup history explicitly. They do not weaken the normal booking RPC's advance rule or reset original review records.
- An uncertain image-metadata response can recover a committed link. Unverified attachment retains the object rather than deleting a possibly linked image. This port-helper behavior is covered by unit tests; live transport-failure injection is not claimed.

## Pixels inspected

Actual rendered screenshots of the new scenario form on desktop/mobile and the synthetic booking form on mobile were inspected for RTL readability, labels, notice separation, spacing, logo/banner placement and overflow. Native TEST- contact validation was exercised in Chrome. The scenario preview remains clearly non-saving and its submit button disabled; the real protected page uses the same form with configuration-based enablement.

Evidence: `evidence/portfolio-scenarios-desktop.png`, `portfolio-scenarios-mobile.png`, `portfolio-booking-mobile.png`. Existing catalogue/inventory/workflow/notification/report screenshots were refreshed by the suite. Tested viewport widths: 1440 and 390. No document-level mobile overflow in the automated scenarios.

## Remaining verification and implementation

Hosted authenticated creation/payment/handover/return/scenario feedback, actual employee sessions, vendor RLS/Storage and current deployment configuration are a separate acceptance step. No live setting or audience was changed by this local work. Do not present disabled preview clicks as hosted acceptance.

Employee account management and booking editing/availability are implemented and locally tested. Parent reports hosted Auth acceptance for18; newer hosted acceptance and historical financial exceptions, backup/restore and full integrated acceptance remain separate. No actual payout or refund exists. The previous review dataset and original image objects must stay intact. See `DECISIONS.md` for settled and open policy boundaries.

## Historical local checkpoints

## Inventory update 0.2.0

Added local PostgreSQL checks for version increments, stale-edit rejection, employee update denial and archive history preservation. Added image-processing tests for dimensions, EXIF removal, empty/oversized files, HTML and disguised SVG. Added responsive preview screenshots `inventory-desktop.png` and `inventory-mobile.png`; both were visually inspected. The preview disables mutation and is not a live upload test.

## Read-only/security update 0.3.0

Added real protected read screens for admin activity, team profiles, customer list/history, and scoped booking details/payment ledger. Customer list/aggregate history is admin-only; employees get only the customer contact needed in a permitted booking. No broader employee access or operational timezone is assumed. Audit and payment timestamps are explicitly UTC. No refund, handover, cancellation, timing or role-management mutation was added.

Added concurrent transactions to the PostgreSQL tests: exactly one overlapping booking wins, and concurrent payments cannot jointly overpay. Added local Storage metadata policy checks for admin access and employee rejection. This tests SQL policies on local substitutes, not hosted Storage delivery.

Read-only UI previews use synthetic data at `/demo/records`, with screenshots of audit details and the mobile payment ledger. Authenticated live pages still require integration verification. The production auth guard now lives in a server-only module, not an exported Server Action.

## Booking/payment forms update 0.4.0

Owner-confirmed day precision, at least one calendar day advance and Egypt day boundaries are represented in migration 3. Live booking enablement stays off. Added production form wiring to atomic RPCs, manual-receipt confirmation and stable request IDs. Retries with changed payloads are rejected; exact payment retries do not duplicate entries. Next-available-day SQL includes the complete preparation day. A date-only value is compared as SQL text in the local tests, not shifted through a timezone-bearing JavaScript Date.

The Cairo boundary helper has winter/summer tests, with expected boundaries independently checked using Python zoneinfo. Current totals are 12 unit/image/timezone tests, 35 PostgreSQL checks and 8 browser scenarios. New form screenshots are inspected previews, not proof of a hosted login or a live payment journal. No funds were collected, no live booking enabled, and no real customer record entered.

## Optional method / operations update 0.5.0

Migration 4 implements optional receipt-method notes and suggested methods, not a required whitelist. The real local PostgreSQL suite passes 36 checks; this includes null/blank notes and a custom method. The 18 unit tests include Saturday-first month alignment, leap years, preparation across months, alert timing and avoiding a false overdue-return claim when no handover was recorded. Seven Chrome scenarios pass, including month navigation, the optional input and protected operations route.

The operations dashboard/calendar is wired to authenticated, RLS-scoped reads. Its admin alerts are derived, not persisted/read-marked notifications. A separate financial admin dashboard remains in scope. Row caps are disclosed rather than silently presenting truncated totals as complete.

Inventory action-state ownership remains stable across a version refresh; form DOM resets to the new values/version. The optimistic SQL match was not loosened. Hosted confirmation of the persistent success feedback is still needed. Earlier hosted integration observations, performed separately, do not prove these latest local changes.

## Admin summary update 0.6.0

Migration 5 provides an admin-only aggregate RPC. No row limit is used to approximate financial totals. The UI separates period receipt totals/added fee totals from all-date current outstanding amounts and operational status counts. It does not claim net revenue or profit. Amount aggregates cross the JSON boundary as integer-piaster strings and are formatted with BigInt, including a test above JavaScript's safe-number limit.

The local PostgreSQL suite passes 40 checks, including employee denial, anonymous function-execute denial, actual aggregate reconciliation, invalid period denial and a Cairo-versus-UTC midnight boundary check. Twenty-one unit tests, eight Chrome scenarios, lint, typecheck and production build pass. Both dashboard previews including the actual shared period-filter layout are visually inspected on desktop/mobile. This does not replace live project acceptance for migration 5 or dashboard/period role checks. Saved notification read-state, handover/return, refunds and account management are still incomplete.

## Prototype guard update 0.7.0

A sticky non-operational test notice appears on every route. Prototype mode is fail-closed unless explicitly set false. It blocks booking/payment server actions and their enabled state, and sets noindex/nofollow metadata. Neither a banner nor noindex is access control; the deployment owner must verify protection on every deployment URL before exposure. The database booking gate must stay false and no real customer or financial data should be entered. Build and runtime environment settings must match.

Twenty-two unit tests and the eight-scenario browser run pass with prototype mode enabled, along with lint, typecheck and production build. Schema is unchanged from v0.6.0. This is prototype readiness work, not a hosting-terms conclusion or complete-MVP acceptance.

## Saved notifications and review assets 0.8.0

Six generated dress images were inspected and exported to metadata-free WebP sample assets. Catalogue screenshots now wait for lazy images to load before capture. These are invented products, not real inventory or licensed photographs of an existing designer's work.

The explicit guarded demo seed was tested on local PostgreSQL for exact actor IDs/roles, non-demo conflict rejection, repeat safety, scoped employee fixtures and aggregate reconciliation. It is not an automatic migration. Live seeding and Storage delivery require separate verification by the deployment operator; do not remove persistent review data during disposable-fixture cleanup.

Migration 6 adds per-admin notification read records, RLS, audit and role-checked RPCs. Marking read is retry-safe, does not remove an active cause, and rejects a wrong/expired event. Filtered pages are served from the protected RPC and disclose the 1000-item cap. The local suite passes 45 PostgreSQL checks, 22 unit tests and nine Chrome scenarios. Lint, typecheck, production build and npm audit pass. Actual desktop/mobile notification previews and updated catalogue pixels were inspected. These are local results, not the hosted notification acceptance.

## Optional admin overdue fee 0.9.0

The local suite passes 54 PostgreSQL checks, 22 unit tests and 10 Chrome scenarios, plus lint, typecheck and production build. The fee RPC rejects employees, anonymous execute, disabled booking configuration, null request IDs, zero amounts, non-overdue or returned bookings and changed retry payloads. Direct fee insert is denied even to admin application tokens. Exact and concurrent identical retries return the same fee. Adding a fee changes outstanding amounts without creating a receipt. Old demo fee records receive request IDs, with seed totals unchanged before disposable tests mutate their own temporary database.

The fee form is shown only on overdue notifications. It asks for amount, reason and an explicit confirmation, distinguishes a receivable from a receipt, preserves its request ID across unsuccessful attempts and catches uncertain network results. Prototype mode independently blocks its server action. Browser scenarios check a filled, confirmed but disabled prototype preview and absence on today's-return alerts. Actual desktop/mobile fee-form pixels were inspected. This does not establish a live authenticated action/UI acceptance; deployment must apply migration 7 and test separately without erasing persistent review fixtures. No real fee, payment or customer transaction was created by these local tests.

## Category management 0.10.0

The current local checkpoint passes lint, typecheck, production build, 22 unit tests, 63 PostgreSQL checks and 11 Chrome scenarios. Category checks cover admin rename/version increment, denied stale update, employee RPC denial, anonymous execute denial, duplicate/blank name rejection, direct app-token update/delete denial, used-category deletion rejection even after archiving its dresses, successful unused deletion and three audit records across create/rename/delete. Two simultaneous updates with the same version yield one success and one stale rejection.

Desktop/mobile category previews were inspected at actual pixels: create, rename, used-category explanation, deletion confirmation and disabled preview controls are readable without horizontal overflow. An unconfigured unauthenticated protected category route redirects to login. Authenticated hosted UI and live RPC acceptance remain the deployment operator's work. No live category, dress, booking or financial row was changed by these local tests.

## Critical current-out collision warning 0.11.0

The current checkpoint passes 66 local PostgreSQL checks and 12 Chrome scenarios. The added fixture has an overdue/out rental followed by a permitted planned booking tomorrow for the same dress. The critical notice links that booking; repeated read marking keeps the active warning visible. Employee access and a wrong event date are denied. Reading the warning leaves every booking field unchanged. Manually cancelling the disposable next fixture or moving it beyond tomorrow removes the current cause; those changes are test-owner actions, never automatic effects of the feature.

Desktop/mobile critical warning pixels were inspected: red outline, important heading, affected booking link/date, explicit notification-only explanation and disabled preview mark control. The schema now accepts four alert kinds and the fixed preview includes four cards. This remains limited to current `out` records. Post-return effects require the forthcoming actual-return workflow/date; this checkpoint is not full return/collision acceptance.

## Lovely identity and handover/return 0.12.0

Current local checkpoint: 24 unit tests, 88 PostgreSQL checks and 14 Chrome scenarios, plus lint, typecheck, production build and npm audit. Operational tests verify deposit-only handover, no-deposit/missing-guarantee/readiness denial, exact retries, status-only guarantee records, balance-gated return, valid/invalid multi-select inspection, RLS/direct-mutation denial, and a concurrent fee/return race with only one permitted winner. No real financial or customer transaction is involved.

An important collision is kept visible after a late recorded return during its preparation impact, survives read marking and expires after the relevant window. An older return does not overwrite outside status while a later booking is still out. A new booking starting the next day is rejected by actual-return preparation; the +2 date is suggested and accepted. Existing-booking handover is not automatically held by a collision. Readiness cannot be confirmed before the full preparation day. The local test owner shifts only disposable record dates to simulate the later-day boundary; application actors cannot edit those append-only records.

Inspected pixels cover Lovely catalogue desktop/mobile, actual supplied logo in header/footer/favicon, staff/demo navigation and dashboard, handover/return forms, categories and post-return critical warning. A visual check found the larger fixed-sidebar logo underneath the sticky test banner. Sidebar offset now follows actual banner height, and a browser assertion checks the logo is below it. Mobile navigation also shows the supplied identity. Key palette contrast calculations: primary #a61d55 on white 7.17:1, muted #76616b on #fff9fb 5.47:1, and dark text #25171e on #fce5ee 14.41:1. These checks are not a claim of a complete accessibility audit.

Browser workflow scenarios use explicitly synthetic disabled previews. Hosted authenticated action/save feedback, actual Supabase API role checks and protected deployment acceptance remain required separately. Review fixtures must be preserved in transactional acceptance. Ten migrations in total; apply only migration 10 atop the preceding nine.

## Receipt journal and CSV 0.13.0

Current suite: 28 unit tests, 95 database checks, 15 browser scenarios. Report checks compare receipt count/sum with the current administrative summary, verify Cairo midnight splits, deny employee/unassigned/inactive/anon, reject invalid ranges, return empty rather than invented data, and create 5001 disposable local receipts within a rolled-back owner-only fixture to prove complete refusal rather than truncation. No real customer or money operation occurs.

CSV tests cover formula cells including whitespace/BOM variants, commas/quotes/newlines, UTF-8 BOM/CRLF, exact amounts beyond JavaScript safe integer arithmetic, literal leading-zero phone/code values, and schema/count/sum mismatch refusal. Browser scenario downloads and inspects the synthetic CSV, checks report explanation and desktop/mobile layout, and checks protected report/export routes redirect to login without configuration. Hosted authenticated report/download acceptance remains separate. Migration 11 is read-only apart from creating its index/function; it does not alter receipt rows or enable operation.

## Image ordering 0.14.0

28 unit tests, 106 PostgreSQL checks and 16 browser scenarios pass, plus lint/typecheck/production build and npm audit. New database coverage denies employee/other/inactive/anon and direct metadata updates, rejects duplicate/missing/foreign/null lists and stale changed orders, verifies saved canonical order/main image and one parent version increment, and proves exact retry adds neither audit rows nor version increments. Two competing different reorders from the same version produce exactly one winner; concurrent metadata inserts append at distinct positions and each update the version once. Existing repeat-safe demo seed test still passes.

Browser inventory scenario reorders three same-garment synthetic thumbnails locally, verifies the unsaved indicator/main image and disabled preview save, checks the persisted-data navigation target, and checks desktop/mobile overflow. Actual pixels of desktop/mobile inventory and fixed-sidebar dashboard were inspected after the navigation copy change. These are previews; authenticated hosted save/feedback and catalogue-order acceptance remain separate. Migration 12 changes no existing metadata/order/fixture values and does not enable the financial or booking gate.

## Image deletion 0.15.0

31 unit tests, 118 PostgreSQL checks and 16 browser scenarios pass, plus lint/typecheck/build and zero npm-audit vulnerabilities. Local Storage table stubs validate queue/DB completion rules, not an actual hosted Storage deletion. Tests cover role/direct-write denial, missing confirmation, stale version and wrong image, concurrent exact request returning one job and one version change, metadata absence with durable pending state, refusal while the object row remains, retired-path reattachment denial, changed retry payload, completion after absence and no-op completion/queue retries with no new audit rows.

The cleanup port tests cover uncertain delete transport followed by verified absence, existing-object/auth/read errors and completion failures retaining pending, and idempotent already-missing objects. Browser deletion scenario checks explicit independent confirmation, disabled synthetic preview delete/retry, cache/cleanup explanation and desktop/mobile overflow. Actual pixels were inspected after resetting viewport scroll, avoiding a full-page screenshot artifact that places the sticky test banner mid-document.

Hosted acceptance must use a newly uploaded disposable object only. SQL rollback cannot restore an object deleted through Storage. Never remove one of the six persistent review image objects as a rollback test. Verify temporary object existence, queue removal, absence confirmation, completed state, retries, UI feedback and pending recovery; separately verify original dataset/fingerprints/object paths remain intact. No source migration creates a real pending job or deletes any current file.

## Settings-boundary correction 0.16.1

Independent review found that migration1 had retained app-admin settings INSERT/UPDATE grants and an all-command RLS policy. This could bypass the synthetic guard. Activation was held. Migration15 revokes all settings grants from public/anon/authenticated, grants authenticated SELECT only and replaces the admin all-command policy with SELECT-only RLS. Local configuration fixtures now use the actual test database owner. Regressions deny admin attempts to disable synthetic scope, alter the live gate/day policy, upsert or delete settings; deny employee writes; verify flags stay enabled; and independently challenge RLS with a temporary local UPDATE grant before restoring the final revoked state. The UI is unchanged, so the inspected v0.16 portfolio screenshots remain applicable. Do not activate the uncorrected v0.16.0 bundle.

## Cancellation and receipt timing 0.17.1

34 unit tests,163 database checks,19 Chrome scenarios, lint/typecheck and optimized functional build pass. The database suite explicitly tests the142-check migration15 baseline first, then upgrades it to16 and tests the changed receipt ACL/timing and cancellation behavior. A separate fresh database applies all16 migrations, tests final admin settings denial, the new handover/return-receipt/return flow and cancellation. This is upgrade-path plus fresh-install coverage, not a claim the old unrestricted receipt API still exists for application users.

New checks deny the old general receipt RPC; require return-presence confirmation and an out booking for balance receipts; permit the first deposit on a zero-receipt booking and deny top-ups; preserve exact retries and scoped employee access; store the Cairo return-confirmation day; and ensure concurrent receipts cannot overpay. Cancellation checks cover admin-only/confirmation/actor denial, exact retry and changed reason, retained payment fingerprints and deposit snapshot, release of dates, outside/handed-over rejection, historical extra-payment refusal without refund, direct-record write denial and cancellation-versus-handover race with exactly one winner.

Actual desktop/mobile pixels of cancellation and the physical-return receipt form were inspected. Preview scenarios exercise role limits, disabled preview submit, the required physical-return confirmation and a cancelled ledger that keeps the original agreed value and receipt but shows no remaining rent due. Hosted feedback, actual employee sessions and real vendor behavior remain a separate acceptance step. No hosted gate, dataset or object mutation was made in this source task.

## Input retention correction 0.17.1

The booking form cancels native form reset events. Successful booking navigates away; rejected actions no longer clear uncontrolled staff fields merely because the Server Action returned an error object. A browser test requests the same native reset and verifies selected dress, test identity/contact, dates, method and confirmation stay intact. Actual hosted rejected-action feedback remains independently verifiable; the local test does not pretend to be a hosted Supabase rejection.

## Employee management 0.18.0

48 unit tests,191 local PostgreSQL checks and20 Chrome scenarios pass, plus lint/typecheck and optimized builds. The DB suite applies migrations1–15 for legacy engine checks, then16 for final receipt/cancellation checks, then17 for staff checks. A separate fresh installation applies all17 and denies the ordinary admin access to the service-only finisher. Vendor-owned Auth/Storage schemas are stubs, not a real GoTrue service.

New checks cover fixed server-chosen Auth targets; exact job retry/payload binding; synthetic identities; admin-only jobs/profile writes; service-only completion; missing Auth parents and active-actor checks; immutable employee role/admin protection; stale edits; rename/deactivation/history; reactivation without replacement; inactive RLS denial; closed synthetic gate. Injected-port tests cover unknown reads, lost create replies, strict ID/email/private-metadata binding, no adoption or cleanup, completed-account absence, read-only recovery, unchanged existing password and uncertain profile completion. Password length checks use UTF-8 bytes, not only JavaScript character length.

The browser test checks real HTML email validation, protected admin row, disabled non-saving preview controls, retained form values after native reset, desktop/mobile layout and no overflow. Actual pixels in `evidence/team-desktop.png` and `evidence/team-mobile.png` were inspected. No actual account/password/key was created or used during these local tests. Secret environment references are server-only. The source does not send invitation or confirmation email.

Hosted acceptance still needs a disposable synthetic Auth creation, actual sign-in, correct employee scope, admin-only operations, name change, deactivation blocking an existing employee session, reactivation, retry/recovery feedback and original review-data preservation. Verify email_confirm/private app_metadata/fixed-ID behavior against the real project. Do not delete a live Auth account on an uncertain response. No password reset or role promotion is shipped, and full MVP completion is not claimed.

## Booking edits and maintenance 0.19.0

48 unit tests and227 local PostgreSQL checks pass, including upgrade checkpoints18/19 and an all19 fresh install. New tests cover admin-only pre-handover changes, exact retry/changed replay, reason/confirmation, immutable receipts/customer/dress/assignment, price>=receipts, stale edits and actual/planned preparation. Competing different edits have one version winner; date-move versus handover and repricing versus initial receipt serialize with one valid winner and no money/history loss. Cancellation/out states reject. Unchanged values create no fake history.

Availability tests accept a future nonoverlapping reservation for a currently-out dress, reject its preparation day, and preserve existing future bookings when maintenance is recorded. Maintenance prevents new bookings/date moves/suggestions/handover. Employees cannot route through preparation to clear it; admin clearance still respects actual-return preparation. A two-booking collision fixture proves maintenance remains true through an outside state and a later sound return. Local fixtures deliberately backdate/construct synthetic historical cases for clock-bound branches; these are not a method for hosted acceptance or claims of real events.

22 Chrome scenarios pass on the functional build, including edit role/state limits, history, retained native/controlled inputs, explicit Arabic date summary and maintenance admin/employee messaging. The first screenshot check found a sticky-banner capture artifact after input auto-scroll; screenshots were retaken from scroll-top and inspected again. Evidence: booking-edit-desktop/mobile and maintenance-admin/employee-mobile. Hosted acceptance and real Auth/Storage are separate, and no live rows/accounts were changed by this source work. Public catalogue availability remains a manually chosen label, not a date-specific promise.

## Shared booking scope and admin dress history 0.20.0

48 unit,248 PostgreSQL and24 Chrome scenarios per optimized build flag pass. The database suite tests pre20 legacy ownership separately, then20 upgrade and all20 fresh install. Unassigned active staff read bookings/customer contact/payments/fee amounts/handover/return/receipt confirmations, and collect initial deposits or physical-return balances with original timing, actor, exact retry and overpayment rules. Inactive/anon deny. Handover/return/readiness, date/price, cancellation/fee and admin audit/advisory-price boundaries remain independently denied. Direct receipt inserts still deny both application roles.

Admin dress history renders cancelled/returned bookings and directly associated audit before/after values. Employee preview contains neither booking history nor audit JSON. Shared-booking UI explains limited operations and closes their controls. Actual dress-history desktop/mobile and shared-booking mobile PNG pixels were inspected for RTL, long JSON wrapping, labels, hierarchy and overflow. Latest Chrome suite refreshed those screenshots. Hosted PostgREST JSON-path filter, all-booking employee receipt collection and no-mutation permission controls still need independent acceptance. No live rows/accounts/keys changed in this source task.

Backup correction is not included in20: the separate pinned19 package is under review and fails closed against live schema differences. It must be canonically matched with20 and independently retested, not silently accepted or run destructively. This release does not claim full MVP completion.

## Backup integration patch0.20.1

Integrated the independently reviewed20 correction, preserving its exact source migration checksums and fail-closed schema fixture. The provided19/20 archives remain unchanged. Added test:backup and ignores for backups/Python temporary files. Independent clean-folder and integrated-command runs pass with PGBIN pointing to privately extracted PostgreSQL18.7 clients: actual single-snapshot capture and archive restore into two separate targets,24-table hashes,39app functions/26policies/38triggers,4Auth identities including pending/completed staff jobs, nondefault profile versions, email-confirmation mismatch rejection, explicit all-FK sweep and negative missing-parent case, independent Storage inventory including unlinked paths.txt, upload/readback/overwrite rejection, corrupt-file and unknown-schema rejection. A third-DB named Studio-profile archive roundtrip passes with its extra reviewed function/event. Changed application policy still rejects under that profile. Canonicalization tests retain literal contents and token boundaries; PG18 NOT NULL catalog normalization still checks column attnotnull.

Provider template was independently read from https://raw.githubusercontent.com/supabase/supabase/master/apps/studio/components/interfaces/Database/Triggers/EventTriggersList/EventTriggers.constants.ts and matched the included restricted event-trigger body. These scripts add no live grants/settings or resources by being included. The user must use the separately verified new target only for recovery. No dump, password, secret URL or real backup artifact is shipped in the source archive.

Patch checks:48unit,lint,typecheck and production build pass again. Full248DB/24Chrome-per-flag application evidence is from the unchanged20 app/migrations immediately before this scripts/docs-only patch; the backup test itself was rerun after integration. Hosted signature/capture and actual Supabase Auth/Storage recovery remain separate, not claimed by the local adapters. Full MVP remains open until coordinated acceptance closes its remaining work.
