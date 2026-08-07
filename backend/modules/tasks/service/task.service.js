const { Task, TaskTimeline, CommerceOrder, OrderReturn } = require('../../../database/models');
const { NotFoundError } = require('../../../src/middleware/errorHandler');
const { scoreNextTask } = require('../../../utils/next-call-scorer');

const PRIORITY_SCORE = { critical: 4, high: 3, medium: 2, low: 1 };

function priorityScoreSwitch() {
  return {
    $switch: {
      branches: [
        { case: { $eq: ['$priority', 'critical'] }, then: 100 },
        { case: { $eq: ['$priority', 'high'] }, then: 80 },
        { case: { $eq: ['$priority', 'medium'] }, then: 50 },
        { case: { $eq: ['$priority', 'low'] }, then: 20 },
      ],
      default: 0,
    },
  };
}

class TaskService {
  // ponytail: orders confirmed by both customer+vendor are "done", and
  // rescheduled orders live in the rescheduled list — neither should surface
  // in actionable queues. Upgrade: single $lookup aggregation if task volume
  // ever makes two queries expensive.
  async getClosedOrderIds() {
    const orders = await CommerceOrder.find({
      $or: [
        { 'customer.confirmationStatus': 'confirmed', 'vendor.vendorStatus': 'accepted' },
        { 'customer.confirmationStatus': 'rescheduled' },
        { 'vendor.vendorStatus': 'rescheduled' },
      ],
    }).select('commerceOrderId').lean();
    return orders.map((o) => o.commerceOrderId);
  }

  async createTask(data) {
    const task = await Task.create(data);
    await this.addTimeline(task._id, 'system', `Task created: ${task.type}`);
    return task;
  }

  async getTaskById(id) {
    const task = await Task.findById(id).populate('assigneeId', 'name email');
    if (!task) throw new NotFoundError('Task not found');
    return task;
  }

  async getTaskWithTimeline(id) {
    const task = await Task.findById(id)
      .populate('assigneeId', 'name email')
      .populate('completedBy', 'name email');
    if (!task) throw new NotFoundError('Task not found');
    const timeline = await TaskTimeline.find({ taskId: id }).sort({ createdAt: -1 });
    return { ...task.toObject(), timeline };
  }

  async listTasks(filters) {
    const { status, type, priority, assigneeId, page, limit, sortBy, sortDir } = filters;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (assigneeId) query.assigneeId = assigneeId;
    const closed = await this.getClosedOrderIds();
    if (closed.length) query['sourceOrder.orderId'] = { $nin: closed };
    const skip = (page - 1) * limit;
    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate('assigneeId', 'name email')
        .sort({ [sortBy]: sortDir === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Task.countDocuments(query),
    ]);
    return { tasks, total, page, limit };
  }

  async getTasksByOrder(orderId, statusFilter) {
    const query = { 'sourceOrder.orderId': orderId };
    if (statusFilter) query.status = statusFilter;
    return Task.find(query).populate('assigneeId', 'name email').sort({ createdAt: -1 });
  }

  async assignTask(id, data) {
    const task = await Task.findById(id);
    if (!task) throw new NotFoundError('Task not found');
    const updated = await Task.findByIdAndUpdate(id, {
      assigneeId: data.assigneeId,
      assigneeName: data.assigneeName || '',
    }, { new: true, runValidators: true });
    await this.addTimeline(id, 'admin', `Assigned to ${data.assigneeName || data.assigneeId}`);
    return updated;
  }

