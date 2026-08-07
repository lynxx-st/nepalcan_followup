# NepalCan Ops — Follow-up Task Engine & Order Operations

NepalCan Ops is a mobile-first SaaS follow-up task engine and order operations management platform built for NepalCan Commerce. It automates customer call workflows, vendor follow-ups, logistics tracking, review collection, return management, and cancelled order recovery campaigns.

---

## 🌟 Key Features & UX Innovations

- **Mobile-First SaaS UI**: Bottom navigation bar on mobile, SaaS-style header with search, sync, shift tracker, and notifications. Hamburger drawer for mobile navigation.
- **Monochromatic Clinical UI (`frontend/DESIGN.md`)**: Engineered developer-tool design system inspired by shadcn, Vercel, and Linear (`#f5f5f5` canvas, `#ffffff` paper cards, Geist/Inter typography, 24px container radius, 18px pill actions).
- **Navigation Backlinks & Interconnected Graph**:
  - Breadcrumb navigation component (`<Breadcrumbs />`) on all sub-pages.
  - 1-click cross-module deep links (Order → Task → Customer → Call Log → Recovery → Rule).
  - Contextual back buttons ensuring users never rely on browser back buttons.
- **Mobile First & Touch Ergonomics**:
  - Fully responsive layouts (<640px touch optimization).
  - Touch-friendly 44px minimum tap targets.
  - Mobile bottom navigation bar & sliding navigation drawer.
  - Sticky bottom action bars for single-thumb task completion on mobile.
  - Swipe gestures on Next Call (Tinder-like view).
- **Dashboard & User Attendance**:
  - Real-time **Check In / Check Out** shift tracker for staff & managers with active shift duration counter.
  - User profile & role overview card.
  - Analytics metrics (SLA compliance rate, active pending tasks, at-risk revenue).
  - Consolidated **Pending Items** dashboard view with direct action triggers.
- **Order Lifecycle Bundling**:
  - **Pre Order**: Order confirmation, pre-purchase calls, customer verification.
  - **Processing**: Vendor assignment, packaging delays, logistics pickup tracking.
  - **After Delivery**: Post-delivery feedback, review call collection, NPS ratings.
  - **Return**: Cancelled order recovery campaigns, return requests, rescheduled follow-ups.
- **Rule Engine**: Event-driven task generation triggered by commerce order events with configurable delay hours and SLAs. Rules are fully editable (create, edit, toggle, delete, duplicate).
- **Next Call Workstation**: Two views — sortable list view (by status, urgency, SLA, priority) and Tinder-like swipe view with checklist per task type. Advanced algorithm scores tasks by urgency, loss risk, return avoidance, and workload balance.
- **Stage-Specific Order Pages**: Dedicated pages for each workflow stage (confirmed-unprocessed, shipped, pending-review, customer-response, vendor-response) with logistics timeline, SLA display, and stage-specific action modules.
- **Returns Management**: Flexible follow-up (customer or vendor first), image zoom on attachments, full return history timeline, editable status at any step.
- **External Logistics Integration**: Comments API for non-heavy logistics orders, SLA breach detection with comment posting, delivery time tracking (created → delivered).
- **Delivery Zone SLA**: Configurable SLA by city tier (same-city, major city, third-tier) for shipped order delivery windows.
- **Multi-User Task Division**: Workload distribution across agents with Follow Up role, team-based assignment, per-agent performance tracking.
- **Analytics Dashboard**: Charts for SLA compliance, call outcomes, order stage distribution, agent leaderboard, revenue at risk, with CSV export.

---

## 🧭 Navigation Graph Architecture

```
[Mobile Bottom Nav Bar | Desktop Top Pill Nav]
  ├── Today's Work / Dashboard (/today)
  │     ├── User Info & Shift Attendance (Check In / Check Out)
  │     ├── KPI Analytics Cards (SLA Rate, At-Risk Revenue, Call Stats)
  │     └── Pending Items Dashboard (PRE PROCESSING, Processing, After Delivery, Return tabs)
  │           ├── Click Pending Item ──► Next Call Workstation (/next)
  │           └── Click Order # ───────► Order Detail View (/orders/:id)
  │
  ├── Next Call Workstation (/next)
  │     ├── List View (sortable by status, urgency, SLA, priority)
  │     ├── Tinder-like Swipe View (full card + checklist)
  │     ├── ← Back to Today's Work
  │     └── Direct Order Detail Link (/orders/:id)
  │
  ├── Orders Management (/orders)
  │     ├── 4 Stage Tabs (Pre Order | Processing | After Delivery | Return)
  │     └── Click Order Card/Row ──► Stage-Specific Page (/orders/:id/:stage)
  │
  ├── Order Stage Pages (/orders/:id/:stage)
  │     ├── /confirmed-unprocessed — Vendor call + status recording
  │     ├── /shipped — Logistics timeline + SLA + comment API
  │     ├── /pending-review — Review collection module
  │     ├── /customer-response — Return Step 1 (flexible follow-up)
  │     └── /vendor-response — Return Step 2 (flexible follow-up)
  │
  ├── Order Detail View (/orders/:id)
  │     ├── Breadcrumb Trail: Orders > [Stage Name] > #ORD-XXXX
  │     ├── ← Back to Orders Button
  │     ├── Editable Phone Number Modal
  │     ├── Linked Tasks & Add Note Widget
  │     └── Sticky Bottom Mobile Action Bar
  │
  ├── Returns (/returns)
  │     ├── Image zoom on attachment click (lightbox)
  │     ├── Flexible follow-up (customer OR vendor first)
  │     ├── Editable return status at any step
  │     └── Full return history timeline
  │
  ├── Reviews (/reviews)
  │     └── Create Review Call Task ──► Task Queues (/queues)
  │
  ├── Recovery Campaigns (/recovery)
  │     └── Linked Commerce Order Tag ──► Order Detail View (/orders/:id)
  │
  ├── Analytics (/stats)
  │     ├── SLA Compliance chart
  │     ├── Call Outcome distribution
  │     ├── Order Stage distribution
  │     ├── Agent leaderboard
  │     └── CSV Export
  │
  ├── Rules (/rules) — Fully editable (create, edit, toggle, delete, duplicate)
  ├── Settings (/settings) — Delivery zones, SLA config, logistics API
  └── Users (/users) — Multi-user Follow Up role management
```

