const callLogService = require('../service/call-logs.service');

async function createCallLog(req, res, next) {
  try {
    const log = await callLogService.create({
      ...req.validatedBody,
      assignedTo: req.user?.userId,
    });
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
}

async function getMyCallLogs(req, res, next) {
  try {
    const logs = await callLogService.listByAssignee(req.user?.userId, req.query.limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

async function getTaskCallLogs(req, res, next) {
  try {
    const logs = await callLogService.listByTask(req.params.taskId);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

module.exports = { createCallLog, getMyCallLogs, getTaskCallLogs };