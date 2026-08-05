# Follow-up Task Engine — Deepened Phased UX & Implementation Plan

## Overview
This document presents a comprehensive, page-by-page UX and architectural overhaul plan for the NepalCan Ops Follow-up Task Engine. It details the navigation backlink graph, button placement strategies, mobile responsiveness rules (<640px touch ergonomics), user shift attendance, 4-stage order workflow bundling (**Pre Order**, **Processing**, **After Delivery**, **Return**), and complete compliance with `frontend/DESIGN.md`.

---

## 🧭 Backlinks & Interconnected Navigation Graph

Every page features standardized breadcrumbs (`<Breadcrumbs />`), contextual back buttons, and cross-module deep links so users can navigate backwards and forwards without using browser back buttons:

```
[Navbar Header / Mobile Drawer]
  ├── Today's Work / Dashboard (/today)
  │     ├── User Info & Shift Attendance (Check In / Check Out)
  │     ├── KPI Analytics Cards (SLA Rate, At-Risk Revenue, Call Stats)
  │     └── Pending Items Dashboard (Pre Order, Processing, After Delivery, Return tabs)
  │           ├── Click Pending Item ──► Next Call Workstation (/next)
  │           └── Click Order # ───────► Order Detail View (/orders/:id)
  │
  ├── Next Call Workstation (/next)
  │     ├── ← Back to Today's Worklink
  │     └── Direct Order Detail Link (/orders/:id)
  │
  ├── Task Queues (/queues)
  │     ├── Filter by Queue Type & SLA
  │     ├── Click Task Number ──► Task Detail View (/tasks/:id)
  │     └── Click Order ID ─────► Order Detail View (/orders/:id)
  │
  ├── Orders Management (/orders)
  │     ├── 4 Stage Tabs (Pre Order | Processing | After Delivery | Return)
  │     └── Click Order Card/Row ──► Order Detail View (/orders/:id)
  │
  ├── Order Detail View (/orders/:id)
  │     ├── Breadcrumb Trail: Orders > [Stage Name] > #ORD-XXXX
  │     ├── ← Back to Orders Button
  │     ├── Editable Phone Number Modal
  │     ├── Linked Tasks & Add Note Widget
  │     └── Sticky Bottom Mobile Action Bar
  │
  ├── Reviews (/reviews)
  │     └── Create Review Call Task ──► Task Queues (/queues)
  │
  └── Recovery Campaigns (/recovery)
        └── Linked Commerce Order Tag ──► Order Detail View (/orders/:id)
```

---

## 📱 Mobile Responsiveness & Touch Ergonomics Rules

1. **Touch Target Size**: Minimum `44px x 44px` touch target size for all interactive buttons, tabs, inputs, and links.
2. **Sticky Mobile Action Bars**: Fixed bottom action bar on mobile viewports for high-frequency primary actions (e.g. "Complete Call", "Confirm Order", "Check In").
3. **Mobile Navigation Drawer**: Sliding bottom-sheet/side drawer replacing desktop top tabs on screens `<640px`.
4. **Card Stack Layouts**: Tables automatically transform into stacked card components on mobile viewports with expandable secondary details.
5. **Horizontal Scroll Chips**: Segment filters and stage selectors scroll horizontally on mobile with hidden scrollbars and touch snapping.

---

## 📋 Page-by-Page Detailed UX Brainstorm

