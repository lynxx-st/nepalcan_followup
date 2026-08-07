const settingsService = require('../service/settings.service');

const QUEUE_KEYS = [
  'customer-confirmation',
  'vendor-call',
  'vendor-delay',
  'cancelled-recovery',
  'review-call',
  'escalation',
  'logistics-followup',
];

function defaultQueueVisibility() {
  const map = {};
  for (const key of QUEUE_KEYS) map[key] = true;
  return map;
}

async function getQueueVisibility(req, res, next) {
  try {
    const stored = await settingsService.get('taskQueueVisibility');
    res.json({ success: true, data: { ...defaultQueueVisibility(), ...(stored || {}) } });
  } catch (error) {
    next(error);
  }
}

async function setQueueVisibility(req, res, next) {
  try {
    const map = req.body;
    if (!map || typeof map !== 'object') {
      return res.status(400).json({ success: false, error: { message: 'Visibility map required' } });
    }
    for (const [key, visible] of Object.entries(map)) {
      if (!QUEUE_KEYS.includes(key) || typeof visible !== 'boolean') {
        return res.status(400).json({ success: false, error: { message: `Invalid queue or value: ${key}` } });
      }
    }
    const settings = await settingsService.update({ taskQueueVisibility: map });
    res.json({ success: true, data: { ...defaultQueueVisibility(), ...(settings.taskQueueVisibility || {}) } });
  } catch (error) {
    next(error);
  }
}

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

module.exports = { getSettings, updateSettings, getQueueVisibility, setQueueVisibility };
