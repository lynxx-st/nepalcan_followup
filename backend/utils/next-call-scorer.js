// Next Call priority scoring (Phase 11).
// score = 40*urgency + 30*lossRisk + 15*returnAvoidance + 15*workload (+ stageBonus)
// All factors normalized to 0..1 so the weighted sum stays 0..100.
// ponytail: weights hardcoded; move to settings when the ops team wants to tune.

const STAGE_PRIORITY = {
  'customer-confirmation': 10,
  'vendor-call': 8,
  'vendor-delay': 8,
  'logistics-followup': 7,
  'cancelled-recovery': 7,
  escalation: 6,
  'review-call': 5,
};

const CONTACT_WINDOW_MS = 48 * 60 * 60 * 1000;

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function urgencyScore(task, now) {
  if (!task.dueAt) return 0.5;
  const due = new Date(task.dueAt).getTime();
  const remainingMs = due - now;
  const windowMs = (task.slaMinutes || 60) * 60000;
  if (remainingMs <= 0) return 1 + clamp01(-remainingMs / Math.max(windowMs, 60000)) * 0.5;
  return clamp01(1 - remainingMs / Math.max(windowMs, 60000));
}

function lossRiskScore(task, order, now) {
  if (!order) return task.status === 'overdue' ? 0.5 : 0.2;
  const amount = Number(order.commerce && order.commerce.totalAmount) || Number(order.totalAmount) || 0;
  let score = clamp01(amount / 1000);
  if (task.status === 'overdue') score += 0.3;
  const lastContact = order.customerCalledAt || order.vendorCalledAt;
  if (!lastContact || now - new Date(lastContact).getTime() > CONTACT_WINDOW_MS) score += 0.2;
  return clamp01(score);
}

function workloadScore(task, agentLoads) {
  if (!task.assigneeId) return 0.5;
  const loads = Array.from(agentLoads.values());
  const maxLoad = loads.length ? Math.max(...loads) : 0;
  return 1 - clamp01((agentLoads.get(String(task.assigneeId)) || 0) / Math.max(maxLoad, 1));
}

// ctx: { ordersById, returnsByOrderId, agentLoads, now }
function scoreNextTask(task, ctx = {}) {
  const now = (ctx.now || Date.now());
  const order = ctx.ordersById ? ctx.ordersById.get(String(task.orderId || task.sourceOrder?.orderId)) : null;
  const factors = {
    urgency: urgencyScore(task, now),
    lossRisk: lossRiskScore(task, order, now),
    returnAvoidance: ctx.returnsByOrderId && ctx.returnsByOrderId.has(String(task.orderId)) ? 1 : 0,
    workload: workloadScore(task, ctx.agentLoads || new Map()),
    stageBonus: STAGE_PRIORITY[task.type] || 0,
  };
  const score = 40 * factors.urgency + 30 * factors.lossRisk + 15 * factors.returnAvoidance + 15 * factors.workload + factors.stageBonus;
  return { score: Math.round(score * 10) / 10, factors };
}

module.exports = { scoreNextTask, urgencyScore, lossRiskScore, workloadScore, STAGE_PRIORITY };
