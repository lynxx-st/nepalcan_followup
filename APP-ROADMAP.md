# Follow-up application delivery checklist

The application in this repository replaces the Sheets workspace. Google Sheets is a migration source only; it must not remain a runtime dependency. Existing commerce integrations and order history remain in use.

## Delivery
- [x] Inspect current task, employee, call, sync, and permission flows.
- [x] Implement employee profiles, optional email/username login, leave, onboarding and levels.
- [x] Implement one owner per vendor coordination group and fair capacity-based assignment.
- [x] Implement recorded call outcomes, callbacks, retries, active-work protection and overdue handoff.
- [x] Enforce employee ownership and manager/admin access on the new workspace.
- [x] Build mobile-first My Tasks with desktop queue/detail view and actionable history.
- [x] Build employee creation/editing and manager workload/performance screens.
- [x] Add protected cron automation, persistent overlap protection and visible sync health.
- [x] Preserve archive/review history and separate waiting from successful completion.
- [x] Provide a preview-first import for historical Sheets data, without a runtime Sheets dependency.
- [x] Verify assignment, calls, authorization, concurrency, mobile layout and production build.
- [x] Document deployment, cron setup and cutover; retain old Sheets until migrated and verified.

## Acceptance rules
- Vendor coordination groups stay with one eligible employee; customer tasks are independent.
- Sunday–Friday are workdays. Saturday and recorded leave do not advance onboarding.
- New joiners ramp 20/40/60/80/100% over five workdays. Day one has no calling tasks.
- No answer is an attempt, not a completion or evidence of poor performance.
- Untouched overdue work may transfer after a configurable grace period; callbacks keep their promised time and active work is protected.
- Every handoff has a recorded reason. Manual changes transfer the entire vendor group.
- Call outcome and task transition save together. Repeated requests must not duplicate attempts.
- Portal status and internal follow-up state are separate. Sync preserves local history.
- Employee permission roles and Intern/Casual/Executive profiles are separate.
- Mobile actions remain visible, drafts survive errors, and the dialer never marks a call answered.

## Rollout
Implementation and local verification do not imply a production deployment. Configure the database, commerce credentials and CRON_SECRET on the host; migrate and verify historical data before disabling the previous Sheets cron. Never commit credentials or personal exports.

## Verification recorded 21 September 2026
- [x] 43 backend tests pass, including disposable MongoDB integration tests and task-specific outcome validation.
- [x] TypeScript check passes. Production build and service worker generation pass.
- [x] Browser checked at 390px mobile and 1440px desktop; mobile employee form has no horizontal overflow.
- [x] Browser verified a saved no-answer attempt appears in Callbacks.
- [x] Read-only commerce connection verified: 805 orders and 7 returns reported by the live endpoints.
- [x] Deployment and cron instructions recorded in WORKSPACE-SETUP.md.

## Production cutover (not performed by local implementation)
- [ ] Back up the production database and run the account-index migration.
- [ ] Optionally export and import existing Sheets history; verify member mappings.
- [ ] Deploy the app build and configure CRON_SECRET on the host.
- [ ] Set cron-job.org to the protected app endpoint and verify a completed sync.
- [ ] Disable the old Sheets cron after verifying the application data.

## Order lifecycle corrections — 21 September 2026
- [x] Pre Processing uses Settings → Confirmation order: Customer first or Vendor first.
- [x] Both confirmations lead to awaiting dispatch; portal Processing and Shipped override outdated local confirmation flags.
- [x] Existing obsolete tasks retire with their attempts preserved; the current stage gets the appropriate task.
- [x] After Delivery leads to customer review; collected reviews and Return Delivered stay outside active follow-up.
- [x] Return & Recovery respects the return customer/vendor response sequence and retains hold follow-up separately.
- [x] Missing contact details fetch when a task opens, with a retry action; list sync preserves fetched numbers.
- [x] Running API verified: the reported example is Processing/logistics follow-up, both contact numbers are present, and no advanced orders request customer confirmation.

## Compact workspace verification - 22 September 2026
- [x] Customer and vendor names/numbers remain visible together; contact selection uses explicit buttons where the workflow allows either person.
- [x] The task body scrolls independently with its call/save action bar always reachable.
- [x] Tested desktop and 390px mobile, including scrolling to the end and saving a synthetic no-answer outcome.
- [x] Order details open the matching stage; Orders stage links preserve segment selection in the URL.
- [x] Orders list uses portal status, recorded confirmations, contact numbers and the current task/callback deadline.
- [x] Local and remote Git histories merged; prior work preserved in backup/followup-before-ui-20260922.

## API freshness and return source correction - 22 September 2026
- [x] Operational API responses bypass conditional caching and send private no-store headers.
- [x] Orders return tabs read OrderReturn records; counts use the same active-record and employee visibility rules.
- [x] Orders refresh every 30 seconds and on focus, with manual refresh, last refresh time and visible failures.
- [x] Request sequencing prevents a slow response overwriting a newer tab; background refresh keeps existing rows visible.
- [x] Live verification: 824 portal orders were present in the database. A fresh portal sync completed successfully. Return list and counts both returned 8 with HTTP 200/no-store.
- [x] 41 backend tests, TypeScript check and production build passed.

## Logistics handoff and order contents - 22 September 2026
- [x] Portal Processing and Shipped stop routine calling/order-check tasks; existing tasks are archived with history preserved.
- [x] Awaiting dispatch, delivered reviews and active returns retain their own appropriate workflows.
- [x] Product names, variants, quantities, unit/line prices and order totals appear directly in the compact task panel.
- [x] Portal details fill missing line items as well as contact numbers.
- [x] Running database verified: zero active routine tasks for orders already in logistics.
- [x] 43 backend tests passed, including logistics exclusion and complete line-item payload checks.
