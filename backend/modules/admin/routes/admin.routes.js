const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin.controller');
const { authenticate, requireSuperAdmin } = require('../../../src/middleware/auth');

router.get('/branches', authenticate, requireSuperAdmin, adminController.listBranches);
router.get('/users', authenticate, requireSuperAdmin, adminController.listUsers);
router.post('/users', authenticate, requireSuperAdmin, adminController.createUser);
router.patch('/users/:id', authenticate, requireSuperAdmin, adminController.updateUser);
router.post('/users/:id/reset-password', authenticate, requireSuperAdmin, adminController.resetPassword);

const seedTaskRules = require('../../rules/seed/seed-rules.service');
const { Task, CommerceOrder } = require('../../../database/models');

router.post('/reset', async (req, res, next) => {
  try {
    const [taskResult, orderResult] = await Promise.all([
      Task.deleteMany({}),
      CommerceOrder.deleteMany({}),
    ]);
    res.json({
      success: true,
      data: {
        tasksDeleted: taskResult.deletedCount,
        ordersDeleted: orderResult.deletedCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/seed-rules', async (req, res, next) => {
  try {
    const count = await seedTaskRules();
    res.json({ success: true, data: { seeded: count } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
