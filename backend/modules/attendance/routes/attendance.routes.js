const express = require('express');
const router = express.Router();
const attendanceController = require('../controller/attendance.controller');
const { authenticate } = require('../../../src/middleware/auth');

router.get('/status', authenticate, attendanceController.getStatus);
router.post('/check-in', authenticate, attendanceController.checkIn);
router.post('/check-out', authenticate, attendanceController.checkOut);

module.exports = router;
