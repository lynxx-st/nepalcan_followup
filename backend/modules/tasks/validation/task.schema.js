const Joi = require('joi');

const createTaskSchema = Joi.object({
  orderId: Joi.string().optional(),
  orderNumber: Joi.string().optional(),
  type: Joi.string()
    .valid(
      'customer-confirmation',
      'vendor-call',
      'vendor-delay',
      'cancelled-recovery',
      'review-call',
      'escalation'
    )
    .required(),
  assigneeId: Joi.string().optional(),
  assigneeName: Joi.string().allow('').optional(),
  priority: Joi.string()
    .valid('critical', 'high', 'medium', 'low')
    .default('medium'),
  reason: Joi.string().required().min(1).max(500),
  sourceOrder: Joi.object().optional(),
  slaMinutes: Joi.number().integer().min(0).default(0),
  metadata: Joi.object().optional(),
});

const updateTaskSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'in-progress', 'completed', 'skipped', 'overdue')
    .optional(),
  priority: Joi.string()
    .valid('critical', 'high', 'medium', 'low')
    .optional(),
  assigneeId: Joi.string().optional(),
  assigneeName: Joi.string().allow('').optional(),
  reason: Joi.string().min(1).max(500).optional(),
  slaMinutes: Joi.number().integer().min(0).optional(),
  metadata: Joi.object().optional(),
});

const completeTaskSchema = Joi.object({
  completedBy: Joi.string().optional(),
  notes: Joi.string().allow('').optional(),
  durationMinutes: Joi.number().integer().min(0).optional(),
});

const assignTaskSchema = Joi.object({
  assigneeId: Joi.string().required(),
  assigneeName: Joi.string().allow('').optional(),
});

const listTasksSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'in-progress', 'completed', 'skipped', 'overdue')
    .optional(),
  type: Joi.string().optional(),
  priority: Joi.string()
    .valid('critical', 'high', 'medium', 'low')
    .optional(),
  assigneeId: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().default('createdAt'),
  sortDir: Joi.string()
    .valid('asc', 'desc')
    .default('desc'),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  assignTaskSchema,
  listTasksSchema,
};