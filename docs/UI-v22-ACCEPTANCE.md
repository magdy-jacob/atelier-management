# UI22 source and hosted acceptance

Version0.22.0. No database migration22. Requires the already-applied21 schema. Do not run a seed, reset, restore, synthetic scenario generator or configuration change to accept this UI.

## Source changes

- Actual persisted staff pages now share the dark Lovely sidebar, compact white topbar, rose cards and mobile drawer.
- The real overview and inventory use persisted dress images, exact counts, search/category filters and real links. Latest100 inventory cap and manual availability meaning remain visible. The full booking list has image rows, status, dates and remaining balance from recorded price, fees and receipts.
- All actual forms, server actions, active-account checks and role boundaries remain. Admin-only links stay off the employee menu. Sign out remains a real server action. No role switcher is added.
- Global project/test banner and public preview promotion are removed as requested. Noindex, prototype/configuration gates and synthetic-data restrictions are not removed. Dataset names and codes remain unchanged. Direct preview routes remain explicitly non-saving. The protected scenario generator is no longer promoted in the sidebar, but its route and guards remain.
- A booking-edit hydration safeguard prevents input before browser handlers attach. This avoids losing an extremely early edit; it does not alter edit authority or persisted behavior.

## Proven locally

ESLint/TypeScript,52 unit tests,253 PostgreSQL checks, optimized functional-flag on/off builds,27 Chrome scenarios in each mode, full20/21 local backup/restore checks and zero reported production audit vulnerabilities. Shared component desktop/mobile/drawer pixels inspected. No hosted result is inferred from these checks.

## Apply without changing data or audience

Use this full source instead of overlaying an old partial patch. Keep current protected hosting, environment flags and secrets unchanged. No SQL is needed. Original review rows and image objects must remain. Before and after any separately authorized hosted test, reconcile the agreed fingerprints and counts; a read-only UI check should not change app data.

## Read-only hosted acceptance first

1. Wait for the exact new deployment to be Ready and confirm it is serving22 source, not a cached21.1 route.
2. In the original admin session, inspect /workspace at desktop and390px mobile. Check real images load, counts reconcile, latest rows link to the correct persisted records, search/filter affects shown inventory, and navigation/mobile drawer/close/focus/scroll work.
3. Visit /workspace?view=dresses and the archive. Verify the correct current/archive dataset, details links, main image order, displayed cap and add-dress/category forms. Do not submit just to prove appearance.
4. Visit /workspace/bookings and a known booking. Verify customer, dress, dates, status and remaining balance against the existing ledger, including a cancelled/returned row if already present. No fabricated pending balance.
5. In the original employee session, confirm the same shared design with no admin finance, reports, customer management, team, audit or notification links. All bookings and their permitted receipts remain visible; price/date/cancel and admin history stay denied. UI hiding does not replace server/RLS checks.
6. Combine the outstanding21 employee queue check: today's outgoing/incoming/follow-up rows remain visible even if the calendar shows another month. No admin collision detail is disclosed.
7. Confirm public catalogue/login have no global project/test banner or promoted system-preview link, retain illustrative-image disclosure, and do not expose prices, customers, self-booking or online payment. Original dataset TEST/name prefixes are not presentation banners and must not be edited away.
8. Check the new nested PostgREST reads and .or attention filter explicitly. An Unavailable state is a failed read, not an empty successful inventory. Validate head/count responses, Storage URLs and role-specific relationships.

## Any write regression is separate

The earlier authorization and coordinated test window still govern writes. Do not assume this guide authorizes a booking, receipt, account change or data cleanup. If authorized, use only disposable registered fixtures, preserve original fingerprints and reconcile real success feedback, retained retry state and unchanged role limits.

## Recovery source truth

The current source is22 while the database schema remains21. The earlier actual snapshot remains schema20 at its original capture time. Restore that old snapshot into a new isolated schema1–20 project, verify20, then apply21 once. Do not label it a fresh22/21 backup. The source includes strict20 and21 fixtures. A real second-project cloud Auth/Storage recovery remains unverified and separately authorized.
