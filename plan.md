# Follow-up Task Engine — Audit & Roadmap

## Project Overview
Full-stack follow-up task engine (Node/Express + React/Tailwind + MongoDB) for NepalCan Commerce.
Generates actionable follow-up tasks from order events using configurable rules.

## Audit Results — All Issues Found

### Critical Bugs (Fixed)
| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | Broken import path (3 levels up instead of 2) | `modules/schedule/scheduler.js:2` | `../../../database/models` → `../../database/models` |
| 2 | `.populate('timeline')` on Task — no timeline field exists | `modules/tasks/repository/task.repository.js:12-20` | Removed populate, service now queries `TaskTimeline.find({ taskId })` directly |
| 3 | Recovery routes: `/:id` before `/stats` — `/stats` endpoint unreachable | `modules/recovery/routes/recovery.routes.js` | Reordered GET routes: `/stats` before `/:id` |
| 4 | Frontend `getTodaySummary` calls `/v1/dashboard/today-summary` — no such backend route | `frontend/src/services/api.js:35` | Removed dead function |

### Architecture Issues (Fixed)
| # | Issue | Fix |
|---|-------|-----|
| 5 | Middleware applied both in controller exports AND route definitions (double auth) | Stripped middleware from all controller exports; routes now own middleware chain |
| 6 | Recovery controller exports wrapped handlers with `[authenticate, validate(...), handler]` | Changed to bare function exports, routes apply middleware |
| 7 | Rule controller same pattern | Same fix |
| 8 | Task controller same pattern | Same fix |

### Missing Features (Implemented)
| # | Feature | What was built |
|---|---------|----------------|
| 9 | RBAC (4 roles) | `src/middleware/rbac.js` — admin/manager/staff/user with `requireRole()` |
| 10 | Real login flow | `modules/auth/` — `POST /api/v1/auth/login` proxies to commerce API |
| 11 | Login frontend | Email + password form instead of paste-token |
| 12 | Rate limiting | `src/middleware/rateLimiter.js` — authLimiter (20/15min), apiLimiter (100/15min), internalLimiter (60/min) applied to all routes |
| 13 | CallLog CRUD | `modules/call-logs/` — POST + GET routes |
| 14 | Seeders | `database/seeders/run.js` — seeds 6 sample task rules |
| 15 | React ErrorBoundary | `frontend/src/components/ErrorBoundary.jsx` wrapping App |

### Remaining Issues (Not Yet Fixed)
| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 16 | No pagination UI on frontend (backend sends page/limit, frontend ignores) | Medium | `TodayWork` page loads all tasks, needs pagination |
| 17 | 401 retry/refresh on token expiry | Medium | Frontend just 401s with no auto-refresh |
| 18 | query param validation is inline in controller vs using route middleware | Low | `listTasks` validates `req.query` in controller body; routes only handle `req.body` |
| 19 | Logger underused — only scheduler uses it | Low | Most errors go to `console.error` |
| 20 | No aggregation pipeline for dashboard | Low | `getTodayDashboard` fetches all tasks then computes summary in-memory |

## Recommended Next Steps
1. ⬜ Add 401 interceptor in frontend that redirects to /login on token expiry
2. ⬜ Use MongoDB aggregation in dashboard (one query instead of N+1)
3. ⬜ Add logger calls across all modules
4. ⬜ Add pagination UI to TodayWork page
5. ⬜ Write API tests (jest + supertest)
6. ⬜ Add Docker Compose for local dev (MongoDB + backend + frontend)

## Architecture Notes
- **Module pattern**: Each module has `routes/`, `controller/`, `service/` subdirectories. Good.
- **Middleware**: All middleware (`authenticate`, `validate`, `requireRole`) applied at route level. Controllers export bare handler functions.
- **Express routes**: Static paths MUST be registered before dynamic `/:id` paths to avoid false matches.
- **External auth**: `POST /api/v1/auth/login` proxies to `commerce.thecanbrand.com/api/users/login`. Token stored in localStorage as `token`.
- **Rate limits**: 100/15min general, 20/15min auth, 60/min internal.