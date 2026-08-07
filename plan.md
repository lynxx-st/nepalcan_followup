# NepalCan Ops — Rehauged UX & Implementation Plan

## Vision

NepalCan Ops becomes a mobile-first SaaS follow-up engine for order operations. The app is designed as a professional SaaS product with a bottom navigation bar, swipeable task queues, stage-specific order pages, and advanced SLA/analytics. Every page is optimized for thumb-driven mobile use with 44px+ touch targets, sticky action bars, and a SaaS-style navbar.

---

## Current State Audit

### What Works
- 4-stage order lifecycle (Pre Order → Processing → After Delivery → Return)
- Stage-specific pages (OrderConfirmedUnprocessed, OrderShipped, OrderPendingReview, OrderCustomerResponse, OrderVendorResponse)
- Returns page with customer/vendor tabs
- Next Call workstation with outcome buttons
- Today Work dashboard with KPI cards
- Rules engine for task generation
- Settings page with SLA/config values
- Mobile-responsive card layouts, sticky bottom bars
- Monochromatic DESIGN.md design system (Geist, #f5f5f5 canvas, 24px radius)
- Backend sync service with commerce API integration
- OrderReturn model and returns sync
- Review modal with 3 Yes/No/Other questions
- LogisticsTimeline component for shipped orders

### What Needs Fixing or Adding
- Task Queues page should be hidden from frontend
- Next Call needs list view + Tinder-like swipe view
- SLA system needs delivery zone groups (city tiers)
- Shipped page needs SLA crossing detection + comment API for external logistics
- Delivery time tracking (created → delivered) not computed
- Returns need image zoom on attachment click
- Returns need flexible follow-up (either customer or vendor first)
- Rules need editing (currently create-only)
- Multi-user Follow Up role task division not implemented
- Analytics/stats page needs charts and deeper metrics
- Navbar needs SaaS-style bottom bar for mobile
- Order workflow transitions need rescheduled status handling
- Comments API for external non-heavy logistics not connected
- Delivery zone SLA config missing from settings

---

## Phase Checklist (24 Phases)

### Backend — Foundation

| Phase | Name | Description |
|-------|------|-------------|
| 1 | Delivery Zone SLA Config | Add deliveryZones to settings DB model with city groups (major, third-tier, same-city) and expected delivery hours per zone. Add deliveryZone field to CommerceOrder. |
| 2 | SLA Calculation Engine | Backend service that computes two SLA windows for shipped orders: (a) from order creation time, (b) from pickup collected/drop order collected time (non-heavy only). Store slaCreatedAt, slaPickupAt, slaDeliveryDeadline, slaStatus on CommerceOrder. |
| 3 | External Logistics Comments API | New backend endpoint POST /api/v1/commerce/orders/:id/logistics-comment that leaves a comment on the external non-heavy logistics order ID via the external commerce API. Base URL read from .env (COMMERCE_API_BASE). Also GET /api/v1/commerce/orders/:id/logistics-comments to fetch all comments. |
| 4 | Delivery Time Tracking | Compute and store timeToDelivery (createdAt → deliveredAt) on CommerceOrder. New field deliveredAt tracked when order status becomes Delivered. |
| 5 | Order Workflow Stage Transitions | Update computeWorkflowStage to handle: (a) rescheduled status recorded in DB and shown in appropriate stage, (b) vendor follow-up moves order to confirmed_unprocessed after vendor accepts, (c) customer confirmation moves to vendor call module, (d) vendor reschedule creates rescheduled stage entry. |
| 6 | Returns Enhancement — Flexible Follow-Up | Update OrderReturn model to allow following up on either customer or vendor in any order. Add followUpOrder field (customer_first | vendor_first). Update updateReturnStatus to allow editing status on any step. Add returnHistory array tracking every status change. |
| 7 | Returns — Image Zoom Support | Ensure attachments array on OrderReturn includes url, name, type fields. Add zoomable flag. Backend serves attachment URLs with proper CORS. |
| 8 | Analytics Aggregation API | New endpoints: GET /api/v1/analytics/overview (KPIs), GET /api/v1/analytics/sla-breach (breach breakdown by stage), GET /api/v1/analytics/call-outcomes (outcome distribution), GET /api/v1/analytics/agent-performance (per-agent stats), GET /api/v1/analytics/order-lifecycle (avg time in each stage). |
| 9 | Multi-User Task Division | Add assignedTo field on task generation rules. Add team field on User model. Add GET /api/v1/tasks/assigned-to-me endpoint. Add workload distribution endpoint GET /api/v1/tasks/workload. |
| 10 | Task Queues API — Soft Hide | Add hidden field to task queue config. Add endpoint to toggle visibility. Backend still supports queues but frontend hides them. |
| 11 | Next Call Algorithm — Priority Engine | New backend endpoint GET /api/v1/tasks/next-advanced that returns next task based on: (a) urgency (SLA proximity), (b) customer loss risk (orders with high value + overdue), (c) return avoidance (pending returns get priority), (d) workload balance across agents. Algorithm scores each pending task and returns highest. |

### Frontend — UI/UX Overhaul

| Phase | Name | Description |
|-------|------|-------------|
| 12 | Navbar SaaS Redesign | Replace top pill navigation with SaaS-style bottom nav bar on mobile (<640px): icon + label, 44px min touch targets. Desktop keeps top nav. Add notification badge, sync status, shift indicator to header. Mobile: hamburger drawer with all nav links. |
| 13 | Hide Task Queues Page | Remove /queues route from App.tsx. Remove TaskQueues from Navbar links. Remove Layers icon import if unused. Keep TaskDetail page for deep links. |
| 14 | Next Call — List View | Redesign NextCall page with sortable list: columns for Order #, Customer, Priority, SLA, Stage, Actions. Sortable by: order status, urgency, SLA proximity, priority. Each row shows full order summary and quick-action buttons (Call Customer, Call Vendor, Complete). Tinder-like swipe view toggle button in header. |
| 15 | Next Call — Tinder-like View | Full-screen card view showing order details (customer, items, address, SLA). Checklist panel on right showing task-type-specific steps. Swipe right = complete, swipe left = skip, swipe up = reschedule. Bottom sticky action bar with primary CTA. Algorithm determines next card order. |
| 16 | Stage-Specific Order Pages Enhancement | Update all 5 stage pages: (a) confirmed_unprocessed — vendor call only + status recording module (why unprocessed after vendor call), (b) shipped — logistics timeline + external logistics number (+977 01-5970736) + SLA display + comment button (appears only when SLA crossed), (c) pending_review — review collection module, (d) customer_response — return follow-up with flexible customer/vendor order, (e) vendor_response — same. |
| 17 | Returns Page Enhancement | Add image zoom on attachment click (lightbox). Allow following up on customer OR vendor first (toggle). Allow editing return status after update. Show full return history timeline. Add delivery time display (created → delivered) on each return card. |
| 18 | Rules Page Enhancement | Make rules editable (inline edit + save). Add rule toggle/enable-disable per rule. Add rule duplication. Simplify rule creation form with guided steps. Add rule execution log showing last evaluation result. |
| 19 | Settings Page Enhancement | Add delivery zone group configuration (major city / third-tier city / same-city with expected delivery hours). Add SLA config for shipped status (created-time SLA, pickup-time SLA). Add external logistics API base URL config (from .env). Add comment SLA threshold config. |
| 20 | Analytics/Stats Page Enhancement | Add chart visualizations: bar chart for call outcomes, line chart for SLA compliance over time, pie chart for order stage distribution, agent leaderboard table. Add date range filter. Add export CSV button. |
| 21 | Mobile Responsiveness Audit | Audit all pages for 44px touch targets, sticky bottom bars on mobile, responsive stacking, hamburger drawer functionality. Fix any gaps. Test on multiple viewport sizes. |
| 22 | Image Zoom Component | Create reusable ImageZoom.tsx component using lightbox pattern. Used in Returns page for attachment zoom. Supports pinch-to-zoom on mobile, swipe to dismiss. |
| 23 | Integration & E2E Testing | Verify all stage transitions work end-to-end. Test SLA breach detection. Test comment API for external logistics. Test returns flexible follow-up. Test Next Call algorithm. Test mobile nav drawer. |
| 24 | Build, Lint & Final Verification | Run npm run build on frontend. Run backend tests. Verify all routes work. Final QA pass on mobile viewport. |

---

## Navigation Architecture (SaaS-Style)

### Desktop (≥640px)
```
Header: Logo | Search | Sync | Shift | Notifications | User Menu
Pill Nav: Today | Next Call | Orders | Returns | Reviews | Recovery | Rules | Analytics | Settings
Main Content Area
```

### Mobile (<640px)
```
Sticky Top Header: Logo | Search Icon | Notification Bell | Hamburger
Main Content Area with bottom padding
Sticky Bottom Nav Bar: Today | Next | Orders | Returns | More
```

### Mobile Drawer (hamburger open)
```
User Info Card with Check In/Out
All Navigation Links as stacked cards
Logout Button at bottom
```

---

## Mobile-First SaaS Design Principles

1. Bottom Navigation Bar: Primary routes accessible via thumb on every screen
2. 44px Minimum Touch Targets: All buttons, links, and interactive elements
3. Sticky Action Bars: Primary actions always accessible at bottom on mobile
4. Progressive Disclosure: Show summary first, expand on tap
5. Thumb-Zone Optimization: Most-used actions in bottom-center thumb zone
6. Swipe Gestures: Tinder-like swipe on Next Call for quick actions
7. Hamburger Drawer: Secondary nav hidden behind hamburger on mobile
8. Bottom Sheet Modals: Modals slide up from bottom on mobile
9. Responsive Typography: Scale down headings on mobile, maintain readability
10. Safe Area Insets: Account for notches and home indicators on modern devices

---

## Order Workflow Flow (Updated)

```
New Order → pending_confirmation
  ├─ Customer Confirmed → confirmed_unprocessed (Vendor Follow Up)
  │     ├─ Vendor Accepts → confirmed_unprocessed (close vendor module, show status)
  │     │     └─ Order Shipped → shipped
  │     │           ├─ SLA Crossed → comment on external logistics + show comment button
  │     │           └─ Delivered → pending_review (after review SLA delay)
  │     │                 └─ Review Collected → done
  │     └─ Vendor Reschedules → rescheduled (recorded in DB, shown in appropriate stage)
  └─ Customer Rejects → cancelled → recovery campaign

Returns (pulled from external API):
  ├─ customer_response → follow up customer first (or vendor first, configurable)
  │     └─ Customer Confirms → vendor_response
  │           └─ Vendor Accepts/Rejects → completed
  └─ vendor_response → follow up vendor
        └─ Vendor Accepts/Rejects → completed
```

---

## Next Call Algorithm (Advanced)

### Scoring Formula
```
score = (urgency_weight * urgency) + (loss_risk_weight * loss_risk) + (return_avoidance_weight * return_avoidance) + (workload_balance_weight * workload_balance)
```

### Factors
1. Urgency: SLA proximity (hours remaining / total SLA hours). Closer to breach = higher urgency.
2. Loss Risk: High-value orders + overdue status + customer not contacted in 48h+.
3. Return Avoidance: Orders with pending returns get boosted priority (avoid losing customer).
4. Workload Balance: Distribute evenly across agents with Follow Up role.
5. Stage Priority: pending_confirmation > confirmed_unprocessed > shipped > pending_review > customer_response > vendor_response.

### Views
- List View: Sortable table/grid with all factors visible
- Tinder View: Full order card with checklist, swipe to action
- Algorithm Toggle: Switch between manual priority and algorithm priority

---

## Technical Implementation Notes

### Backend Changes
- backend/config/index.js: Add COMMERCE_API_BASE from .env (already exists, ensure used for logistics comments)
- backend/database/models/index.js: Add deliveryZones to Setting defaults, deliveryZone to CommerceOrder, timeToDelivery + deliveredAt to CommerceOrder, followUpOrder + returnHistory to OrderReturn
- backend/modules/commerce/service/commerce.sync.service.js: Update computeWorkflowStage for rescheduled handling, add SLA calculation for shipped orders, add delivery time tracking
- backend/modules/commerce/controller/commerce.controller.js: Add logistics comment endpoints, analytics endpoints, delivery time endpoint
- backend/modules/settings/service/settings.service.js: Add delivery zone config support

### Frontend Changes
- frontend/src/App.tsx: Remove /queues route, update NextCall route
- frontend/src/components/Navbar.tsx: SaaS-style bottom nav for mobile, restructure desktop nav
- frontend/src/pages/NextCall.tsx: Complete redesign with list + Tinder views
- frontend/src/pages/TaskQueues.tsx: Remove or hide from nav
- frontend/src/pages/OrderShipped.tsx: Add SLA display, comment button, logistics number
- frontend/src/pages/Returns.tsx: Add image zoom, flexible follow-up, status editing
- frontend/src/pages/Rules.tsx: Add inline editing
- frontend/src/pages/Settings.tsx: Add delivery zone config
- frontend/src/pages/Stats.tsx: Add charts and deeper analytics
- frontend/src/components/ImageZoom.tsx: New reusable component
- frontend/src/components/BottomNav.tsx: New SaaS bottom navigation component

### Environment Variables
Add to backend/.env and backend/.env.example:
```
COMMERCE_API_BASE=https://commerce.thecanbrand.com/api
DELIVERY_SLA_SAME_CITY=24
DELIVERY_SLA_MAJOR_CITY=48
DELIVERY_SLA_THIRD_TIER=72
SHIPPED_SLA_FROM_CREATION_HOURS=48
SHIPPED_SLA_FROM_PICKUP_HOURS=24
REVIEW_SLA_DELAY_HOURS=24
RETURN_CUSTOMER_RESPONSE_SLA=60
RETURN_VENDOR_RESPONSE_SLA=120
```

---

## Design System Updates (DESIGN.md)

Add to DESIGN.md:
- Mobile Nav: Bottom bar with 4-5 icon buttons, 44px min height, #fafafa background, #e5e5e5 top border
- Bottom Action Bar: Fixed bottom on mobile, bg-white/95 backdrop-blur, 44px min height for buttons
- Swipe Actions: Tinder-like cards with 100vw width, 85vh height, rounded-2xl
- Image Zoom Lightbox: Full-screen overlay with bg-black/80 backdrop-blur, image centered, pinch-to-zoom
- SaaS Header: Sticky top, bg-white/95 backdrop-blur, bottom border #e5e5e5
- Drawer: Slide from left, w-72, bg-white, shadow-xl
- Chart Colors: Use monochromatic scale — #0a0a0a for primary, #737373 for secondary, #e5e5e5 for grid lines

---

## claude.md Updates

Add sections:
- SaaS navigation patterns (bottom bar, hamburger drawer)
- Swipe gesture patterns for task queues
- Image zoom lightbox pattern
- Delivery zone SLA configuration
- Multi-agent workload distribution
- Advanced Next Call algorithm
- Analytics dashboard patterns
- Mobile-first SaaS layout conventions

---

## README.md Updates

Update to reflect:
- SaaS-style navigation (bottom bar, mobile drawer)
- New pages (stage-specific order pages, enhanced Next Call, Returns with image zoom)
- SLA system with delivery zones
- External logistics comments API
- Advanced Next Call algorithm
- Multi-user task division
- Analytics dashboard
- Updated navigation graph architecture
- Updated tech stack notes
- Updated getting started instructions

---

## Analytics & Reporting Plan

### Charts to Implement
1. SLA Compliance Over Time — Line chart (daily/weekly)
2. Call Outcome Distribution — Donut/pie chart
3. Order Stage Distribution — Bar chart
4. Agent Performance Leaderboard — Table with metrics
5. Revenue at Risk — Metric card + trend
6. Average Time in Stage — Horizontal bar chart
7. Return Recovery Rate — Metric + trend line
8. Task Completion Velocity — Bar chart by day

### Data Points to Track
- Every order stage transition with timestamp
- Every call outcome with duration
- Every note/comment with actor and timestamp
- SLA breach events
- Return follow-up actions
- Agent workload distribution
- Task assignment and completion times

---

## Success Criteria

- All 24 phases implemented and tested
- Mobile-first SaaS nav with bottom bar works on all pages
- Next Call has both list and Tinder views
- SLA system works for shipped orders with delivery zone config
- Comments API connected for external logistics
- Returns support image zoom and flexible follow-up
- Task Queues page hidden from frontend
- Rules are fully editable
- Analytics page has charts and export
- Multi-user Follow Up role task division works
- Build passes cleanly
- All mobile touch targets ≥ 44px
- All pages have Breadcrumbs + back button
- Order numbers clickable across all views

---

*Plan created for NepalCan Ops follow-up task engine. All phases designed for mobile-first SaaS delivery with the existing monochromatic design system.*