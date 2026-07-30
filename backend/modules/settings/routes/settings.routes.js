const express = require('express');
const router = express.Router();
const settingsController = require('../controller/settings.controller');
const { authenticate } = require('../../../src/middleware/auth');

router.get('/', authenticate, settingsController.getSettings);
router.put('/', authenticate, settingsController.updateSettings);

module.exports = router;
