# NepalCan Ops — Follow-up Task Engine & Order Operations

NepalCan Ops is an enterprise follow-up task engine and order operations management platform built for NepalCan Commerce. It automates customer call workflows, vendor follow-ups, logistics tracking, review collection, and cancelled order recovery campaigns.

---

## 🌟 Key Features & UX Innovations

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
- **Dashboard & User Attendance**: 
  - Real-time **Check In / Check Out** shift tracker for staff & managers with active shift duration counter.
  - User profile & role overview card.
  - Analytics metrics (SLA compliance rate, active pending tasks, at-risk revenue).
  - Consolidated **Pending Items** dashboard view with direct action triggers.
- **Order Lifecycle Bundling**:
  - **PRE PROCESSING**: Order confirmation, pre-purchase calls, customer verification.
  - **Processing**: Vendor assignment, packaging delays, logistics pickup tracking.
  - **After Delivery**: Post-delivery feedback, review call collection, NPS ratings.
  - **Return**: Cancelled order recovery campaigns, return requests, rescheduled follow-ups.
- **Rule Engine**: Event-driven task generation triggered by commerce order events with configurable delay hours and SLAs.
- **Next Call View**: High-efficiency sequential call mode with quick outcome logging (Confirmed, No Answer, Call Later, Rescheduled, Lost).

---

## 🧭 Navigation Graph Architecture

```
[Navbar Header / Mobile Drawer]
  ├── Today's Work / Dashboard (/today)
  │     ├── User Info & Shift Attendance (Check In / Check Out)
  │     ├── KPI Analytics Cards (SLA Rate, At-Risk Revenue, Call Stats)
  │     └── Pending Items Dashboard (PRE PROCESSING, Processing, After Delivery, Return tabs)
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
  │     ├── 4 Stage Tabs (PRE PROCESSING | Processing | After Delivery | Return)
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

### Tasks & Rules
- `GET  /api/v1/tasks` — List tasks with filters (`status`, `priority`, `type`, `assigneeId`).
- `GET  /api/v1/tasks/next` — Fetch next highest-priority pending task for immediate action.
- `PUT  /api/v1/tasks/:id/complete` — Complete task with call outcome logging.
- `GET  /api/v1/rules` — List active task generation rules.

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
   ```

3. **Run Locally**:
   - Backend Server: `cd backend && npm start` (runs on http://localhost:5000)
   - Frontend Server: `cd frontend && npm run dev` (runs on http://localhost:5173)
