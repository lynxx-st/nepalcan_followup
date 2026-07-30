# Follow-up Task Engine

Task-driven follow-up engine for NepalCan Commerce. Sits on top of the existing order system and generates actionable follow-up tasks based on configurable rules.

## Quick Start

```
cp .env.example .env
npm install
npm start
```

## API Endpoints

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tasks` | Create a task |
| GET | `/api/v1/tasks/next` | Get next task for assignee |
| GET | `/api/v1/tasks` | List tasks (filters: status, type, priority, assigneeId) |
| GET | `/api/v1/tasks/:id` | Get task with timeline |
| PUT | `/api/v1/tasks/:id/assign` | Assign task to user |
| PUT | `/api/v1/tasks/:id/complete` | Mark task complete |
| PUT | `/api/v1/tasks/:id/skip` | Skip task |
| PUT | `/api/v1/tasks/:id` | Update task |
| DELETE | `/api/v1/tasks/:id` | Delete task |

### Commerce Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/commerce/login` | Login with .env credentials, get token |
| POST | `/api/v1/commerce/sync` | Fetch orders from commerce API (paginated, auto-creates tasks) |
| GET | `/api/v1/commerce/orders` | List synced orders (filter by status, vendor, customer) |
| GET | `/api/v1/commerce/orders/:id` | Get synced order by commerce order ID |
| GET | `/api/v1/commerce/orders/:id/status` | Get current order status from sync |

### Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/rules` | Create a follow-up rule |
| GET | `/api/v1/rules` | List all rules |
| GET | `/api/v1/rules/:id` | Get rule by ID |
| PUT | `/api/v1/rules/:id` | Update rule |
| DELETE | `/api/v1/rules/:id` | Delete rule |
| PATCH | `/api/v1/rules/:id/toggle` | Activate/deactivate rule |
| POST | `/api/v1/rules/evaluate` | Evaluate rules against order data |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/today` | Today's tasks + summary + next call |
| GET | `/api/v1/dashboard/stats` | Performance stats |

### Recovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/recovery` | Start a recovery campaign |
| GET | `/api/v1/recovery` | List campaigns |
| GET | `/api/v1/recovery/:id` | Get campaign details |
| PUT | `/api/v1/recovery/:id` | Update campaign |
| GET | `/api/v1/recovery/stats` | Recovery rate + common reasons |

### Internal

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/internal/task-generator` | Generate tasks from order event |
| GET | `/health` | Health check |

## Task Types

- `customer-confirmation` — Follow up with customer
- `vendor-call` — Contact vendor about an order
- `vendor-delay` — Remind vendor about delayed order
- `cancelled-recovery` — Try to recover cancelled order
- `review-call` — Collect customer review after delivery
- `escalation` — Escalate stuck or problematic orders

## Task Rule Engine

Rules are stored in MongoDB and evaluated when order events fire:

```json
{
  "name": "Vendor follow-up after confirmation",
  "trigger": "order.status.changed",
  "condition": { "newStatus": "confirmed" },
  "delayHours": 24,
  "taskType": "vendor-call",
  "priority": "high",
  "slaMinutes": 30
}
```

## Architecture

```
Order API ──► Task Generator ──► Task Rule Engine ──► Tasks (MongoDB)
                                                             │
                        ┌──────────────────────────────────┘
                        ▼
                   Follow-up Dashboard
                   (Next Call / Today's Work / Recovery)
```

## Key Design Decisions

- **Tasks, not order statuses** — an order can appear in multiple task queues simultaneously
- **Configurable rules** — managers edit rules in MongoDB, no code changes needed
- **Task reasons** — every task explains why it was created
- **Full timeline** — every status change is recorded for troubleshooting
- **Next Call mode** — single endpoint returns the highest-priority pending task, auto-advances after completion

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- Socket.io (real-time updates)
- JWT authentication (shared with existing system)