---

## 🔌 API Endpoints Summary

### Authentication & Shift Attendance
- `POST /api/v1/auth/login` — Authenticate user and receive JWT token.
- `GET  /api/v1/attendance/status` — Get active shift status for current user.
- `POST /api/v1/attendance/check-in` — Start active working shift.
- `POST /api/v1/attendance/check-out` — End active working shift.

### Dashboard & Analytics
- `GET  /api/v1/dashboard/today` — Fetch today summary, analytics KPIs, and pending items.
- `GET  /api/v1/dashboard/stats` — Detailed performance statistics & recovery metrics.
- `GET  /api/v1/dashboard/orders` — Orders requiring active follow-up attention.

### Commerce Orders & Workflows
- `GET  /api/v1/commerce/orders` — List commerce orders (supports `segment`, `stage`, `search`, `page`, `limit`).
- `GET  /api/v1/commerce/orders/:id` — Get detailed order info, tasks, and call history.
- `PUT  /api/v1/commerce/orders/:id/status` — Update customer confirmation / vendor status.
- `POST /api/v1/commerce/sync` — Synchronize orders with NepalCan Commerce.
- `GET  /api/v1/commerce/orders/:id/logistics-comments` — Fetch comments on external logistics order.
- `POST /api/v1/commerce/orders/:id/logistics-comment` — Leave a comment on the external non-heavy logistics order.
- `GET  /api/v1/analytics/overview` — Analytics KPIs (SLA rate, revenue at risk, call stats).
- `GET  /api/v1/analytics/sla-breach` — SLA breach breakdown by stage.
- `GET  /api/v1/analytics/call-outcomes` — Call outcome distribution.
- `GET  /api/v1/analytics/agent-performance` — Per-agent performance stats.
- `GET  /api/v1/analytics/order-lifecycle` — Average time in each order stage.

### Tasks & Rules
- `GET  /api/v1/tasks` — List tasks with filters (`status`, `priority`, `type`, `assigneeId`).
- `GET  /api/v1/tasks/next` — Fetch next highest-priority pending task for immediate action.
- `GET  /api/v1/tasks/next-advanced` — Fetch next task using advanced scoring algorithm (urgency, loss risk, return avoidance, workload balance).
- `PUT  /api/v1/tasks/:id/complete` — Complete task with call outcome logging.
- `GET  /api/v1/rules` — List active task generation rules.
- `PUT  /api/v1/rules/:id` — Update (edit) a rule.
- `PATCH /api/v1/rules/:id/toggle` — Activate/deactivate rule.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or MongoDB Atlas connection string)

### Installation

1. **Clone & Install Dependencies**:
   ```bash
   # Root / Backend dependencies
   cd backend
   npm install

   # Frontend dependencies
   cd ../frontend
   npm install
   ```

2. **Environment Configuration**:
   Configure `.env` in `backend/`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/nepalcan_followup
   JWT_SECRET=your-secret-key
   COMMERCE_API_URL=https://commerce.thecanbrand.com/api

   # Delivery Zone SLA (hours)
   DELIVERY_SLA_SAME_CITY=24
   DELIVERY_SLA_MAJOR_CITY=48
   DELIVERY_SLA_THIRD_TIER=72

   # Shipped SLA thresholds
   SHIPPED_SLA_FROM_CREATION_HOURS=48
   SHIPPED_SLA_FROM_PICKUP_HOURS=24

   # Review SLA delay (hours)
   REVIEW_SLA_DELAY_HOURS=24

   # Return SLA (minutes)
   RETURN_CUSTOMER_RESPONSE_SLA=60
   RETURN_VENDOR_RESPONSE_SLA=120
   ```

3. **Run Locally**:
   - Backend Server: `cd backend && npm start` (runs on http://localhost:5000)
   - Frontend Server: `cd frontend && npm run dev` (runs on http://localhost:5173)
