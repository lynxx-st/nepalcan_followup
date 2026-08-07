const { UserAttendance, Admin } = require('../../../database/models');

async function getActiveStatus(userId) {
  const activeRecord = await UserAttendance.findOne({
    userId,
    status: 'checked-in',
  }).sort({ checkInTime: -1 });

  if (!activeRecord) {
    const lastRecord = await UserAttendance.findOne({ userId })
      .sort({ createdAt: -1 })
      .lean();
    return {
      isCheckedIn: false,
      activeShift: null,
      lastShift: lastRecord || null,
    };
  }

  const durationMinutes = Math.floor(
    (Date.now() - new Date(activeRecord.checkInTime).getTime()) / 60000
  );

  return {
    isCheckedIn: true,
    activeShift: {
      ...activeRecord.toObject(),
      currentDurationMinutes: durationMinutes,
    },
  };
}

async function checkIn(userId, notes = '') {
  let activeRecord = await UserAttendance.findOne({
    userId,
    status: 'checked-in',
  });

  if (activeRecord) {
    return activeRecord;
  }

  let userObj = null;
  try {
    userObj = await Admin.findById(userId);
  } catch {}

  activeRecord = await UserAttendance.create({
    userId,
    userName: userObj ? userObj.name : 'Staff Member',
    userEmail: userObj ? userObj.email : '',
    checkInTime: new Date(),
    status: 'checked-in',
    notes,
  });

  return activeRecord;
}

async function checkOut(userId, notes = '') {
  const activeRecord = await UserAttendance.findOne({
    userId,
    status: 'checked-in',
  });

  if (!activeRecord) {
    throw new Error('No active check-in found to check out from.');
  }

  const checkOutTime = new Date();
  const durationMinutes = Math.max(
    1,
    Math.floor((checkOutTime.getTime() - new Date(activeRecord.checkInTime).getTime()) / 60000)
  );

  activeRecord.checkOutTime = checkOutTime;
  activeRecord.status = 'checked-out';
  activeRecord.durationMinutes = durationMinutes;
  if (notes) activeRecord.notes = notes;

  await activeRecord.save();
  return activeRecord;
}

module.exports = {
  getActiveStatus,
  checkIn,
  checkOut,
};
