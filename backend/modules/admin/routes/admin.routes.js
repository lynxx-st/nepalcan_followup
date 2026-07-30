const express = require('express');
const router = express.Router();
const seedSuperAdmin = require('../seed/seed-admin.service');
const seedTaskRules = require('../../rules/seed/seed-rules.service');
const { Task, CommerceOrder } = require('../../../database/models');

router.post('/seed', async (req, res, next) => {
  try {
    const admin = await seedSuperAdmin();
    res.json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
});

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
