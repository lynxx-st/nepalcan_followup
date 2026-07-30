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
    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true });
    }
    return this.getAll();
  }
}

module.exports = new SettingsService();
