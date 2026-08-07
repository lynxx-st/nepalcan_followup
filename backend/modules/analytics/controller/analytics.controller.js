const { Task, CallLog, CommerceOrder, OrderReturn, RecoveryCampaign } = require('../../../database/models');

// Build a { createdAt: { $gte, $lte } } filter from ?from / ?to ISO dates.
// `to` is clamped to end-of-day so custom ranges include the whole last day.
// No params → {} (all-time), keeping old behavior.
function rangeFilter(req) {
  const { from, to } = req.query || {};
  const filter = {};
  if (from && !Number.isNaN(new Date(from).getTime())) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    filter.createdAt = { ...(filter.createdAt || {}), $gte: d };
  }
  if (to && !Number.isNaN(new Date(to).getTime())) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    filter.createdAt = { ...(filter.createdAt || {}), $lte: d };
  }
  return filter;
}

async function getAnalyticsOverview(req, res, next) {
  try {
    const range = rangeFilter(req);

    const [orderStats, stageCounts, stageRevenue, revenueResult, taskStats, taskByType, completedTasks, returnsTotal, returnsActive, breaches, avgDelivery] = await Promise.all([
      CommerceOrder.countDocuments(range),
      CommerceOrder.aggregate([{ $match: range }, { $group: { _id: '$workflowStage', count: { $sum: 1 } } }]),
      CommerceOrder.aggregate([{ $match: range }, { $group: { _id: '$workflowStage', total: { $sum: '$commerce.totalAmount' } } }]),
      CommerceOrder.aggregate([{ $match: range }, { $group: { _id: null, total: { $sum: '$commerce.totalAmount' } } }]),
      Task.aggregate([{ $match: range }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.aggregate([
        { $match: range },
        { $group: { _id: '$type', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      ]),
      Task.find({ ...range, status: 'completed' }).select('dueAt completedAt').lean(),
      OrderReturn.countDocuments(range),
      OrderReturn.countDocuments({ ...range, workflowStage: { $ne: 'completed' } }),
      CommerceOrder.countDocuments({ ...range, 'sla.slaStatus': 'breached' }),
      CommerceOrder.aggregate([{ $match: range }, { $group: { _id: null, avgMs: { $avg: '$timeToDeliveryMs' } } }]),
    ]);

    const byStage = {};
    for (const s of stageCounts) byStage[s._id || 'other'] = s.count;
    const byStageRevenue = {};
    for (const s of stageRevenue) byStageRevenue[s._id || 'other'] = Math.round(s.total || 0);

    const byStatus = {};
    for (const s of taskStats) byStatus[s._id] = s.count;
    const totalTasks = Object.values(byStatus).reduce((a, b) => a + b, 0);

    const byType = {};
    for (const t of taskByType) byType[t._id] = { total: t.total, completed: t.completed };

    let onTime = 0;
    for (const t of completedTasks) {
      if (!t.dueAt || (t.completedAt && new Date(t.completedAt) <= new Date(t.dueAt))) onTime++;
    }
    const slaRate = totalTasks > 0 ? Math.round((onTime / (byStatus.completed || 0)) * 100) : 100;

    res.json({
      success: true,
      data: {
        orders: { total: orderStats, revenue: (revenueResult[0] && revenueResult[0].total) || 0, byStage, byStageRevenue },
        tasks: { total: totalTasks, byStatus, byType, slaRate: byStatus.completed ? slaRate : null },
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
    const range = rangeFilter(req);
    const match = { ...range, 'sla.slaStatus': 'breached' };

    const [total, byStage, byZone, amountResult] = await Promise.all([
      CommerceOrder.countDocuments(match),
      CommerceOrder.aggregate([
        { $match: match },
        { $group: { _id: '$workflowStage', count: { $sum: 1 } } },
      ]),
      CommerceOrder.aggregate([
        { $match: match },
        { $group: { _id: '$deliveryZone', count: { $sum: 1 } } },
      ]),
      CommerceOrder.aggregate([
        { $match: match },
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
    const range = rangeFilter(req);
    const outcomes = await CallLog.aggregate([
      { $match: range },
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
    const range = rangeFilter(req);
    const [taskStats, callStats] = await Promise.all([
      Task.aggregate([
        { $match: range },
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
        { $match: range },
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
    const range = rangeFilter(req);
    const [orders, returns] = await Promise.all([
      CommerceOrder.find({ ...range, statusHistory: { $exists: true, $ne: [] } })
        .select('createdAt workflowUpdatedAt deliveredAt statusHistory customer confirmationStatus vendor vendorStatus commerce.orderStatus')
        .lean(),
      OrderReturn.aggregate([
        { $match: range },
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

async function getAnalyticsOperational(req, res, next) {
  try {
    const range = rangeFilter(req);
    const [orders, returns, recovery, callsByDay, callsByType, callsTotal] = await Promise.all([
      CommerceOrder.countDocuments(range),
      OrderReturn.countDocuments(range),
      RecoveryCampaign.aggregate([
        { $match: range },
        {
          $group: {
            _id: null,
            recovered: { $sum: { $cond: [{ $eq: ['$outcome', 'recovered'] }, 1, 0] } },
            lost: { $sum: { $cond: [{ $eq: ['$outcome', 'lost'] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$outcome', 'in-progress'] }, 1, 0] } },
            recoveredRevenue: { $sum: '$recoveredRevenue' },
          },
        },
      ]),
      CallLog.aggregate([
        { $match: range },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      CallLog.aggregate([
        { $match: range },
        { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
        { $group: { _id: { $ifNull: [{ $arrayElemAt: ['$task.type', 0] }, 'unknown'] }, count: { $sum: 1 } } },
      ]),
      CallLog.countDocuments(range),
    ]);

    const rr = recovery[0] || { recovered: 0, lost: 0, inProgress: 0, recoveredRevenue: 0 };
    const decided = rr.recovered + rr.lost;

    res.json({
      success: true,
      data: {
        rates: {
          returnRate: {
            returns,
            orders,
            pct: orders > 0 ? Math.round((returns / orders) * 1000) / 10 : 0,
          },
          recoveryRate: {
            recovered: rr.recovered,
            lost: rr.lost,
            inProgress: rr.inProgress,
            pct: decided > 0 ? Math.round((rr.recovered / decided) * 100) : 0,
            recoveredRevenue: rr.recoveredRevenue || 0,
          },
        },
        calls: {
          total: callsTotal,
          byDay: callsByDay.map((d) => ({ date: d._id, count: d.count })),
          byType: callsByType.reduce((acc, c) => { acc[c._id] = c.count; return acc; }, {}),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// Maps each workflow stage to the task types that process it. Forecast = current
// orders in a stage × historical calls-per-order for that stage's task types.
// ponytail: naive heuristic, not ML — assumes tomorrow mirrors the last 7 days.
// Combined types can double-count an order across types; acceptable for a guide.
const FORECAST_STAGE_TYPES = {
  pending_confirmation: ['customer-confirmation'],
  confirmed_unprocessed: ['vendor-call', 'logistics-followup'],
  collected_by_logistics: ['logistics-followup'],
  shipped: ['logistics-followup'],
  pending_review: ['review-call'],
  cancelled: ['cancelled-recovery'],
  hold: ['review-call'],
  rescheduled: ['vendor-call'],
};

async function getAnalyticsForecast(req, res, next) {
  try {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    const range = { createdAt: { $gte: from, $lte: now } };

    const [callsByType, ordersWithTasks, ordersWithCalls, inventory] = await Promise.all([
      CallLog.aggregate([
        { $match: range },
        { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
        { $group: { _id: { $ifNull: [{ $arrayElemAt: ['$task.type', 0] }, 'unknown'] }, count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: range },
        { $group: { _id: '$type', orders: { $addToSet: '$orderId' } } },
      ]),
      CallLog.aggregate([
        { $match: range },
        { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
        { $group: { _id: { $ifNull: [{ $arrayElemAt: ['$task.type', 0] }, 'unknown'] }, orders: { $addToSet: '$orderId' } } },
      ]),
      CommerceOrder.aggregate([
        { $match: { workflowStage: { $in: Object.keys(FORECAST_STAGE_TYPES) } } },
        { $group: { _id: '$workflowStage', count: { $sum: 1 } } },
      ]),
    ]);

    const calls = {};
    for (const c of callsByType) calls[c._id] = c.count;
    const tasksPerType = {};
    for (const t of ordersWithTasks) tasksPerType[t._id] = t.orders.filter(Boolean).length;
    const callsOrders = {};
    for (const c of ordersWithCalls) callsOrders[c._id] = c.orders.filter(Boolean).length;
    const inventoryCounts = {};
    for (const i of inventory) inventoryCounts[i._id] = i.count;

    const segments = [];
    let predictedCallsNextDay = 0;
    for (const [stage, types] of Object.entries(FORECAST_STAGE_TYPES)) {
      const currentOrders = inventoryCounts[stage] || 0;
      let totalCalls = 0;
      let totalOrdersWithTasks = 0;
      let totalOrdersWithCalls = 0;
      for (const t of types) {
        totalCalls += calls[t] || 0;
        totalOrdersWithTasks += tasksPerType[t] || 0;
        totalOrdersWithCalls += callsOrders[t] || 0;
      }
      const expectedCallsPerOrder = totalOrdersWithTasks > 0 ? totalCalls / totalOrdersWithTasks : null;
      const callProbability = totalOrdersWithTasks > 0 ? Math.round((totalOrdersWithCalls / totalOrdersWithTasks) * 100) : null;
      const predictedCalls = expectedCallsPerOrder != null ? Math.round(currentOrders * expectedCallsPerOrder) : null;
      if (predictedCalls != null) predictedCallsNextDay += predictedCalls;
      segments.push({
        stage,
        types,
        currentOrders,
        callProbability,
        expectedCallsPerOrder: expectedCallsPerOrder != null ? Math.round(expectedCallsPerOrder * 100) / 100 : null,
        lastWindowCalls: totalCalls,
        predictedCalls,
      });
    }

    const totalCallsAll = Object.values(calls).reduce((a, b) => a + b, 0);
    res.json({
      success: true,
      data: {
        asOf: now.toISOString().slice(0, 10),
        window: { from: from.toISOString(), to: now.toISOString(), days: 7 },
        last7dDailyAvg: Math.round(totalCallsAll / 7),
        predictedCallsNextDay,
        segments,
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
  getAnalyticsOperational,
  getAnalyticsForecast,
  rangeFilter,
  bundleOf,
};
