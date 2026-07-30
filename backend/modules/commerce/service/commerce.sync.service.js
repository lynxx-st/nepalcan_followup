const axios = require('axios');
const { CommerceOrder, Task } = require('../../../database/models');
const commerceAuth = require('./commerce.auth.service');
const taskGeneratorService = require('../../../modules/tasks/generator/task-generator.service');
const taskService = require('../../../modules/tasks/service/task.service');
const config = require('../../../config');
const logger = require('../../../utils/logger');
const { decodeBase64 } = require('../../../utils/decode');
const settingsService = require('../../../modules/settings/service/settings.service');

const COMMERCE_BASE = config.commerceApiBase;

class CommerceSyncService {
  constructor() {
    this.baseUrl = COMMERCE_BASE;
    this.maxPages = 50;
    this.lastSyncCursor = null;
    this.logisticsFollowupHours = 6;
    this.priorityAmountThreshold = 1000;
    this.slaDefaults = {
      'customer-confirmation': 30,
      'vendor-call': 120,
      'cancelled-recovery': 15,
      'review-call': 1440,
      escalation: 10,
      'logistics-followup': 120,
    };
    this.syncStatus = {
      running: false,
      lastStartedAt: null,
      lastCompletedAt: null,
      totalOrdersSynced: 0,
      totalLogisticsSynced: 0,
      tasksCreated: 0,
      lastError: null,
    };
  }

  getSyncStatus() {
    return { ...this.syncStatus };
  }

  async runSyncAll() {
    if (this.syncStatus.running) return;

    this.syncStatus.running = true;
    this.syncStatus.lastStartedAt = new Date().toISOString();
    this.syncStatus.lastError = null;

    try {
      const orderResult = await this.syncOrders();
      this.syncStatus.totalOrdersSynced = orderResult.totalFetched;

      const logisticsResult = await this.syncExternalNonHeavy();
      this.syncStatus.totalLogisticsSynced = logisticsResult.totalUpdated;
      this.syncStatus.tasksCreated = logisticsResult.tasksCreated;

      this.syncStatus.lastCompletedAt = new Date().toISOString();
    } catch (err) {
      this.syncStatus.lastError = err.message;
      logger.error('Sync all failed', { error: err.message });
    } finally {
      this.syncStatus.running = false;
    }
  }

  async loadSettings() {
    try {
      const settings = await settingsService.getAll();
      if (settings.logisticsFollowupHours) this.logisticsFollowupHours = settings.logisticsFollowupHours;
      if (settings.priorityAmountThreshold) this.priorityAmountThreshold = settings.priorityAmountThreshold;
      if (settings.logisticsFollowupSlaMinutes) this.slaDefaults['logistics-followup'] = settings.logisticsFollowupSlaMinutes;
      if (settings.customerConfirmationSlaMinutes) this.slaDefaults['customer-confirmation'] = settings.customerConfirmationSlaMinutes;
      if (settings.vendorCallSlaMinutes) this.slaDefaults['vendor-call'] = settings.vendorCallSlaMinutes;
      if (settings.cancelledRecoverySlaMinutes) this.slaDefaults['cancelled-recovery'] = settings.cancelledRecoverySlaMinutes;
      if (settings.reviewCallSlaMinutes) this.slaDefaults['review-call'] = settings.reviewCallSlaMinutes;
      if (settings.escalationSlaMinutes) this.slaDefaults.escalation = settings.escalationSlaMinutes;
    } catch (err) {
      logger.warn('Failed to load settings, using defaults', { error: err.message });
    }
  }

  async syncOrders(options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 500, status = 'Active', unattendedOrders = '', updatedAfter } = options;

    logger.info('Starting order sync', { page, limit, status, updatedAfter: updatedAfter || this.lastSyncCursor });

    await this.loadSettings();
    const token = await commerceAuth.getToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let allFetched = [];
    let currentPage = page;
    let hasMore = true;
    let maxPage = null;
    const seenIds = new Set();
    let latestUpdatedAt = null;

