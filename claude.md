# Developer & AI Operational Manual — NepalCan Ops

This document provides essential guidelines, architectural conventions, mobile responsiveness standards, and design system rules for developers and AI assistants working on the NepalCan Ops codebase.

---

## 🎨 UI & Design System Rules (`frontend/DESIGN.md`)

When modifying or adding frontend components, strictly follow these design constraints:

1. **Color Tokens**:
   - **Canvas Background**: `#f5f5f5` (`--color-canvas`)
   - **Paper Surface (Cards)**: `#ffffff` (`--color-paper`)
   - **Surface Alt (Sidebar/Header)**: `#fafafa` (`--color-surface-alt`)
   - **Ink (Primary Text & Headings)**: `#0a0a0a` (`--color-ink`)
   - **Mid Gray (Secondary/Muted Text)**: `#737373` (`--color-mid-gray`)
   - **Hairline Border**: `#e5e5e5` (`--color-hairline`)
   - **Ember (Destructive ONLY)**: `#e7000b` (`--color-ember`) — **NEVER** use for header background, decorative tags, or branding.

2. **Border Radius Geometry**:
   - Containers & Cards: `24px` (`rounded-3xl` or `rounded-[24px]`)
   - Interactive Controls (Buttons, Badges, Inputs): `18px` (`rounded-2xl` or `rounded-[18px]`)
   - Nested inner containers: `10px` (`rounded-lg`)
   - Small controls: `6px` (`rounded-md`)

3. **Buttons & Actions Placement**:
   - **Primary Action**: Filled `#0a0a0a` background with `#ffffff` text, 18px radius, height ~36-40px. Positioned right-aligned or thumb-accessible.
   - **Secondary Ghost Action**: `#f5f5f5` background with `#0a0a0a` text, 18px radius. Positioned adjacent to primary actions.
   - **Outline Action**: Transparent background with 1px hairline border (`#e5e5e5`), 18px radius.
   - **Destructive Action**: `#e7000b` text/icon or `#e7000b` outline. Use exclusively for delete, cancel, or skip states.

4. **Typography**:
   - Use **Geist** font family with fallback to Inter.
   - Display headlines at 48px/600 with `-0.05em` tracking.
   - Section headings at 24-30px/600 with tight tracking (`-0.025em`).
   - Body text at 14px/400, captions at 12px uppercase.

---

## 📱 Mobile Responsiveness Standards

- **Touch Targets**: All interactive elements (buttons, links, tab items) must be at least `44px x 44px` on touch screens.
- **Sticky Mobile Actions**: On screens `<640px`, render primary completion actions in a fixed bottom sticky bar (`fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t`).
- **Responsive Stack Layouts**: Tables on mobile should break into stacked card components with expandable details.
- **Navigation Drawer**: Mobile header uses a hamburger button opening a sliding drawer rather than wrapping menu links into multiple lines.
- **Bottom Navigation Bar**: On mobile (<640px), a fixed bottom nav bar with 4-5 icon buttons provides primary route access. Each button is 44px min height with icon + label.
- **Swipe Gestures**: Tinder-like swipe on Next Call cards — swipe right to complete, swipe left to skip, swipe up to reschedule.
- **Image Zoom Lightbox**: Attachments in Returns page support pinch-to-zoom on mobile, swipe-to-dismiss.

---

## 📐 SaaS Navigation Patterns

- **Desktop (≥640px)**: Top header with logo, search, sync, shift, notifications, user menu. Pill navigation bar below header for primary routes.
- **Mobile (<640px)**: Sticky top header with logo, search icon, notification bell, hamburger menu. Fixed bottom navigation bar with 4-5 primary routes. Hamburger drawer slides down with all nav links, user info, check-in/out, and logout.
- **Mobile Drawer**: Full-width slide-down panel from top header. User info card at top with shift attendance toggle. All nav links as stacked cards. Logout button at bottom.
- **Breadcrumbs**: Every page with `Breadcrumbs` component showing location hierarchy.
- **Back Buttons**: Every detail view has explicit back button pointing to parent listing.
- **Click Depth**: Maximum 3 clicks to reach any action from any page. Primary actions always visible (bottom bar on mobile, header on desktop).

---

## 🔄 Advanced Workflow Patterns

### Delivery Zone SLA
SLA for shipped orders is configurable by delivery zone:
- Same city: configurable hours (default 24h)
- Major city: configurable hours (default 48h)
- Third-tier city: configurable hours (default 72h)

Two SLA windows for non-heavy logistics:
1. From order creation time
2. From pickup collected / drop order collected time

### External Logistics Comments
When shipped SLA is crossed, a comment can be left on the external non-heavy logistics order ID via the external commerce API. Base URL read from `.env` (`COMMERCE_API_BASE`). All responses are fetched and displayed on the shipped page.

### Delivery Time Tracking
Every order tracks `timeToDelivery` (createdAt → deliveredAt) displayed in day/hour/minute format on the order detail page.

### Returns Flexible Follow-Up
Returns can be followed up on either customer or vendor first. The `followUpOrder` field on OrderReturn controls this. Status can be edited at any step. Full return history is tracked.

### Next Call Algorithm
Tasks are scored by:
1. Urgency (SLA proximity)
2. Loss risk (high value + overdue + not contacted in 48h+)
3. Return avoidance (pending returns boosted)
4. Workload balance (even distribution across Follow Up agents)

Two views: sortable list and Tinder-like swipe card with checklist.

---

## 🧭 Navigation & Backlink Standards

- Every detail view (e.g. `OrderDetail`, `TaskDetail`, `NextCall`) **MUST** include a top `<Breadcrumbs />` component showing the user's location hierarchy.
- Every detail view **MUST** include an explicit back button (e.g. `← Back to Orders`) pointing to the parent listing.
- Order numbers (`#ORD-XXXX`) and Task numbers (`#TKN-XXXX`) must be clickable links across all tables, lists, and summary cards.

---

## 📦 Order Lifecycle Workflow Bundling

When displaying orders or tasks, bundle them into the four standard lifecycle stages:

| Lifecycle Stage | Scope & Included Statuses | Key Action |
|---|---|---|
| **Pre Order** | `pending_confirmation`, unconfirmed orders, customer validation | Phone confirmation call |
| **Processing** | `confirmed_unprocessed`, `collected_by_logistics` (customer confirmed + vendor accepted + order status `processing`; moves to `shipped` only when order status is `shipped`), `shipped`, vendor assignment, logistics delay | Vendor call, Logistics followup |
| **After Delivery** | `delivered_followup`, `pending_review`, product reviews | Review call, NPS feedback |
| **Return** | `rescheduled`, `cancelled` (recovery call → recovered orders tracked on Recovery page with `recoveredBy`), `hold` (order status `hold` from API), `cancelled-recovery`, refund request | Recovery campaign call |

---

## 🛠 Useful Commands & Workflows

```bash
# Start backend in dev mode
cd backend && npm start

# Start frontend in dev mode
cd frontend && npm run dev

# Run frontend build check
cd frontend && npm run build
```
