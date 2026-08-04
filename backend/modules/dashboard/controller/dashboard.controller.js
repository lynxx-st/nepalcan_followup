const { Task, CallLog, RecoveryCampaign, CommerceOrder } = require('../../../database/models');

async function getTodayDashboard(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayTasks, totalOrders] = await Promise.all([
      Task.find({
        createdAt: { $gte: today, $lt: tomorrow },
      })
        .sort({ priority: -1, createdAt: 1 })
        .lean(),
      CommerceOrder.countDocuments(),
    ]);

    const summary = {
      date: today.toISOString(),
      total: todayTasks.length,
      totalOrders,
      byType: {},
      byPriority: {},
      overdue: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
    };

    for (const task of todayTasks) {
      summary.byType[task.type] = (summary.byType[task.type] || 0) + 1;
      summary.byPriority[task.priority] = (summary.byPriority[task.priority] || 0) + 1;
      if (task.status === 'overdue' || (task.dueAt && new Date(task.dueAt) < new Date())) {
        summary.overdue++;
      }
      if (task.status === 'pending') summary.pending++;
      if (task.status === 'in-progress') summary.inProgress++;
      if (task.status === 'completed') summary.completed++;
    }

    const overdueTasks = await Task.find({
      status: { $in: ['pending', 'in-progress', 'overdue'] },
      dueAt: { $lt: new Date() },
    })
      .sort({ priority: -1, dueAt: 1 })
      .lean();

    const nextCall = await Task.findOne({
      status: { $in: ['pending', 'overdue'] },
    })
      .sort({ priority: -1, dueAt: 1, createdAt: 1 })
      .lean();

    const callLogs = await CallLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({
      success: true,
      data: {
        today: todayTasks,
        summary,
        overdue: overdueTasks,
        nextCall,
        recentCallLogs: callLogs,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getDashboardStats(req, res, next) {
  try {
    const [totalCompleted, totalOverdue, totalOrders, pendingOrders, cancelledOrders, deliveredOrders] = await Promise.all([
      Task.countDocuments({ status: 'completed' }),
      Task.countDocuments({ status: 'overdue' }),
      CommerceOrder.countDocuments(),
      CommerceOrder.countDocuments({ orderStatus: 'Pending' }),
      CommerceOrder.countDocuments({ orderStatus: 'Cancelled' }),
      CommerceOrder.countDocuments({ orderStatus: 'Delivered' }),
    ]);

    const [recoveryStats, callStats] = await Promise.all([
      RecoveryCampaign.aggregate([
        {
          $group: {
            _id: '$outcome',
            count: { $sum: 1 },
          },
        },
      ]),
      CallLog.aggregate([
        {
          $group: {
            _id: '$outcome',
            count: { $sum: 1 },
            avgDuration: { $avg: '$durationMinutes' },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalCompleted,
        totalOverdue,
        totalOrders,
        pendingOrders,
        cancelledOrders,
        deliveredOrders,
        recoveryByOutcome: recoveryStats,
        callStats,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getDashboardOrders(req, res, next) {
  try {
    const orders = await CommerceOrder.aggregate([
      {
        $match: {
          orderStatus: { $nin: ['Processing'] },
          $nor: [
            { 'customer.confirmationStatus': 'confirmed', 'vendor.vendorStatus': 'accepted' },
          ],
        },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'commerceOrderId',
          foreignField: 'sourceOrder.orderId',
          as: 'tasks',
        },
      },
      {
        $addFields: {
          activeTasks: {
            $filter: {
              input: {
                $sortArray: { input: '$tasks', sortBy: { createdAt: -1 } },
              },
              as: 't',
              cond: { $in: ['$$t.status', ['pending', 'in-progress', 'overdue']] },
            },
          },
        },
      },
      {
        $match: { 'activeTasks.0': { $exists: true } },
      },
      {
        $addFields: {
          taskType: { $arrayElemAt: ['$activeTasks.type', 0] },
          taskPriority: { $arrayElemAt: ['$activeTasks.priority', 0] },
          taskStatus: { $arrayElemAt: ['$activeTasks.status', 0] },
          dueAt: { $arrayElemAt: ['$activeTasks.dueAt', 0] },
          taskId: { $arrayElemAt: ['$activeTasks._id', 0] },
        },
      },
      {
        $match: {
          $or: [
            { dueAt: { $lte: new Date(new Date().setHours(23, 59, 59, 999)) } },
            { dueAt: null },
          ],
        },
      },
      { $sort: { externalUpdatedAt: -1 } },
      {
$project: {
          commerceOrderId: 1,
          orderId: 1,
          customer: 1,
          customerPhone: 1,
          vendor: 1,
          vendorPhone: 1,
          orderStatus: 1,
          paymentStatus: 1,
          paymentMethod: 1,
          totalAmount: 1,
          shippingAmount: 1,
          unAttendedCount: 1,
          originBranch: 1,
          destinationBranch: 1,
          shippingType: 1,
          dispatchMode: 1,
          items: 1,
          createdAt: 1,
          externalUpdatedAt: 1,
          taskType: 1,
          priority: '$taskPriority',
          taskStatus: 1,
          dueAt: 1,
          taskId: 1,
          activeTaskCount: { $size: '$activeTasks' },
        },
      },
    ]);

    const counts = { 'customer-confirmation': 0, 'vendor-call': 0, 'cancelled-recovery': 0, 'review-call': 0, escalation: 0, 'vendor-delay': 0, rescheduled: 0 };
    for (const o of orders) {
      if (counts[o.taskType] !== undefined) counts[o.taskType]++;
    }
    const rescheduledCount = await CommerceOrder.countDocuments({
      $or: [
        { 'customer.confirmationStatus': 'rescheduled' },
        { 'vendor.vendorStatus': 'rescheduled' },
      ],
    });
    counts.rescheduled = rescheduledCount;

    res.json({ success: true, data: { counts, orders } });
  } catch (error) {
    next(error);
  }
}

module.exports = { getTodayDashboard, getDashboardStats, getDashboardOrders };