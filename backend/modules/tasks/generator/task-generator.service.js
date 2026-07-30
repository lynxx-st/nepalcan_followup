const { TaskRule, Task } = require('../../../database/models');
const taskService = require('../service/task.service');
const { matchesCondition, buildReason } = require('../../../utils/rule-utils');

function buildCommerceReason(taskType, orderData) {
  const lines = [];

  if (orderData.customerName) {
    lines.push(`Customer: ${orderData.customerName}`);
  }
  if (orderData.orderNumber) {
    lines.push(`Order: ${orderData.orderNumber}`);
  }

  switch (taskType) {
    case 'customer-confirmation':
      lines.push('Pending order needs customer confirmation.');
      if (orderData.paymentMethod === 'Cash') {
        lines.push('Cash payment — follow up urgently.');
      }
      break;
    case 'vendor-call':
      lines.push('Order needs vendor follow-up.');
      break;
    case 'vendor-delay':
      lines.push('Vendor is delayed on order.');
      break;
    case 'cancelled-recovery':
      lines.push('Order was cancelled — recovery attempt needed.');
      break;
    case 'review-call':
      lines.push('Order delivered — customer review required.');
      break;
    case 'escalation':
      lines.push('Order requires escalation.');
      break;
    case 'logistics-followup':
      lines.push('Order processing but not picked up by logistics partner.');
      break;
    default:
      lines.push(`Order ${orderData.newStatus || 'synced'} from commerce system.`);
  }

  if (orderData.unAttendedCount > 0) {
    lines.push(`${orderData.unAttendedCount} unattended count.`);
  }

  return lines.join(' ');
}

class TaskGeneratorService {
  async generateFromOrder(orderData, overrides = {}) {
    const { priorityOverride, slaOverride, taskTypeOverride } = overrides;
    const rules = await TaskRule.find({ active: true });
    const createdTasks = [];

    for (const rule of rules) {
      if (taskTypeOverride && rule.taskType !== taskTypeOverride) continue;

      if (matchesCondition(orderData, rule.condition)) {
        const taskType = taskTypeOverride || rule.taskType;
        const orderId = orderData._id || orderData.orderId;

        const existing = await Task.findOne({
          'sourceOrder.orderId': orderId,
          type: taskType,
          status: { $nin: ['cancelled', 'skipped'] },
        });
        if (existing) continue;

        const taskData = {
          type: taskType,
          priority: priorityOverride || rule.priority,
          reason: buildReason(rule, orderData),
          sourceOrder: {
            orderId,
            orderNumber: orderData.orderNumber,
          },
          slaMinutes: slaOverride || rule.slaMinutes,
          customerPhone: orderData.customerPhone || '',
          vendorPhone: orderData.vendorPhone || '',
          metadata: {
            ruleId: rule._id,
            ruleName: rule.name,
            trigger: rule.trigger,
            evaluatedAt: new Date().toISOString(),
            source: 'commerce-sync',
          },
        };

        if (orderData.customerId) {
          taskData.orderId = orderData.customerId;
          taskData.orderNumber = orderData.orderNumber;
        }

        const task = await taskService.createTask(taskData);
        createdTasks.push(task);
      }
    }

    if (createdTasks.length === 0 && taskTypeOverride) {
      const orderId = orderData._id || orderData.orderId;
      const existing = await Task.findOne({
        'sourceOrder.orderId': orderId,
        type: taskTypeOverride,
        status: { $nin: ['cancelled', 'skipped'] },
      });
      if (!existing) {
        const taskData = {
          type: taskTypeOverride,
          priority: priorityOverride || 'medium',
          reason: buildCommerceReason(taskTypeOverride, orderData),
          sourceOrder: {
            orderId,
            orderNumber: orderData.orderNumber,
          },
          slaMinutes: slaOverride || 0,
          customerPhone: orderData.customerPhone || '',
          vendorPhone: orderData.vendorPhone || '',
          metadata: {
            trigger: 'commerce.order.synced',
            evaluatedAt: new Date().toISOString(),
            source: 'commerce-sync',
          },
        };

        if (orderData.customerId) {
          taskData.orderId = orderData.customerId;
        }

        const task = await taskService.createTask(taskData);
        createdTasks.push(task);
      }
    }

    return createdTasks;
  }

  async generateFromEvent(eventType, orderData) {
    const rules = await TaskRule.find({ trigger: eventType, active: true });
    const createdTasks = [];

    for (const rule of rules) {
      if (matchesCondition(orderData, rule.condition)) {
        const orderId = orderData._id || orderData.orderId;
        const existing = await Task.findOne({
          'sourceOrder.orderId': orderId,
          type: rule.taskType,
          status: { $nin: ['cancelled', 'skipped'] },
        });
        if (existing) continue;

        const taskData = {
          type: rule.taskType,
          priority: rule.priority,
          reason: buildReason(rule, orderData),
          sourceOrder: {
            orderId,
            orderNumber: orderData.orderNumber,
          },
          slaMinutes: rule.slaMinutes,
          customerPhone: orderData.customerPhone || '',
          vendorPhone: orderData.vendorPhone || '',
          metadata: {
            ruleId: rule._id,
            ruleName: rule.name,
            trigger: rule.trigger,
            evaluatedAt: new Date().toISOString(),
          },
        };

        if (orderData.customerId) {
          taskData.orderId = orderData.customerId;
          taskData.orderNumber = orderData.orderNumber;
        }

        const task = await taskService.createTask(taskData);
        createdTasks.push(task);
      }
    }

    return createdTasks;
  }
}

const taskGenerator = new TaskGeneratorService();

module.exports = { taskGenerator, TaskGeneratorService };
