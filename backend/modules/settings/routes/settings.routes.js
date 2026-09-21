const express = require('express');
const router = express.Router();
const settingsController = require('../controller/settings.controller');
const { authenticate, requireAdmin } = require('../../../src/middleware/auth');

router.get('/', authenticate, settingsController.getSettings);
router.put('/', authenticate, requireAdmin, settingsController.updateSettings);
router.get('/queue-visibility', authenticate, settingsController.getQueueVisibility);
router.put('/queue-visibility', authenticate, requireAdmin, settingsController.setQueueVisibility);

module.exports = router;
