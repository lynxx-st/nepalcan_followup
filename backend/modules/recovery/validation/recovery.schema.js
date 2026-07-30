const Joi = require('joi');

const createRecoverySchema = Joi.object({
  orderId: Joi.string().required(),
  orderNumber: Joi.string().optional(),
  cancellationReason: Joi.string().required(),
  steps: Joi.array()
    .items(
      Joi.object({
        action: Joi.string().required(),
        note: Joi.string().allow('').optional(),
      })
    )
    .default([]),
  assignedTo: Joi.string().optional(),
});

const updateRecoverySchema = Joi.object({
  outcome: Joi.string().valid('recovered', 'lost', 'in-progress').optional(),
  recoveredRevenue: Joi.number().min(0).optional(),
  stepIndex: Joi.number().integer().min(0).optional(),
  stepOutcome: Joi.string()
    .valid('success', 'failed', 'pending', 'skipped')
    .optional(),
  stepNote: Joi.string().allow('').optional(),
});

module.exports = { createRecoverySchema, updateRecoverySchema };