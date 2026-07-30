const { CallLog } = require('../../../database/models');

class CallLogService {
  async create(data) {
    return CallLog.create(data);
  }

  async listByAssignee(assigneeId, limit = 20) {
    return CallLog.find({ assignedTo: assigneeId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async listByTask(taskId) {
    return CallLog.find({ taskId }).sort({ createdAt: -1 });
  }
}

module.exports = new CallLogService();