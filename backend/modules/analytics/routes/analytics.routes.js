const express = require('express');
const router = express.Router();
const analyticsController = require('../controller/analytics.controller');
const { authenticate, requireAdmin } = require('../../../src/middleware/auth');

router.get('/overview', authenticate, requireAdmin, analyticsController.getAnalyticsOverview);
router.get('/sla-breach', authenticate, requireAdmin, analyticsController.getAnalyticsSlaBreach);
router.get('/call-outcomes', authenticate, requireAdmin, analyticsController.getAnalyticsCallOutcomes);
router.get('/agent-performance', authenticate, requireAdmin, analyticsController.getAnalyticsAgentPerformance);
router.get('/order-lifecycle', authenticate, requireAdmin, analyticsController.getAnalyticsOrderLifecycle);

module.exports = router;
