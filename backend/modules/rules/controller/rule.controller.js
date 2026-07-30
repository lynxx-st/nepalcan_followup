const ruleService = require('../service/rule.service');

async function createRule(req, res, next) {
  try {
    const rule = await ruleService.createRule(req.validatedBody);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
}

async function getRules(req, res, next) {
  try {
    const { active } = req.query;
    const filters = {};
    if (active !== undefined) filters.active = active === 'true';
    const rules = await ruleService.listRules(filters);
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
}

async function getRuleById(req, res, next) {
  try {
    const rule = await ruleService.getRuleById(req.params.id);
    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
}

async function updateRule(req, res, next) {
  try {
    const rule = await ruleService.updateRule(req.params.id, req.validatedBody);
    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
}

async function deleteRule(req, res, next) {
  try {
    await ruleService.deleteRule(req.params.id);
    res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    next(error);
  }
}

async function toggleRule(req, res, next) {
  try {
    const rule = await ruleService.toggleRule(req.params.id);
    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
}

async function evaluateRules(req, res, next) {
  try {
    const orderData = req.body;
    const tasks = await ruleService.evaluateRules(orderData);
    res.json({ success: true, data: { createdTasks: tasks.length, tasks } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRule,
  getRules,
  getRuleById,
  updateRule,
  deleteRule,
  toggleRule,
  evaluateRules,
};