### 1. Global Navigation Frame (`Navbar.tsx` & Mobile Drawer)
- **Top Bar**: `#fafafa` background, `#0a0a0a` text, global search bar (Order #, phone, customer name), simulated time control (`+1h`, `+8h`), sync status spinner, notification bell, shift status pill (`Checked In 3h 15m`).
- **Pill Navigation**: Micro-segmented pill buttons for primary routes with hairline borders.
- **Mobile Ergonomics**: Sticky top header with hamburger menu button, sliding mobile drawer, and bottom navigation bar (`Today`, `Next Call`, `Orders`, `Shift`).

### 2. Today's Work / Dashboard (`TodayWork.tsx`)
- **User & Attendance Module**:
  - Avatar initials, user name, role badge, assigned branch tag.
  - **Shift Attendance Button**: Live Check In / Check Out toggle button with live status badge (`Active Shift: 09:00 AM — Duration 4h 12m`).
- **Analytics KPI Row (Responsive Grid: 1 col mobile, 3 col desktop)**:
  - *Card 1: SLA Compliance & Completion Rate*: Metric percentage block of tasks finished within target SLA.
  - *Card 2: Pending Tasks & At-Risk Revenue*: Counter of active follow-ups alongside total order monetary value.
  - *Card 3: Call Performance*: Completed call count today & average call duration.
- **Pending Items Dashboard**:
  - Segmented tab filter (`All Pending`, `Pre Order`, `Processing`, `After Delivery`, `Return`).
  - Action cards with direct **Call Now** action button, **Reschedule** trigger, and **Skip** option.
  - Backlinks to Order Detail (`/orders/:commerceOrderId`) and Task Detail (`/tasks/:id`).

### 3. Next Call Workstation (`NextCall.tsx`)
- **Agent Focus Mode**: Designed for zero-friction sequential customer calling.
- **Top Bar**: Backlink button (`← Back to Today's Work`), Queue progress pill ("Call 3 of 12"), SLA countdown badge.
- **Split Layout (Stacked on Mobile)**:
  - *Left Panel*: Customer info, clickable phone link with copy feedback, order items with thumbnails, delivery address.
  - *Right Panel*: Outcome selection pills (`Customer Confirmed`, `No Answer`, `Wrong Number`, `Call Later`, `Rescheduled`, `Lost`), quick note textarea, keyboard shortcuts (`1-6`).
- **Bottom Bar**: Right-aligned filled primary button ("Complete & Next Call"), ghost secondary button ("Skip").

### 4. Task Queues (`TaskQueues.tsx`)
- **Queue Segment Tabs**: `Customer Confirmation`, `Vendor Call`, `Logistics Followup`, `Cancelled Recovery`, `Review Call`, `Escalations`.
- **Search & Filter Bar**: Filter by assignee, priority, status, and SLA status.
- **Task Cards**: Priority hairline indicators (destructive ember tag for overdue/critical), direct links to Order Detail & Task Detail.

### 5. Orders Page (`Orders.tsx`)
- **4 Stage Bundles (Top Tabs)**:
  1. **Pre Order**: Orders awaiting customer phone confirmation (`pending_confirmation`).
  2. **Processing**: Confirmed orders waiting for vendor assignment, packaging, or shipping (`confirmed_unprocessed`, `shipped`).
  3. **After Delivery**: Delivered orders awaiting post-delivery review calls (`delivered_followup`, `pending_review`).
  4. **Return**: Cancelled orders, recovery campaigns, return requests, and rescheduled calls (`rescheduled`, `cancelled-recovery`).
- **Responsive Order Table / Card Stack**:
  - Desktop: Clean table with hairline borders, items summary, customer phone link, active task badge, SLA timer, and quick actions.
  - Mobile: Touch-friendly cards with expandable item details and thumb-accessible primary action buttons.
  - Backlinks: Click anywhere on an order row/card to navigate to `/orders/:commerceOrderId`.

### 6. Order Detail Page (`OrderDetail.tsx`)
- **Top Bar**: Breadcrumbs (`Orders > Pre Order > #ORD-9821`), "← Back to Orders" button, Order Status Badge, Workflow Stage Indicator.
- **Two-Column Layout (Stacked on Mobile)**:
  - *Column 1*: Customer contact details (editable phone number modal), shipping address, items table with image thumbnails, payment summary.
  - *Column 2*: Active tasks card, SLA countdown timer, note entry input, full chronological audit trail timeline.
- **Sticky Bottom Action Bar on Mobile**: Fixed bottom bar with primary action button ("Confirm Order", "Assign Vendor", "Log Call").

### 7. Reviews Page (`Reviews.tsx`)
- **Rating Summary Cards**: Average rating meter, star-distribution bar charts.
- **Review Items**: Star rating, review comment text, linked order tag (`#ORD-XXXX`), "Create Review Call Task" button.

### 8. Task Detail Page (`TaskDetail.tsx`)
- **Header**: Breadcrumbs (`Task Queues > Task #TKN-847`), task type tag, status badge, SLA timer.
- **Content**: Linked order overview card with direct link, task timeline audit log, note submission form, assignee selector.

### 9. Recovery Campaigns (`Recovery.tsx`)
- **Header Stats**: Total cancelled revenue, recovered revenue amount, conversion rate percentage.
- **Campaign Cards**: Customer name/phone, cancellation reason badge, step-by-step resolution checklist with outcome toggles.

### 10. Rules Engine (`Rules.tsx`)
- **Rule Cards**: Active toggle switch, trigger event tag, delay hours setting, SLA duration setting, target task type selector.
- **Rule Evaluator Drawer**: Interactive testing sandbox for evaluating sample order JSON against rule conditions.

### 11. Analytics (`Stats.tsx`)
- **Metric Cards & Charts**: Task completion speed, SLA breach analysis, call outcome distribution, agent leaderboard.

### 12. System Settings (`Settings.tsx`) & User Administration (`Users.tsx`)
- **Settings**: System default SLAs, logistics thresholds.
- **Users**: Admin RBAC table, role assignment modal, user activation toggle.

### 13. Login Page (`Login.tsx`)
- Vercel-style centered paper card, 24px radius, 18px pill input fields, dark filled login button, mobile responsive padding.

---

## 🛠 Execution Phases Overview

```
Phase 1: Backend Attendance & Dashboard APIs
Phase 2: Design Tokens (frontend/DESIGN.md), Geist Font & Monochromatic Frame
Phase 3: Breadcrumbs Component, Navigation Backlink Graph & Mobile Drawer
Phase 4: Dashboard & Today's Work Overhaul (Shift Attendance, Analytics, Pending Dashboard)
Phase 5: Order Stage Bundling (Pre Order, Processing, After Delivery, Return) & OrderDetail Overhaul
Phase 6: Complete UX Reshape of All Sub-pages (NextCall, Queues, Reviews, TaskDetail, Recovery, Rules, Stats, Settings, Users, Login)
Phase 7: Mobile Responsiveness Audit, Build Check & Final Verification
```