const { Task, CallLog, CommerceOrder, OrderReturn } = require('../../../database/models');

function sinceDays(req) {
  const days = parseInt(req.query.days, 10) || 30;
  return new Date(Date.now() - days * 86400000);
}

async function getAnalyticsOverview(req, res, next) {
  try {
    const since = sinceDays(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [orderStats, stageCounts, revenueResult, taskStats, completedTasks, returnsTotal, returnsActive, breaches, avgDelivery] = await Promise.all([
      CommerceOrder.countDocuments({ createdAt: { $gte: since } }),
      CommerceOrder.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$workflowStage', count: { $sum: 1 } } }]),
      CommerceOrder.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, total: { $sum: '$commerce.totalAmount' } } }]),
      Task.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.find({ status: 'completed', createdAt: { $gte: since } }).select('dueAt completedAt').lean(),
      OrderReturn.countDocuments({ createdAt: { $gte: since } }),
      OrderReturn.countDocuments({ workflowStage: { $ne: 'completed' }, createdAt: { $gte: since } }),
      CommerceOrder.countDocuments({ 'sla.slaStatus': 'breached', createdAt: { $gte: since } }),
      CommerceOrder.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, avgMs: { $avg: '$timeToDeliveryMs' } } }]),
    ]);

    const byStage = {};
    for (const s of stageCounts) byStage[s._id || 'other'] = s.count;

    const byStatus = {};
    for (const s of taskStats) byStatus[s._id] = s.count;
    const totalTasks = Object.values(byStatus).reduce((a, b) => a + b, 0);

    let onTime = 0;
    for (const t of completedTasks) {
      if (!t.dueAt || (t.completedAt && new Date(t.completedAt) <= new Date(t.dueAt))) onTime++;
    }
    const slaRate = totalTasks > 0 ? Math.round((onTime / (byStatus.completed || 0)) * 100) : 100;

    res.json({
      success: true,
      data: {
        orders: { total: orderStats, revenue: (revenueResult[0] && revenueResult[0].total) || 0, byStage },
        tasks: { total: totalTasks, byStatus, slaRate: byStatus.completed ? slaRate : null },
        returns: { total: returnsTotal, active: returnsActive, resolved: returnsTotal - returnsActive },
        sla: { breached: breaches },
        delivery: { avgTimeToDeliveryMs: (avgDelivery[0] && Math.round(avgDelivery[0].avgMs)) || null },
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getAnalyticsSlaBreach(req, res, next) {
  try {
    const since = sinceDays(req);
    const range = { createdAt: { $gte: since } };
    const [total, byStage, byZone, amountResult] = await Promise.all([
      CommerceOrder.countDocuments({ 'sla.slaStatus': 'breached', ...range }),
      CommerceOrder.aggregate([
        { $match: { 'sla.slaStatus': 'breached', ...range } },
        { $group: { _id: '$workflowStage', count: { $sum: 1 } } },
      ]),
      CommerceOrder.aggregate([
        { $match: { 'sla.slaStatus': 'breached', ...range } },
        { $group: { _id: '$deliveryZone', count: { $sum: 1 } } },
      ]),
      CommerceOrder.aggregate([
        { $match: { 'sla.slaStatus': 'breached', ...range } },
        { $group: { _id: null, amount: { $sum: '$commerce.totalAmount' } } },
      ]),
    ]);

    const stageBreakdown = {};
    for (const s of byStage) stageBreakdown[s._id || 'other'] = s.count;
    const zoneBreakdown = {};
    for (const s of byZone) zoneBreakdown[s._id || 'unknown'] = s.count;

    res.json({
      success: true,
      data: {
        total,
        revenueAtRisk: (amountResult[0] && amountResult[0].amount) || 0,
        byStage: stageBreakdown,
        byZone: zoneBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getAnalyticsCallOutcomes(req, res, next) {
  try {
    const since = sinceDays(req);
    const outcomes = await CallLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$outcome',
          count: { $sum: 1 },
          avgDurationMinutes: { $avg: '$durationMinutes' },
          totalDurationMinutes: { $sum: '$durationMinutes' },
        },
      },
    ]);
    res.json({
      success: true,
      data: { outcomes, total: outcomes.reduce((a, o) => a + o.count, 0) },
    });
  } catch (error) {
    next(error);
  }
}

async function getAnalyticsAgentPerformance(req, res, next) {
  try {
    const since = sinceDays(req);
    const [taskStats, callStats] = await Promise.all([
      Task.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$assigneeName',
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $in: ['$status', ['pending', 'in-progress']] }, 1, 0] } },
            total: { $sum: 1 },
            avgResolutionMinutes: {
              $avg: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 60000] },
                  null,
                ],
              },
            },
          },
        },
        { $match: { _id: { $ne: null } } },
      ]),
      CallLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $lookup: {
            from: 'admins',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'agent',
          },
        },
        {
          $group: {
            _id: { $ifNull: [{ $arrayElemAt: ['$agent.name', 0] }, 'unassigned'] },
            calls: { $sum: 1 },
            avgDurationMinutes: { $avg: '$durationMinutes' },
          },
        },
      ]),
    ]);

    const agents = {};
    for (const a of taskStats) {
      if (!a._id) continue;
      agents[a._id] = {
        name: a._id,
        tasksCompleted: a.completed,
        tasksOverdue: a.overdue,
        tasksPending: a.pending,
        tasksTotal: a.total,
        avgTaskResolutionMinutes: Math.round(a.avgResolutionMinutes || 0),
      };
    }
    for (const c of callStats) {
      const name = c._id || 'unassigned';
      if (!agents[name]) agents[name] = { name };
      agents[name].calls = c.calls;
      agents[name].avgCallDurationMinutes = Math.round((c.avgDurationMinutes || 0) * 10) / 10;
    }

    res.json({ success: true, data: { agents: Object.values(agents) } });
  } catch (error) {
    next(error);
  }
}

