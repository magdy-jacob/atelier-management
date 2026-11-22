# v0.23.0 review

- Catalogue: no staff login links, WhatsApp contact and code-specific enquiries, DR/001 style codes.
- Workspace: whole-pound display without redundant decimal zeroes, Cairo dates, labelled before/after audit cards, no technical audit UUID rows, latest10 bookings/dress changes.
- Admin: price ranges in the existing admin-only price table, retained-audit employee removal, ordinary staff names/emails without invitations, reports route removed.
- Employee: unavailable price/date/cancellation panels hidden, inventory fields visibly read-only. Existing permissions are unchanged.
- Login: password visibility toggle.
- Local setup: clarified separate .env.local configuration and existing-project safety.

Migration22 is additive. On the existing test project it was applied once with guarded release-only data edits to the six original dress codes/names, two unchanged demo category names and six synthetic price ranges. No seed/reset was run. Third category, images and all20 unaffected public tables retained identical content hashes. No real staff account was created or disabled for acceptance.

Historical backup remains Nov22 17:33:45 Cairo/schema20. It does not include later user edits or release23 ranges. Recovery route: restore/verify20, then21 and22. No new live backup was captured.

Checks:56 unit,260 database checks, typecheck, lint, optimized build, browser regressions and isolated backup/recovery. All29 Chrome regressions pass in the functional build. Hosted role acceptance evidence is reported separately after deployment. Production domain was changed by the owner to https://atelier-lovely.vercel.app/; the prior domain no longer resolves.
