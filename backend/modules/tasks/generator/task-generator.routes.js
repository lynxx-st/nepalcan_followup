const express = require('express');
const router = express.Router();
const { taskGenerator } = require('./task-generator.service');
const { authenticate } = require('../../../src/middleware/auth');
const { ROLES, requireRole } = require('../../../src/middleware/rbac');

router.post('/order-event', authenticate, requireRole([ROLES.admin]), async (req, res, next) => {
  try {
    const { eventType, orderData } = req.body;

    if (!eventType || !orderData) {
      return res.status(400).json({
        success: false,
        error: { message: 'eventType and orderData are required' },
      });
    }

    const tasks = await taskGenerator.generateFromEvent(eventType, orderData);

    res.json({
      success: true,
      data: { createdTasks: tasks.length, tasks },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;