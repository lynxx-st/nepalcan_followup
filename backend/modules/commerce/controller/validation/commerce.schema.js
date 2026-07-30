const Joi = require('joi');

const syncSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().default('Active'),
  unattendedOrders: Joi.string().allow('').default(''),
});

const orderFilterSchema = Joi.object({
  status: Joi.string().valid('Pending', 'Processing', 'Delivered', 'Cancelled', 'Refunded', 'Returned').optional(),
  paymentStatus: Joi.string().valid('Pending', 'Paid', 'Failed', 'Refunded').optional(),
  vendor: Joi.string().optional(),
  customer: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { syncSchema, orderFilterSchema };