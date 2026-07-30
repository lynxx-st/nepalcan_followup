const express = require('express');
const router = express.Router();
const commerceController = require('../controller/commerce.controller');
const { internalLimiter } = require('../../../src/middleware/rateLimiter');

router.post('/login', commerceController.login);
router.post('/sync', internalLimiter, commerceController.syncOrders);
router.post('/sync/all', commerceController.syncAll);
router.get('/sync/status', commerceController.getSyncStatus);
router.post('/sync/external-non-heavy', internalLimiter, commerceController.syncExternalNonHeavy);
router.get('/orders', commerceController.getOrders);
router.get('/orders/:commerceOrderId', commerceController.getOrderById);
router.get('/orders/:commerceOrderId/status', commerceController.getOrderStatus);
router.get('/orders/:commerceOrderId/detail', commerceController.getOrderDetail);
router.put('/orders/:commerceOrderId/phone', commerceController.updateOrderPhone);
router.put('/orders/:commerceOrderId/status', commerceController.updateOrderStatus);
router.post('/orders/:commerceOrderId/notes', commerceController.addOrderNote);

module.exports = router;