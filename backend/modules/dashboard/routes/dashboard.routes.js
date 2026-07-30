const express = require('express');
const router = express.Router();
const dashboardController = require('../controller/dashboard.controller');
const { authenticate } = require('../../../src/middleware/auth');

router.get('/today', authenticate, dashboardController.getTodayDashboard);
router.get('/stats', authenticate, dashboardController.getDashboardStats);
router.get('/orders', authenticate, dashboardController.getDashboardOrders);

module.exports = router;