// Lifecycle windows are attributed at the four bundle level (pre-order,
// processing, after-delivery, return) from statusHistory transitions, because
// history entries only record the changed statuses, not full order snapshots.
// ponytail: bundle-level, not enum-level; move to per-stage timestamps when
// sync records workflowStage entries.
function bundleOf(cs, vs, orderStatus) {
  if (orderStatus === 'Cancelled' || cs === 'rescheduled' || vs === 'rescheduled') return 'return';
  if (orderStatus === 'Delivered') return 'after-delivery';
  if (vs === 'accepted' || cs === 'confirmed') return 'processing';
  return 'pre-order';
}

async function getAnalyticsOrderLifecycle(req, res, next) {
  try {
    const since = sinceDays(req);
    const [orders, returns] = await Promise.all([
      CommerceOrder.find({ statusHistory: { $exists: true, $ne: [] }, createdAt: { $gte: since } })
        .select('createdAt workflowUpdatedAt deliveredAt statusHistory customer confirmationStatus vendor vendorStatus commerce.orderStatus')
        .lean(),
      OrderReturn.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$workflowStage',
            count: { $sum: 1 },
            avgResolutionMs: {
              $avg: { $subtract: ['$updatedAt', '$createdAt'] },
            },
          },
        },
      ]),
    ]);

    const durations = {};
    const counts = {};
    for (const order of orders) {
      const entries = (order.statusHistory || [])
        .filter((e) => e && e.changedAt)
        .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
      let cs = (order.customer && order.customer.confirmationStatus) || 'pending';
      let vs = (order.vendor && order.vendor.vendorStatus) || 'unassigned';
      let os = (order.commerce && order.commerce.orderStatus) || 'Pending';
      let windowStart = order.createdAt || new Date();
      const addWindow = (bundle, from, to) => {
        if (to <= from) return;
        durations[bundle] = (durations[bundle] || 0) + (to - from);
        counts[bundle] = (counts[bundle] || 0) + 1;
      };
      for (const entry of entries) {
        const t = new Date(entry.changedAt);
        addWindow(bundleOf(cs, vs, os), windowStart, t);
        if (entry.confirmationStatus) cs = entry.confirmationStatus;
        if (entry.vendorStatus) vs = entry.vendorStatus;
        if (entry.orderStatus) os = entry.orderStatus;
        windowStart = t;
      }
      if (order.deliveredAt) {
        addWindow(bundleOf(cs, vs, os), windowStart, order.deliveredAt);
        windowStart = order.deliveredAt;
        os = 'Delivered';
      }
      addWindow(bundleOf(cs, vs, os), windowStart, order.workflowUpdatedAt || new Date());
    }

    const stages = {};
    for (const [bundle, ms] of Object.entries(durations)) {
      stages[bundle] = Math.round(ms / (counts[bundle] || 1));
    }

    const returnStages = {};
    for (const r of returns) {
      returnStages[r._id || 'unknown'] = {
        count: r.count,
        avgResolutionMs: Math.round(r.avgResolutionMs || 0),
      };
    }

    res.json({
      success: true,
      data: {
        avgTimeByBundleMs: stages,
        returns: returnStages,
        ordersWithHistory: orders.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAnalyticsOverview,
  getAnalyticsSlaBreach,
  getAnalyticsCallOutcomes,
  getAnalyticsAgentPerformance,
  getAnalyticsOrderLifecycle,
  bundleOf,
};
