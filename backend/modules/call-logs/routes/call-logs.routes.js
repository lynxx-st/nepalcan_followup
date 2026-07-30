const express = require('express');
const router = express.Router();
const callLogController = require('../controller/call-logs.controller');
const { authenticate } = require('../../../src/middleware/auth');
const { validate } = require('../../../src/middleware/validate');
const Joi = require('joi');

const createCallLogSchema = Joi.object({
  taskId: Joi.string().required(),
  orderId: Joi.string().optional(),
  outcome: Joi.string().valid(
    'customer-confirmed', 'no-answer', 'wrong-number', 'call-later',
    'requested-tomorrow', 'vendor-accepted', 'vendor-rejected',
    'vendor-delayed', 'recovered', 'lost', 'other'
  ).required(),
  durationMinutes: Joi.number().integer().min(0).default(0),
  notes: Joi.string().allow('').optional(),
  metadata: Joi.object().optional(),
});

router.post('/', authenticate, validate(createCallLogSchema), callLogController.createCallLog);
router.get('/', authenticate, callLogController.getMyCallLogs);
router.get('/task/:taskId', authenticate, callLogController.getTaskCallLogs);

module.exports = router;