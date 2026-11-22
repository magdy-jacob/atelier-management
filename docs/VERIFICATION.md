# Verification record

Checked on 22 November 2026. This record applies to the source archive's local verification checkpoint, not to a hosted production service.

## Passed

- `npm run lint`: no ESLint errors or warnings.
- `npm run typecheck`: TypeScript passes.
- `npm test`: 22 domain/image/timezone/operations/aggregate/prototype tests pass.
- `npm run test:db`: 66 checks pass against a temporary real local PostgreSQL instance. Auth and Storage schemas are local substitutes, not live Supabase services.
- `npm run build`: optimized Next.js build passes.
- `npm run test:e2e`: 12 browser scenarios pass in Chrome, covering desktop/mobile, filters, dress details, no public price, demo role presentation, overlap rejection, first available date, accepted local simulation, calendar, disabled login before configuration and a closed unconfigured workspace.
- Dependency audit: no known vulnerabilities reported at verification time, after overriding the CLI's vulnerable transitive minimatch version. The lockfile records the tested graph. An audit is not a guarantee of application security.

## Database checks include

- Anonymous users can select public catalogue fields, not customers.
- Employees cannot read administrative dress prices or activity logs.
- Employees cannot promote themselves or insert dresses.
- Inactive staff cannot create bookings; deactivation removes booking visibility.
- Live booking creation is blocked before policy configuration.
- Booking, new customer and deposit are committed in one transaction.
- A retried request does not duplicate a booking/deposit.
- A rental ending December 6 rejects starts on December 6 and 7; December 8 is accepted.
- A conflict rolls back the customer created in the failed transaction.
- An employee not assigned to a booking cannot read its customer/payments or record a payment.
- Direct payment insert/delete is denied to application tokens.
- Overpayment and an overlong method note are rejected. Blank or custom method notes are permitted, as confirmed by the owner.
- Exact remaining payment reaches the agreed total using integer piasters.
- Even admin application tokens cannot directly delete the activity log.

## Visual inspection

Actual browser screenshots were inspected, not just generated:

- `evidence/catalogue-desktop.png`: catalogue hierarchy, type, filters and dress cards.
- `evidence/catalogue-mobile.png`: stacked hero, two-column cards and responsive filter controls.
- `evidence/dashboard-desktop.png`: sidebar, role selector, summary cards, operations and bookings.
- `evidence/dashboard-mobile.png`: responsive cards without the desktop table's clipped columns.
- `evidence/booking-conflict.png`: form labels and visible conflict/next-date feedback.
- `evidence/calendar-desktop.png`: month alignment, occupied rental days and separate preparation days.

Desktop was tested at 1440x1000; mobile at 390x844. Full-page captures can be taller than the viewport. Automated checks found no document-level horizontal overflow at the tested mobile width.

## Not verified / not implemented

- No live Supabase project, real hosted Auth flow or Storage operation was used.
- No cloud deployment, public preview URL, domain or production environment was created.
- No real users, clients, inventory, bookings or payments were entered.
- Production booking/payment forms are wired but hosted integration remains unverified here. Employee account administration, handover, return inspection, cancellation, refund, real alerts, financial reports and operational export still need implementation.
- Inventory edit/upload code has passed compile/local checks and its preview has been inspected, but no live Supabase Auth/Storage operation has been verified yet.
- No production concurrency/load/security audit, backup restore drill or delivery monitoring has been completed.
- Required business/legal decisions remain open, as listed in `DECISIONS.md`.

The local tests validate the foundation within these bounds. They are not production acceptance or permission to operate the atelier using this build.

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
