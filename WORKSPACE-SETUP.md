# App-only follow-up workspace

The working application is `frontend` (React/Vite) and `backend` (Express/MongoDB). It does not require Google Apps Script, a spreadsheet URL, or a Sheets bearer-token bridge. The old Sheets project is not deleted and its cron must only be disabled after cutover.

## Setup and deployment

1. Install dependencies in `backend` and `frontend` using `npm ci`.
2. Configure `backend/.env` using `.env.example`. Keep existing database and JWT values. Set commerce email/password and a new, private `CRON_SECRET` of at least 24 characters. Credentials stay on the server.
3. Back up the database. From `backend`, run `node scripts/migrate-workspace.js` to preview the account index migration, then `node scripts/migrate-workspace.js --apply`. This permits multiple accounts without email. It preserves account passwords and roles. Existing administrators keep email login; new employees use a unique username.
4. Build the frontend with `npm run build` in `frontend`. Run `npm start` in `backend` on an always-on Node host. The backend serves `frontend/dist`. Use HTTPS in production.
5. Sign in with an existing administrator account. Open **Team** to create employees, set profiles, leave and onboarding. Open **Automation** to set grace/retry periods and whether check-in is required (enabled by default).
6. Run **Sync now**, inspect its outcome, then review **Workload** for assignments and any unassigned work. Calls and imported notes remain in MongoDB.

## cron-job.org

- URL: `https://YOUR_APP_HOST/api/v1/workspace/cron`
- Method: **POST**
- Schedule: **Every minute**
- Header name: `Authorization`
- Header value: `Bearer YOUR_CRON_SECRET`
- No credentials in the URL. No Apps Script deployment is involved.

The endpoint returns **202 Accepted** promptly. This means the request was accepted, not that commerce sync has finished. The **Automation** screen records completion, counts and errors. A persistent MongoDB lease prevents overlapping syncs across backend processes; another request during a run does not start a second sync. If the process stops, the lease expires and a later cron can retry. Use a persistent Node process, not a serverless handler that terminates after responding.

The backend's existing minute scheduler handles assignment and overdue work even between commerce syncs. Automatic retries preserve individual call attempts and task history. A task starts an active-call protection period of 20 minutes. Missed callbacks retain their scheduled time until the configured grace expires; handoffs record a reason.

## Sheets history (optional, preview first)

Export a JSON snapshot with `members`, `orders`, and `returns` arrays from the former workspace. The original member and record `id` fields must be present.

From `backend`:

```text
node scripts/import-sheets.js C:\path\workspace-export.json
node scripts/import-sheets.js C:\path\workspace-export.json --apply
```

The first command validates and prints counts without connecting to the database. The second imports records once using their original IDs. Existing records are not overwritten on a repeated import. Original follow-up fields, review text, notes and attempt totals stay in task metadata; aggregate legacy attempt counts are not converted into invented call records. Imported accounts are disabled and receive random passwords; an owner must set a password and activate each account before use. Match account mappings and archived history before disabling the previous cron.

No production database migration, historical import, deployment, or cron change is performed by the development scripts unless explicitly run against that environment.

## Verification

- Backend: `npm test` (includes an isolated in-memory MongoDB integration suite; never uses the configured production database for those integration tests).
- Frontend: `npm run lint` and `npm run build`.
- Optional disposable preview: build the frontend first, then from `backend` run `node scripts/preview-workspace.js` and open `http://127.0.0.1:3011`. Set `PREVIEW_PORT` to use another port. Preview credentials are `preview` / `Preview-only-2026`; all preview records are synthetic and disappear when the preview database stops. Never use that account or preview script in production.

## Operational limits

- Phone calls open the device dialer. Employees explicitly enter the outcome and duration; this is not telephony recording or automatic pickup detection.
- A vendor batch shares one owner. An unanswered call or requested callback can update all related open orders; stock outcomes remain per order. Calls started together share a call-session ID so employee reports count the conversation once.
- Employee level is an explainable heuristic based on profile, workdays and completed work, with a manual override. No-answer outcomes do not reduce the level.
- My Tasks loads up to 2,000 open/recent records; History shows the latest 500 closed task records. Historical Sheets notes are retained in metadata, not reconstructed into verified call analytics.
- Sync reads all paginated marketplace orders and returns and refreshes a bounded contact-detail batch. Source status and local follow-up state are separate; these operations do not update portal order status.

## Order flow and confirmation order

In **Settings → Pre Processing → Who should we confirm with first?**, choose **Customer first** (default) or **Vendor first — confirm stock availability**, then save. The setting updates the existing Pre Processing queues while preserving already completed confirmations.

| Orders section | Task flow |
| --- | --- |
| Pre Processing | Customer then vendor, or vendor then customer, according to Settings. Rescheduled work follows the outstanding confirmation. |
| Processing | Both confirmations complete → awaiting pickup/dispatch. Portal Processing → logistics follow-up. Shipped → delivery follow-up. Payment pending never sends these orders back to confirmation. |
| After Delivery | Delivered → customer review → closed history. No answer stays in follow-up. |
| Return & Recovery | Returns follow the existing customer-first/vendor-first return response setting. Customer confirmation leads to vendor response; rejection or vendor decision closes the response workflow. Hold orders use escalation/follow-up. Return Delivered closes active return work. |

Tasks display their Orders section and current step. Missing numbers load from the portal detail endpoint when a task opens; **Retry portal contact** retries a failed lookup. Logistics/hold follow-up lets the employee choose customer or vendor and records that choice in the attempt history. A resolved follow-up does not invent a delivery update in the portal.