  async completeTask(id, data) {
    const task = await Task.findById(id);
    if (!task) throw new NotFoundError('Task not found');
    const updated = await Task.findByIdAndUpdate(id, {
      status: 'completed',
      completedAt: new Date(),
      completedBy: data.completedBy || null,
    }, { new: true, runValidators: true });
    await this.addTimeline(id, 'staff',
      data.notes || `Task marked as completed${data.durationMinutes ? ` in ${data.durationMinutes} min` : ''}`
    );
    const outcome = data.notes || '';
    const orderId = task.sourceOrder?.orderId;
    if (orderId) {
      const order = await CommerceOrder.findOne({ commerceOrderId: orderId });
      const orderData = {
        _id: orderId, orderId, orderNumber: task.sourceOrder?.orderNumber,
        customerName: order?.customer || '', newStatus: order?.orderStatus || '',
        paymentMethod: order?.paymentMethod || '',
      };
      const taskGenerator = require('../generator/task-generator.service').taskGenerator;
      if (task.type === 'customer-confirmation' && outcome === 'customer-confirmed') {
        await taskGenerator.generateFromOrder(orderData, { taskTypeOverride: 'vendor-call', priorityOverride: 'medium', slaOverride: 120 });
      } else if (task.type === 'vendor-call' && outcome === 'vendor-rejected') {
        await taskGenerator.generateFromOrder(orderData, { taskTypeOverride: 'escalation', priorityOverride: 'critical', slaOverride: 60 });
      } else if (task.type === 'vendor-call' && outcome === 'vendor-delayed') {
        await taskGenerator.generateFromOrder(orderData, { taskTypeOverride: 'vendor-delay', priorityOverride: 'high', slaOverride: 240 });
      }
    }
    return updated;
  }

  async skipTask(id, data) {
    const updated = await Task.findByIdAndUpdate(id, {
      status: 'skipped',
      $set: {
        'metadata.skippedBy': data?.skippedBy || 'staff',
        'metadata.skippedAt': new Date().toISOString(),
      },
    }, { new: true, runValidators: true });
    await this.addTimeline(id, 'staff', data?.notes || 'Task skipped');
    return updated;
  }