    while (hasMore && currentPage <= (maxPage || this.maxPages)) {
      const cursor = updatedAfter || this.lastSyncCursor;
      const url = `${this.baseUrl}/super-admin/list?page=${currentPage}&limit=${limit}&sort=-updatedAt${cursor ? `&updatedAfter=${cursor}` : ''}&unattendedOrders=${unattendedOrders}&status=${status}`;

      try {
        const response = await axios.get(url, { headers, timeout: 15000 });
        const { data, totalItems } = response.data;
        let responseData = data;

        if (!responseData || responseData.length === 0) {
          hasMore = false;
          break;
        }

        if (totalItems && maxPage === null) {
          maxPage = Math.ceil(totalItems / limit);
          logger.info('Total items from API', { totalItems, maxPage, limit });
        }

        const newIds = responseData.map((o) => String(o._id));
        const dupeCount = newIds.filter((id) => seenIds.has(id)).length;
        if (dupeCount > newIds.length * 0.5) {
          logger.info('Sync stopping — detected repeated page (duplicate IDs)', {
            page: currentPage, dupeCount, totalInPage: newIds.length,
          });
          break;
        }
        newIds.forEach((id) => seenIds.add(id));

        const orders = await this.processOrders(responseData);
        allFetched.push(...orders);

        for (const o of orders) {
          if (o.externalUpdatedAt && (!latestUpdatedAt || new Date(o.externalUpdatedAt) > new Date(latestUpdatedAt))) {
            latestUpdatedAt = o.externalUpdatedAt;
          }
        }

        logger.info(`Synced page ${currentPage}: ${orders.length} orders processed`);

        if (orders.length < limit) {
          hasMore = false;
        }

        currentPage++;
      } catch (error) {
        logger.error('Sync failed on page', { page: currentPage, message: error.message });

        if (error.response && error.response.status === 401) {
          await commerceAuth.login();
          continue;
        }

        hasMore = false;
      }
    }

    logger.info('Order sync complete', { totalFetched: allFetched.length, totalPages: currentPage - 1, durationMs: Date.now() - startTime });

    if (latestUpdatedAt) {
      this.lastSyncCursor = typeof latestUpdatedAt === 'string' ? latestUpdatedAt : new Date(latestUpdatedAt).toISOString();
    }

