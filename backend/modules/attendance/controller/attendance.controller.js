const attendanceService = require('../service/attendance.service');

async function getStatus(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const data = await attendanceService.getActiveStatus(userId);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function checkIn(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { notes } = req.body || {};
    const record = await attendanceService.checkIn(userId, notes);
    return res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function checkOut(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { notes } = req.body || {};
    const record = await attendanceService.checkOut(userId, notes);
    return res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStatus,
  checkIn,
  checkOut,
};
