const config = require('../../config');
const { Task } = require('../../database/models');
const { commerceSync } = require('../commerce/service/commerce.sync.service');
const logger = require('../../utils/logger');

class SLAScheduler {
  constructor() {
    this.interval = config.slaCheckIntervalMs;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.running) {
      logger.info('SLA scheduler already running');
      return;
    }

    this.running = true;
    logger.info(`SLA scheduler started (interval: ${this.interval}ms)`);

    this.timer = setInterval(async () => {
      try {
        await this.checkOverdue();
      } catch (error) {
        logger.error('SLA scheduler error:', error.message);
      }
    }, this.interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info('SLA scheduler stopped');
  }

  async checkOverdue() {
    const now = new Date();
    const result = await Task.updateMany(
      {
        status: { $in: ['pending', 'in-progress'] },
        dueAt: { $lt: now },
        slaMinutes: { $gt: 0 },
      },
      { $set: { status: 'overdue' } }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Marked ${result.modifiedCount} tasks as overdue`);
    }

    await commerceSync.autoUpdateSlaBreachedOrders();
    await commerceSync.updateSlaStatuses();
  }
}

const scheduler = new SLAScheduler();

module.exports = { scheduler, SLAScheduler };