    return {
      totalFetched: allFetched.length,
      totalPages: currentPage - 1,
      orders: allFetched,
    };
  }

  async processOrders(orders) {
    const results = [];
    const changedOrders = [];

    const orderIds = orders.map(o => o._id);
    const existingDocs = await CommerceOrder.find({ commerceOrderId: { $in: orderIds } }).lean();
    const existingMap = {};
    for (const doc of existingDocs) {
      existingMap[doc.commerceOrderId] = doc;
    }

    for (const order of orders) {
      const existing = existingMap[order._id];

      if (existing) {
        const normalized = this.normalizeOrder(order);
        const changes = this.diffOrder(existing, normalized);

        const updated = await CommerceOrder.findByIdAndUpdate(
          existing._id,
          { ...normalized, lastSyncedAt: new Date(), synced: true, lastSyncChanges: changes.summary },
          { new: true }
        );

        if (changes.any) {
          logger.info('Order updated', { orderId: order.orderId, changes: changes.fields });
          changedOrders.push({ orderId: order.orderId, changes: changes.fields });
        }

        if (changes.statusChanged) {
          await Task.updateMany(
            { 'sourceOrder.orderId': order._id, status: { $in: ['pending', 'in-progress'] } },
            { status: 'cancelled', completedAt: new Date() }
          );
          await this.generateTasksForOrder(updated);
        }

        results.push(updated);
      } else {
        const created = await CommerceOrder.create(this.normalizeOrder(order));
        await this.generateTasksForOrder(created);
        results.push(created);
      }
    }

    const newOrders = results.filter(r => r.createdAt > new Date(Date.now() - 60000));
    if (newOrders.length > 0 && global.io) {
      global.io.emit('new-orders', { count: newOrders.length });
    }
    if (changedOrders.length > 0 && global.io) {
      global.io.emit('order-updates', { count: changedOrders.length, orders: changedOrders });
    }
    return results;
  }

  diffOrder(existing, normalized) {
    const tracked = ['orderStatus', 'paymentStatus', 'cancelledReason', 'cancelledBy', 'unAttendedCount', 'totalAmount'];
    const fields = [];
    let statusChanged = false;

    for (const key of tracked) {
      const oldVal = existing[key];
      const newVal = normalized[key];
      if (oldVal !== newVal && newVal !== undefined) {
        fields.push({ field: key, from: oldVal, to: newVal });
        if (key === 'orderStatus') statusChanged = true;
      }
    }

    return {
      any: fields.length > 0,
      fields,
      statusChanged,
      summary: fields.map(f => `${f.field}: ${f.from} → ${f.to}`).join(', '),
    };
  }

  normalizeOrder(order) {
    const customerPhone = decodeBase64(order.customerPhone || order.phone || order.mobile || '');
    const vendorPhone = decodeBase64(order.vendorPhone || order.vendor?.phone || '');
    const customerName = decodeBase64(order.customerProfile?.name || order.customer || '');
    const vendorName = decodeBase64(order.vendor?.name || order.vendor || '');

    return {
      commerceOrderId: order._id,
      orderId: order.orderId,
      customer: customerName,
      customerPhone,
      vendor: vendorName,
      vendorPhone,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      logisticsOrderId: order.logisticsOrderId,
      externalLogisticsOrderId: order.externalLogisticsOrderId,
      externalHeavyLogisticsId: order.externalHeavyLogisticsId,
      externalNonHeavyLogisticsId: order.externalNonHeavyLogisticsId,
      pickupTicketId: order.pickupTicketId,
      totalAmount: order.totalAmount,
      shippingAmount: order.shippingAmount,
      unAttendedCount: order.unAttendedCount,
      additionalPickupTimeWindow: order.additionalPickupTimeWindow,
      coupon: order.coupon,
      addedUser: order.addedUser,
      items: order.items || [],
      externalUpdatedAt: order.updatedAt || order.updated_at || order.lastUpdatedAt,
    };
  }

  async generateTasksForOrder(order) {
    const { orderStatus, paymentStatus, paymentMethod, unAttendedCount } = order;

    const priorityMap = this.getPriorityForOrder(order);

    const orderData = {
      _id: order.commerceOrderId,
      orderId: order.commerceOrderId,
      orderNumber: order.orderId,
      customerName: order.customer,
      customerPhone: order.customerPhone || '',
      vendorName: order.vendor,
      vendorPhone: order.vendorPhone || '',
      customerId: order._id,
      newStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      unAttendedCount: order.unAttendedCount,
      assigneeId: null,
      assigneeName: null,
    };

    try {
      await taskGeneratorService.taskGenerator.generateFromOrder(orderData, {
        priorityOverride: priorityMap.priority,
        slaOverride: priorityMap.slaMinutes,
        taskTypeOverride: priorityMap.taskType,
      });
      logger.info('Tasks generated for order', { orderId: order.orderId });
    } catch (error) {
      logger.error('Failed to generate tasks for order', {
        orderId: order.orderId,
        message: error.message,
      });
    }
  }

  getPriorityForOrder(order) {
    const { orderStatus, paymentStatus, paymentMethod, unAttendedCount, totalAmount } = order;
    let priority = 'medium';
    let taskType = 'customer-confirmation';
    let slaMinutes = this.slaDefaults['customer-confirmation'];

    switch (orderStatus) {
      case 'Pending':
        if (paymentMethod === 'Cash' && paymentStatus === 'Pending') {
          priority = 'critical';
          taskType = 'customer-confirmation';
        } else if (paymentStatus === 'Pending') {
          priority = 'high';
          taskType = 'customer-confirmation';
        } else if (paymentStatus === 'Paid') {
          priority = 'medium';
          taskType = 'vendor-call';
        } else {
          priority = 'high';
          taskType = 'customer-confirmation';
        }
        break;

      case 'Processing':
        if (paymentStatus === 'Paid') {
          priority = 'medium';
          taskType = 'vendor-call';
        } else {
          priority = 'high';
          taskType = 'customer-confirmation';
        }
        break;

      case 'Cancelled':
        priority = 'critical';
        taskType = 'cancelled-recovery';
        break;

      case 'Delivered':
      case 'Shipped':
      case 'Return Delivered':
        priority = 'low';
        taskType = 'review-call';
        break;

      default:
        priority = 'medium';
        taskType = 'customer-confirmation';
    }

    slaMinutes = this.slaDefaults[taskType] || 60;

    if (unAttendedCount > 0) {
      if (priority === 'low') priority = 'medium';
      else if (priority === 'medium') priority = 'high';
      else if (priority === 'high') priority = 'critical';
    }

    if (totalAmount > this.priorityAmountThreshold && priority !== 'critical') {
      const levels = ['low', 'medium', 'high', 'critical'];
      const idx = levels.indexOf(priority);
      if (idx < levels.length - 1) priority = levels[idx + 1];
    }

    return { priority, slaMinutes, taskType };
  }

  async getOrderStatus(commerceOrderId) {
    const order = await CommerceOrder.findOne({ commerceOrderId });
    return order;
  }

  async getOrders(filters = {}) {
    const { status, paymentStatus, vendor, customer, page = 1, limit = 20 } = filters;
    const query = {};

    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (vendor) query.vendor = new RegExp(vendor, 'i');
    if (customer) query.customer = new RegExp(customer, 'i');

    const skip = (page - 1) * limit;

    let orders = await CommerceOrder.find(query)
      .sort({ externalUpdatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const orderIds = orders.map(o => o.commerceOrderId);
    const tasks = await Task.find({
      'sourceOrder.orderId': { $in: orderIds },
      status: { $in: ['pending', 'in-progress', 'overdue'] },
    }).lean();
    const taskMap = {};
    for (const t of tasks) {
      taskMap[t.sourceOrder?.orderId] = { taskId: t._id, taskType: t.type };
    }
    orders = orders.map(o => ({
      ...o,
      taskId: taskMap[o.commerceOrderId]?.taskId || null,
      activeTaskType: taskMap[o.commerceOrderId]?.taskType || null,
    }));

    const total = await CommerceOrder.countDocuments(query);
    return { orders, total, page, limit };
  }

  async syncExternalNonHeavy(options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 500 } = options;
    logger.info('Starting external non-heavy logistics sync', { page, limit });

    await this.loadSettings();
    const token = await commerceAuth.getToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let currentPage = page;
    let hasMore = true;
    let totalUpdated = 0;
    let tasksCreated = 0;
    const seenIds = new Set();
    while (hasMore && currentPage <= this.maxPages) {
      const url = `${this.baseUrl}/external-non-heavy?status=Active&page=${currentPage}&limit=${limit}`;

      try {
        const response = await axios.get(url, { headers, timeout: 15000 });
        const items = response.data.data || [];

        if (!items || items.length === 0) {
          hasMore = false;
          break;
        }

        const newIds = items.map((o) => String(o._id));
        const dupeCount = newIds.filter((id) => seenIds.has(id)).length;
        if (dupeCount > newIds.length * 0.5) {
          logger.info('Logistics sync stopping — detected repeated page', { page: currentPage });
          break;
        }
        newIds.forEach((id) => seenIds.add(id));

        const itemIds = items.map(o => o._id);
        const existingOrders = await CommerceOrder.find({ commerceOrderId: { $in: itemIds } }).lean();
        const existingSet = new Set(existingOrders.map(o => o.commerceOrderId));

        const bulkOps = [];
        for (const item of items) {
          if (!existingSet.has(item._id)) continue;
          totalUpdated++;

          bulkOps.push({
            updateOne: {
              filter: { commerceOrderId: item._id },
              update: {
                $set: {
                  externalDeliveryStatus: item.externalDeliveryStatus || null,
                  externalDeliveryEvent: item.externalDeliveryEvent || null,
                  orderType: item.orderType || null,
                  branch: item.branch || null,
                  sender: item.sender || null,
                  receiver: item.receiver || null,
                  destinationBranch: item.destinationBranch || null,
                  shippingType: item.shippingType || null,
                  dispatchMode: item.dispatchMode || null,
                  externalNonHeavyLogisticsId: item.externalNonHeavyLogisticsId || null,
                  pickupTicketId: item.pickupTicketId || null,
                  externalUpdatedAt: item.updatedAt || item.updated_at || null,
                  lastSyncedAt: new Date(),
                },
              },
            },
          });

          const notPickedUp = !item.externalDeliveryEvent || item.externalDeliveryEvent === 'dropoff_collected';
          if (item.orderStatus === 'Processing' && notPickedUp) {
            const createdAt = new Date(item.createdAt || item.updatedAt);
            const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

            if (hoursSinceCreation >= this.logisticsFollowupHours) {
              const existing = await Task.findOne({
                'sourceOrder.orderId': item._id,
                type: 'logistics-followup',
                status: { $nin: ['cancelled', 'skipped'] },
              });

              if (!existing) {
                const destBranch = item.destinationBranch?.name || 'N/A';
                const logId = item.externalNonHeavyLogisticsId || 'N/A';
                await taskService.createTask({
                  type: 'logistics-followup',
                  priority: 'high',
                  reason: `Order ${item.orderId} processing but not picked up by logistics in ${Math.round(hoursSinceCreation * 10) / 10}h. Dest: ${destBranch}. LogID: ${logId}.`,
                  sourceOrder: {
                    orderId: item._id,
                    orderNumber: item.orderId,
                  },
                  slaMinutes: 120,
                  customerPhone: item.sender?.phone || '',
                  vendorPhone: item.vendorDetails?.phone || '',
                  metadata: {
                    trigger: 'external-logistics.synced',
                    evaluatedAt: new Date().toISOString(),
                    source: 'logistics-sync',
                    logisticsInfo: {
                      externalNonHeavyLogisticsId: logId,
                      pickupTicketId: item.pickupTicketId,
                      externalDeliveryStatus: item.externalDeliveryStatus,
                      externalDeliveryEvent: item.externalDeliveryEvent,
                      destinationBranch: destBranch,
                    },
                  },
                });
                tasksCreated++;
              }
            }
          }
        }

        if (bulkOps.length > 0) {
          await CommerceOrder.bulkWrite(bulkOps);
        }

        if (items.length < limit) {
          hasMore = false;
        }

        currentPage++;
      } catch (error) {
        logger.error('External non-heavy sync failed on page', {
          page: currentPage,
          message: error.message,
        });

        if (error.response && error.response.status === 401) {
          await commerceAuth.login();
          continue;
        }

        hasMore = false;
      }
    }

    logger.info('External non-heavy logistics sync complete', {
      totalPages: currentPage - 1,
      totalUpdated,
      tasksCreated,
      durationMs: Date.now() - startTime,
    });

    return { totalUpdated, totalPages: currentPage - 1, tasksCreated };
  }
}

const commerceSync = new CommerceSyncService();

module.exports = { commerceSync, CommerceSyncService };