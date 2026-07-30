const express = require('express');
const router = express.Router();
const ruleController = require('../controller/rule.controller');
const { authenticate } = require('../../../src/middleware/auth');
const { validate } = require('../../../src/middleware/validate');
const { ROLES, requireRole } = require('../../../src/middleware/rbac');
const { createRuleSchema, updateRuleSchema } = require('../validation/rule.schema');

router.get('/', authenticate, ruleController.getRules);
router.get('/:id', authenticate, ruleController.getRuleById);
router.post('/', authenticate, requireRole([ROLES.admin, ROLES.manager]), validate(createRuleSchema), ruleController.createRule);
router.put('/:id', authenticate, requireRole([ROLES.admin, ROLES.manager]), validate(updateRuleSchema), ruleController.updateRule);
router.delete('/:id', authenticate, requireRole([ROLES.admin]), ruleController.deleteRule);
router.patch('/:id/toggle', authenticate, requireRole([ROLES.admin, ROLES.manager]), ruleController.toggleRule);
router.post('/evaluate', authenticate, requireRole([ROLES.admin, ROLES.manager]), ruleController.evaluateRules);

module.exports = router;