const express = require('express');
const router = express.Router();
const commerceController = require('../controller/commerce.controller');
const { authenticate } = require('../../../src/middleware/auth');
const { internalLimiter } = require('../../../src/middleware/rateLimiter');

router.post('/login', authenticate, commerceController.login);
router.post('/sync', authenticate, internalLimiter, commerceController.syncOrders);
router.post('/sync/all', authenticate, commerceController.syncAll);
router.get('/sync/status', authenticate, commerceController.getSyncStatus);
router.post('/sync/external-non-heavy', authenticate, internalLimiter, commerceController.syncExternalNonHeavy);
router.get('/orders', authenticate, commerceController.getOrders);
router.get('/orders/segment-counts', authenticate, commerceController.getSegmentCounts);
router.get('/reviews', authenticate, commerceController.getReviews);
router.get('/orders/:commerceOrderId', authenticate, commerceController.getOrderById);
router.get('/orders/:commerceOrderId/status', authenticate, commerceController.getOrderStatus);
router.get('/orders/:commerceOrderId/detail', authenticate, commerceController.getOrderDetail);
router.put('/orders/:commerceOrderId/phone', authenticate, commerceController.updateOrderPhone);
router.put('/orders/:commerceOrderId/status', authenticate, commerceController.updateOrderStatus);
router.post('/orders/:commerceOrderId/notes', authenticate, commerceController.addOrderNote);

module.exports = router;