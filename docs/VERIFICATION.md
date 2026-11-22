# Verification record

Checked on 22 November 2026. This record applies to the source archive's first milestone, not to a hosted production service.

## Passed

- `npm run lint`: no ESLint errors or warnings.
- `npm run typecheck`: TypeScript passes.
- `npm test`: 11 domain/image tests pass.
- `npm run test:db`: 29 checks pass against a temporary real local PostgreSQL instance. Auth and Storage schemas are local substitutes, not live Supabase services.
- `npm run build`: optimized Next.js build passes.
- `npm run test:e2e`: 5 browser scenarios pass in Chrome, covering desktop/mobile, filters, dress details, no public price, demo role presentation, overlap rejection, first available date, accepted local simulation, calendar, disabled login before configuration and a closed unconfigured workspace.
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
- An unapproved payment method and overpayment are rejected.
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
- Production booking/payment forms, employee account administration, handover, return inspection, cancellation, refund, true alerts, true financial reports and operational export remain to be implemented or connected.
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
