const Joi = require('joi');

const createRuleSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().allow('').max(500).optional(),
  trigger: Joi.string()
    .valid(
      'order.created',
      'order.status.changed',
      'order.payment.completed',
      'order.delivered',
      'order.cancelled',
      'customer.confirmed',
      'vendor.accepted',
      'vendor.rejected'
    )
    .required(),
  condition: Joi.object()
    .pattern(/.*/, Joi.any())
    .default({}),
  delayHours: Joi.number().integer().min(0).default(0),
  taskType: Joi.string()
    .valid(
      'customer-confirmation',
      'vendor-call',
      'vendor-delay',
      'cancelled-recovery',
      'review-call',
      'escalation'
    )
    .required(),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low').default('medium'),
  slaMinutes: Joi.number().integer().min(0).default(0),
  active: Joi.boolean().default(true),
});

const updateRuleSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().allow('').max(500).optional(),
  trigger: Joi.string().valid(
    'order.created',
    'order.status.changed',
    'order.payment.completed',
    'order.delivered',
    'order.cancelled',
    'customer.confirmed',
    'vendor.accepted',
    'vendor.rejected'
  ).optional(),
  condition: Joi.object().pattern(/.*/, Joi.any()).optional(),
  delayHours: Joi.number().integer().min(0).optional(),
  taskType: Joi.string()
    .valid(
      'customer-confirmation',
      'vendor-call',
      'vendor-delay',
      'cancelled-recovery',
      'review-call',
      'escalation'
    )
    .optional(),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low').optional(),
  slaMinutes: Joi.number().integer().min(0).optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createRuleSchema, updateRuleSchema };