  async updateTask(id, data) {
    return Task.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteTask(id) {
    const task = await Task.findById(id);
    if (!task) throw new NotFoundError('Task not found');
    return Task.findByIdAndDelete(id);
  }

  async scheduleTask(id, scheduledDate, userId) {
    const task = await Task.findById(id);
    if (!task) throw new NotFoundError('Task not found');

    const dueAt = new Date(scheduledDate);
    dueAt.setHours(9, 0, 0, 0);

    await this.addTimeline(id, 'staff', `Task rescheduled to ${dueAt.toLocaleDateString()} by ${userId || 'staff'}`);

    await Task.findByIdAndUpdate(id, {
      status: 'completed',
      completedAt: new Date(),
      completedBy: userId || null,
    });

    const newTask = await Task.create({
      type: task.type,
      priority: task.priority,
      reason: `${task.reason} (Rescheduled from ${new Date(task.createdAt).toLocaleDateString()})`,
      sourceOrder: task.sourceOrder,
      orderId: task.orderId,
      orderNumber: task.orderNumber,
      slaMinutes: task.slaMinutes,
      dueAt,
      scheduledAt: dueAt,
      customerPhone: task.customerPhone,
      vendorPhone: task.vendorPhone,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      metadata: {
        ...task.metadata,
        rescheduledFrom: task._id,
        rescheduledAt: new Date().toISOString(),
      },
    });

    await this.addTimeline(newTask._id, 'system', `Task rescheduled from ${new Date(task.createdAt).toLocaleDateString()}, due ${dueAt.toLocaleDateString()}`);
    return newTask;
  }

  async getNextTask(assigneeId) {
    const assigneeMatch = assigneeId
      ? [{ assigneeId }, { assigneeId: null }, { assigneeId: { $exists: false } }]
      : [{ assigneeId: null }, { assigneeId: { $exists: false } }];
    const closed = await this.getClosedOrderIds();
    const orderMatch = closed.length
      ? { 'sourceOrder.orderId': { $nin: closed } }
      : {};
    const [task] = await Task.aggregate([
      {
        $match: {
          $or: assigneeMatch,
          status: { $in: ['pending', 'overdue'] },
          ...orderMatch,
        },
      },
      { $addFields: { priorityScore: priorityScoreSwitch() } },
      { $sort: { priorityScore: -1, dueAt: 1, createdAt: 1 } },
      { $limit: 1 },
    ]);
    return task || null;
  }

  async getNextAdvanced(assigneeId, limit = 1) {
    const assigneeMatch = assigneeId
      ? [{ assigneeId }, { assigneeId: null }, { assigneeId: { $exists: false } }]
      : [{ assigneeId: null }, { assigneeId: { $exists: false } }];
    const closed = await this.getClosedOrderIds();
    const orderMatch = closed.length
      ? { 'sourceOrder.orderId': { $nin: closed } }
      : {};
    const candidates = await Task.find({
      $or: assigneeMatch,
      status: { $in: ['pending', 'overdue'] },
      ...orderMatch,
    }).lean();

    if (candidates.length === 0) return { task: null, score: 0, factors: {} };

    const orderIds = [...new Set(candidates.map((t) => String(t.orderId || t.sourceOrder?.orderId)).filter(Boolean))];
    const [orders, returns, loadRows] = await Promise.all([
      orderIds.length ? CommerceOrder.find({ commerceOrderId: { $in: orderIds } }).lean() : [],
      orderIds.length ? OrderReturn.find({ commerceOrderId: { $in: orderIds }, workflowStage: { $ne: 'completed' } }).lean() : [],
      Task.aggregate([
        { $match: { status: { $in: ['pending', 'in-progress', 'overdue'] }, assigneeId: { $ne: null } } },
        { $group: { _id: '$assigneeId', n: { $sum: 1 } } },
      ]),
    ]);
    const ordersById = new Map(orders.map((o) => [String(o.commerceOrderId), o]));
    const returnsByOrderId = new Set(returns.map((r) => String(r.commerceOrderId)));
    const agentLoads = new Map(loadRows.map((l) => [String(l._id), l.n]));
    const now = Date.now();

    const scored = candidates.map((task) => ({
      task,
      ...scoreNextTask(task, { ordersById, returnsByOrderId, agentLoads, now }),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit)[0];
  }

  async getTodaySummary(assigneeId) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const assigneeMatch = assigneeId
      ? {
          $or: [
            { assigneeId },
            { assigneeId: null },
            { assigneeId: { $exists: false } },
          ],
        }
      : { $or: [{ assigneeId: null }, { assigneeId: { $exists: false } }] };
    const tasks = await Task.find({
      ...assigneeMatch,
      status: { $in: ['pending', 'in-progress', 'overdue'] },
      createdAt: { $gte: today, $lt: tomorrow },
    }).populate('assigneeId', 'name email');
    const summary = { date: today.toISOString(), total: tasks.length, byType: {}, byPriority: {}, overdue: 0 };
    for (const task of tasks) {
      summary.byType[task.type] = (summary.byType[task.type] || 0) + 1;
      summary.byPriority[task.priority] = (summary.byPriority[task.priority] || 0) + 1;
      if (task.status === 'overdue' || (task.dueAt && task.dueAt < new Date())) summary.overdue++;
    }
    return summary;
  }

  async getTasksByTypeAndStatus(type, status) {
    return Task.aggregate([
      { $match: { type, status } },
      { $addFields: { priorityScore: priorityScoreSwitch() } },
      { $sort: { priorityScore: -1, createdAt: 1 } },
    ]);
  }

  async markOverdue() {
    const now = new Date();
    const result = await Task.updateMany(
      { status: { $in: ['pending', 'in-progress'] }, dueAt: { $lt: now }, slaMinutes: { $gt: 0 } },
      { $set: { status: 'overdue' } }
    );
    return result.modifiedCount;
  }

  async addTimeline(taskId, actor, note, metadata = {}) {
    return TaskTimeline.create({ taskId, status: actor === 'system' ? 'created' : 'updated', actor, note, metadata });
  }

  calculatePriorityScore(task) {
    const base = PRIORITY_SCORE[task.priority] || 2;
    const overdueBonus = task.status === 'overdue' ? 10 : 0;
    const ageBonus = Math.min(Math.floor((Date.now() - task.createdAt.getTime()) / (60 * 60 * 1000)), 5);
    return base + overdueBonus + ageBonus;
  }
}

module.exports = new TaskService();
