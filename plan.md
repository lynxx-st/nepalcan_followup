# Redesign Plan — Today's Work & Next Call + App-wide Deep Links

## Status

- [x] **Phase 1 — Backend shared queue** (`task.service.js` `getNextAdvanced` returns
  `{ tasks, total }` enriched with `order` + `stage`; controller cap 50 → 200; `completeTask`
  respects `data.outcome` so chains now fire).
- [x] **Phase 2 — Next Call workstation**
  - `services/api.ts`: `callLogApi.create`.
  - `utils/lifecycle.ts` (new): stage/task meta + `orderStagePath` deep-link helper.
  - `utils/taskActions.ts` (new): `completeTaskWithOutcome` (completes w/ outcome + writes
    CallLog), `skipTaskWithNote`, `rescheduleTaskTo`, order/customer/phone helpers.
  - `components/OutcomeButtons.tsx`: monochrome redesign, carries outcome codes.
  - `components/TaskOutcomeSheet.tsx` (new): bottom-sheet outcome grid + reschedule + skip.
  - `pages/NextCall.tsx`: real queue (list + swipe deck), stage chips + `?stage=`,
    `?task=` deep link, `returnTo` context, score/factors display, swipe gestures
    (right=complete sheet, left=skip, up=reschedule).
- [ ] **Phase 3 — Today's Work redesign**
- [ ] **Phase 4 — App-wide deep links**

## Problems found

1. **/next is truncated by the backend** — `getNextAdvanced()` returns a single task
   (`task.service.js` did `scored.slice(0, limit)[0]`), so the "queue" is always 1 item
   no matter the `?limit=` passed.
2. **Completion bypasses the business chain** — NextCall completes tasks with a generic
   note, so chained tasks (`customer-confirmed → vendor-call`, `vendor-rejected → escalation`,
   `vendor-delayed → vendor-delay`) never fire; no CallLog is ever written.
3. **Today's Work data source is wrong** — uses `dashboard/orders` (order-level, excludes
   `Processing`, odd `$nor` filter) instead of the task queue; Today and Next disagree.
4. **Link gaps** — `/tasks/:id` is reachable only from NextCall; NextCall list rows have no
   order link; OrderDetail reads no query params (no `returnTo`, no `tab`, no `task`); cancelled
   orders never link to `/recovery`; Returns cards never link to their order stage page; no
   `returnTo` context preservation anywhere.

## Confirmed decisions

- **Shared task queue** — both Today's Work and Next Call render from one enriched queue
  (`getNextAdvanced` list) instead of two divergent data sources.
- **Outcome-first completion** — completing a call opens the OutcomeButtons sheet for the task
  type; selection completes with the right outcome (fires chained tasks) and writes a CallLog.
- **Full app-wide deep-link pass** — task↔order, order↔stage, today↔next, cancelled↔recovery,
  returns↔order, plus `returnTo` context preservation.

## Phase 1 — Backend: shared enriched queue

**`backend/modules/tasks/service/task.service.js`**
- Add `TASK_STAGE` constant: task type → lifecycle bucket
  (`preOrder | processing | afterDelivery | return`).
- Rewrite `getNextAdvanced()`:
  - envelope per candidate: `{ task, order, score, factors, stage }` (`order` joined from
    `ordersById`, `stage` from `TASK_STAGE`);
  - return `{ tasks: scored.slice(0, limit), total: scored.length }` instead of the top-1.

**`backend/modules/tasks/controller/task.controller.js`**
- Raise `limit` cap 50 → 200 so the queue can power Today's Work.

## Phase 2 — Next Call: call workstation (`frontend/pages/NextCall.tsx`)

- Source = full `taskApi.getTasks(50)` queue; render real list + swipe stack; fix unused
  `swipeIndex`, stop slicing to 3.
- New shared component **`TaskOutcomeSheet`** (reuses `components/OutcomeButtons.tsx`):
  selection → `taskApi.complete(id, { notes: outcome })` + `POST /api/v1/call-logs`
  (new `logApi` in `services/api.ts`).
- Swipe right → outcome sheet; left → `taskApi.skip`; up → reschedule wiring
  (`taskApi.schedule`, currently a "coming soon" toast).
- Deep links per card: Task # → `/tasks/:id?returnTo=/next`, Order # →
  `/orders/:id?returnTo=/next`, stage chip → `/orders/:id/:stage`.
- Query params: `?stage=` filter, `?task=<id>` jump. Back → `/today`.
- Mobile sticky bottom bar: `tel:` + Complete.

## Phase 3 — Today's Work redesign (`frontend/pages/TodayWork.tsx`)

- `dashboardApi.getToday()` (attendance, SLA, revenue at risk) + Phase 1 queue (drop
  `dashboard/orders`).
- Compact header + attendance; scrollable KPI chips; lifecycle **accordion groups**
  (Pre Order / Processing / After Delivery / Return) with counts + "View queue →"
  `/next?stage=X`.
- Each card: Order # → `/orders/:id?returnTo=/today`, Task # → `/tasks/:id`, customer + `tel:`,
  amount, branch origin→destination, SLA countdown, priority; primary **Handle** opens
  `TaskOutcomeSheet` inline.
- `?tab=` deep link + sticky "Start Next Call" bar on mobile.

## Phase 4 — App-wide deep links

- **`utils/useReturnTo.ts`** — Back buttons honor `&returnTo=…` in OrderDetail, the 8 stage
  pages, TaskDetail, return response pages.
- **`OrderDetail`** — Active Task link via `order.activeTaskId` → `/tasks/:id?returnTo=…`;
  Recovery campaign link on `cancelled`; Back returns to origin context.
- **`TaskDetail`** — honor `?returnTo=`; add return-stage links.
- **`Orders`** — add Task links per active task.
- **`Returns` ↔ order** — cards link to `/orders/:id/customer-response|vendor-response`;
  response pages back → `/returns?returnId=`; Returns honors `?returnId=` (jump + expand).
- **`OrderCancelled`** — "View Recovery" → `/recovery?orderId=…`.

## Files touched

- Backend: `modules/tasks/service/task.service.js`, `modules/tasks/controller/task.controller.js`
- Frontend: `services/api.ts`, `utils/lifecycle.ts` (new), `utils/useReturnTo.ts` (new),
  `components/TaskOutcomeSheet.tsx` (new), `pages/NextCall.tsx`, `pages/TodayWork.tsx`,
  `pages/OrderDetail.tsx`, `pages/TaskDetail.tsx`, stage & return pages, `pages/Returns.tsx`,
  `pages/Recovery.tsx`.

## Verify

- `cd frontend && npm run build`
- Start backend + frontend; walk: Today → card → outcome sheet → confirmed chain task appears;
  Next swipe-complete writes a CallLog; Back returns to exact origin.
- Follow `frontend/DESIGN.md` (24/18 radii, `#0a0a0a`/`#737373`/`#e5e5e5`, 44px targets,
  mobile bottom sticky bars).