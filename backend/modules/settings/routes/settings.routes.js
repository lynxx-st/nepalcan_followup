const express = require('express');
const router = express.Router();
const settingsController = require('../controller/settings.controller');
const { authenticate } = require('../../../src/middleware/auth');

router.get('/', authenticate, settingsController.getSettings);
router.put('/', authenticate, settingsController.updateSettings);
router.get('/queue-visibility', authenticate, settingsController.getQueueVisibility);
router.put('/queue-visibility', authenticate, settingsController.setQueueVisibility);

module.exports = router;
