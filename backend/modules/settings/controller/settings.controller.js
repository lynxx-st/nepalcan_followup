const settingsService = require('../service/settings.service');

async function getSettings(req, res, next) {
  try {
    const settings = await settingsService.getAll();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No settings provided' } });
    }
    const settings = await settingsService.update(updates);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}

module.exports = { getSettings, updateSettings };
