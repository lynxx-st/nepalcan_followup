const assert = require('assert');
const { scoreNextTask, urgencyScore, lossRiskScore, workloadScore, STAGE_PRIORITY } = require('../utils/next-call-scorer');

const now = Date.now();
const hour = 3600000;

// urgency: overdue → ~1.5; near breach → >0; far → low
const overdueTask = { dueAt: new Date(now - 2 * hour).toISOString(), slaMinutes: 60 };
assert.ok(urgencyScore(overdueTask, now) > 1);
const freshTask = { dueAt: new Date(now + 50 * hour).toISOString(), slaMinutes: 120 };
assert.ok(urgencyScore(freshTask, now) < 0.5);

// loss risk: high value + overdue + stale contact → capped at 1
const richOrder = { totalAmount: 5000, customerCalledAt: new Date(now - 5 * 24 * hour).toISOString() };
assert.strictEqual(lossRiskScore({ status: 'overdue' }, richOrder, now), 1);
const poorFreshOrder = { totalAmount: 100, customerCalledAt: new Date(now - hour).toISOString() };
assert.strictEqual(lossRiskScore({ status: 'pending' }, poorFreshOrder, now), 0.1);

// workload: idle agent → 1, busiest → 0
assert.strictEqual(workloadScore({ assigneeId: 'a' }, new Map([['a', 0], ['b', 5]])), 1);
assert.strictEqual(workloadScore({ assigneeId: 'b' }, new Map([['a', 0], ['b', 5]])), 0);
assert.strictEqual(workloadScore({}, new Map()), 0.5);

// full score: return-boosted high-value overdue beats plain task
const base = { type: 'customer-confirmation', dueAt: new Date(now - hour).toISOString(), slaMinutes: 30 };
const a = scoreNextTask({ ...base, orderId: 'O1' }, { ordersById: new Map([['O1', { totalAmount: 5000 }]]), returnsByOrderId: new Set(['O1']), agentLoads: new Map(), now });
const b = scoreNextTask({ ...base, orderId: 'O2' }, { ordersById: new Map([['O2', { totalAmount: 100 }]]), returnsByOrderId: new Set(), agentLoads: new Map(), now });
assert.ok(a.score > b.score, `expected ${a.score} > ${b.score}`);
assert.ok(a.factors.returnAvoidance === 1 && b.factors.returnAvoidance === 0);
assert.ok(STAGE_PRIORITY['customer-confirmation'] > STAGE_PRIORITY['review-call']);

require('../modules/tasks/routes/task.routes');
console.log('next-call-scorer OK');
