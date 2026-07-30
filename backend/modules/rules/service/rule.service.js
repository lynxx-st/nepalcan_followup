const { TaskRule } = require('../../../database/models');
const taskService = require('../../tasks/service/task.service');
const { NotFoundError } = require('../../../src/middleware/errorHandler');
const { matchesCondition, buildReason } = require('../../../utils/rule-utils');

class RuleService {
  async createRule(data) {
    return TaskRule.create(data);
  }

  async getRuleById(id) {
    const rule = await TaskRule.findById(id);
    if (!rule) throw new NotFoundError('Rule not found');
    return rule;
  }

  async listRules(filters = {}) {
    const { active } = filters;
    const query = {};
    if (typeof active === 'boolean') query.active = active;
    return TaskRule.find(query).sort({ createdAt: -1 });
  }

  async updateRule(id, data) {
    const rule = await TaskRule.findById(id);
    if (!rule) throw new NotFoundError('Rule not found');
    return TaskRule.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteRule(id) {
    const rule = await TaskRule.findById(id);
    if (!rule) throw new NotFoundError('Rule not found');
    return TaskRule.findByIdAndDelete(id);
  }

  async toggleRule(id) {
    const rule = await TaskRule.findById(id);
    if (!rule) throw new NotFoundError('Rule not found');
    return TaskRule.findByIdAndUpdate(id, { active: !rule.active }, { new: true, runValidators: true });
  }

  async evaluateRules(orderData) {
    const rules = await TaskRule.find({ active: true });
    const createdTasks = [];

    for (const rule of rules) {
      if (matchesCondition(orderData, rule.condition)) {
        const taskData = {
          type: rule.taskType,
          priority: rule.priority,
          reason: buildReason(rule, orderData),
          sourceOrder: { orderId: orderData._id || orderData.orderId, orderNumber: orderData.orderNumber },
          slaMinutes: rule.slaMinutes,
          metadata: { ruleId: rule._id, ruleName: rule.name, trigger: rule.trigger, evaluatedAt: new Date().toISOString() },
        };
        if (orderData.assigneeId) {
          taskData.assigneeId = orderData.assigneeId;
          taskData.assigneeName = orderData.assigneeName;
        }
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

module.exports = new RuleService();
