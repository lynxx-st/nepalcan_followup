const { Setting } = require('../../../database/models');

class SettingsService {
  async getAll() {
    const settings = await Setting.find({}).lean();
    const result = {};
    for (const s of settings) result[s.key] = s.value;
    return result;
  }

  async get(key) {
    const s = await Setting.findOne({ key }).lean();
    return s ? s.value : null;
  }

  async update(updates) {
    if (updates.pendingWorkStartDate !== undefined && !require('../../workspace/work-window').validDate(updates.pendingWorkStartDate)) {
      throw Object.assign(new Error('Choose a valid start date or clear it to show all pending work'), { statusCode: 400, isOperational: true });
    }
    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true });
    }
    return this.getAll();
  }
}

module.exports = new SettingsService();
