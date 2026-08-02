const axios = require('axios');
const { CommerceOrder, Task } = require('../../../database/models');
const commerceAuth = require('./commerce.auth.service');
const taskGeneratorService = require('../../../modules/tasks/generator/task-generator.service');
const taskService = require('../../../modules/tasks/service/task.service');
const config = require('../../../config');
const logger = require('../../../utils/logger');
const { decodeBase64 } = require('../../../utils/decode');
const settingsService = require('../../../modules/settings/service/settings.service');
const recoveryService = require('../../../modules/recovery/service/recovery.service');

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
        const normalized = this.normalizeOrder(order, existing);
        const changes = this.diffOrder(existing, normalized);

        if (!changes.any) {
          results.push(existing);
          continue;
        }

        const historyEntries = changes.fields.map(field => ({
          field: field.field,
          from: field.from,
          to: field.to,
          actor: null,
          actorName: 'sync',
          changedAt: new Date(),
          source: 'sync',
          comment: `Sync update: ${field.field} changed from ${field.from} to ${field.to}`,
          metadata: { trigger: 'sync', syncChanges: changes.summary },
        }));

        const $set = {};
        for (const f of changes.fields) {
          $set[f.field] = this.getNested(normalized, f.field);
        }
        $set.lastSyncedAt = new Date();
        $set.synced = true;
        $set.lastSyncChanges = changes.summary;

        const update = { $set };
        if (historyEntries.length > 0) {
          update.$push = { statusHistory: { $each: historyEntries } };
        }

        const updated = await CommerceOrder.findByIdAndUpdate(
          existing._id,
          update,
          { new: true }
        );

        logger.info('Order updated', { orderId: order.orderId, changes: changes.fields });
        changedOrders.push({ orderId: order.orderId, changes: changes.fields });

        if (changes.statusChanged) {
          await Task.updateMany(
            { 'sourceOrder.orderId': order._id, status: { $in: ['pending', 'in-progress'] } },
            { status: 'cancelled', completedAt: new Date() }
          );
          await this.generateTasksForOrder(updated);

          const prevStatus = existing.commerce?.orderStatus || existing.orderStatus;
          const nextStatus = normalized.commerce?.orderStatus;
          if (nextStatus && prevStatus !== nextStatus) {
            const isCancel = nextStatus === 'Cancelled';
            const wasCancel = prevStatus === 'Cancelled';
            if (isCancel || wasCancel) {
              recoveryService.recordOrderRecovery({
                order: updated,
                isCancel,
                fromStatus: prevStatus,
                toStatus: nextStatus,
              }).catch((err) => logger.error('Recovery record failed', { orderId: order.orderId, message: err.message }));
            }
          }
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
    const tracked = [
      'commerce.orderStatus', 'commerce.paymentStatus', 'commerce.cancelledReason', 'commerce.cancelledBy',
      'commerce.unAttendedCount', 'commerce.totalAmount',
      'workflowStage', 'workflowPriority',
      'customer.confirmationStatus', 'vendor.vendorStatus',
      'assignedTo', 'branch', 'team',
    ];
    const fields = [];
    let statusChanged = false;
    let workflowChanged = false;

    for (const key of tracked) {
      const oldVal = this.getNested(existing, key);
      const newVal = this.getNested(normalized, key);
      if (oldVal !== newVal && newVal !== undefined) {
        fields.push({ field: key, from: oldVal, to: newVal });
        if (key === 'commerce.orderStatus') statusChanged = true;
        if (['workflowStage', 'workflowPriority', 'assignedTo'].includes(key)) workflowChanged = true;
      }
    }

    return {
      any: fields.length > 0,
      fields,
      statusChanged,
      workflowChanged,
      summary: fields.map(f => `${f.field}: ${f.from} → ${f.to}`).join(', '),
    };
  }

  getNested(obj, path) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  normalizeOrder(order, existing) {
    // ponytail: preserve locally-set confirmation/vendor status across syncs —
    // the commerce API returns undefined here, so without this every sync would
    // clobber ops' 'confirmed'/'accepted' back to pending. Upgrade: two-way API
    // writeback when the source supports it.
    const existingCustomer = existing?.customer && typeof existing.customer === 'object' ? existing.customer : {};
    const existingVendor = existing?.vendor && typeof existing.vendor === 'object' ? existing.vendor : {};

    const customerPhone = decodeBase64(order.customerPhone || order.phone || order.mobile || '');
    const vendorPhone = decodeBase64(order.vendorPhone || order.vendor?.phone || '');
    const customerName = decodeBase64(order.customerProfile?.name || order.customer || '');
    const vendorName = decodeBase64(order.vendor?.name || order.vendor || '');
    const customerEmail = decodeBase64(order.customerProfile?.email || '');
    const vendorEmail = decodeBase64(order.vendor?.email || '');

    const normalized = {
      commerceOrderId: order._id,
      orderId: order.orderId,
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        profile: order.customerProfile || {},
        confirmationStatus: order.confirmationStatus || existingCustomer.confirmationStatus || 'pending',
      },
      vendor: {
        name: vendorName,
        phone: vendorPhone,
        email: vendorEmail,
        info: order.vendor || {},
        vendorStatus: order.vendorStatus || existingVendor.vendorStatus || 'unassigned',
      },
      commerce: {
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        deliveryStatus: order.externalDeliveryStatus,
        deliveryEvent: order.externalDeliveryEvent,
        orderType: order.orderType,
        branch: order.branch,
        sender: order.sender,
        receiver: order.receiver,
        destinationBranch: order.destinationBranch,
        totalAmount: order.totalAmount,
        shippingAmount: order.shippingAmount,
        unAttendedCount: order.unAttendedCount,
        additionalPickupTimeWindow: order.additionalPickupTimeWindow,
        coupon: order.coupon,
        addedUser: order.addedUser,
        items: order.items || [],
        logisticsOrderId: order.logisticsOrderId,
        externalLogisticsOrderId: order.externalLogisticsOrderId,
        externalHeavyLogisticsId: order.externalHeavyLogisticsId,
        externalNonHeavyLogisticsId: order.externalNonHeavyLogisticsId,
        pickupTicketId: order.pickupTicketId,
        originBranch: order.originBranch,
        destinationBranch: order.destinationBranch,
        shippingType: order.shippingType,
        dispatchMode: order.dispatchMode,
        shippingAddress: order.shippingAddress,
        deliveryChargeBreakdown: order.deliveryChargeBreakdown,
        cancelledBy: order.cancelledBy,
        cancelledReason: order.cancelledReason,
      },
      externalUpdatedAt: order.updatedAt || order.updated_at || order.lastUpdatedAt,
    };

    // Compute workflow fields
    normalized.workflowStage = this.computeWorkflowStage(normalized);
    normalized.workflowPriority = this.computeWorkflowPriority(normalized);
    normalized.workflowUpdatedAt = normalized.externalUpdatedAt || new Date();

    return normalized;
  }

  async generateTasksForOrder(order) {
    const c = order.commerce || {};
    const nameOf = (e) => (e && typeof e === 'object' ? (e.name || '') : (e || ''));
    const phoneOf = (e) => (e && typeof e === 'object' ? (e.phone || '') : (e || ''));

    const priorityMap = this.getPriorityForOrder(order);

    const orderData = {
      _id: order.commerceOrderId,
      orderId: order.commerceOrderId,
      orderNumber: order.orderId,
      customerName: nameOf(order.customer),
      customerPhone: phoneOf(order.customer) || order.customerPhone || '',
      vendorName: nameOf(order.vendor),
      vendorPhone: phoneOf(order.vendor) || order.vendorPhone || '',
      customerId: order._id,
      newStatus: c.orderStatus || order.orderStatus,
      paymentStatus: c.paymentStatus || order.paymentStatus,
      paymentMethod: c.paymentMethod || order.paymentMethod,
      unAttendedCount: c.unAttendedCount ?? order.unAttendedCount,
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
    const c = order.commerce || {};
    const orderStatus = c.orderStatus || order.orderStatus;
    const paymentStatus = c.paymentStatus || order.paymentStatus;
    const paymentMethod = c.paymentMethod || order.paymentMethod;
    const unAttendedCount = c.unAttendedCount ?? order.unAttendedCount;
    const totalAmount = c.totalAmount ?? order.totalAmount;
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

  computeWorkflowStage(order) {
    const cs = order.customer?.confirmationStatus || 'pending';
    const vs = order.vendor?.vendorStatus || 'unassigned';
    const os = (order.commerce?.orderStatus || '').toLowerCase();

    if (cs === 'pending' && os === 'pending') return 'pending_confirmation';
    if (cs === 'confirmed' && vs === 'accepted' && ['pending', 'processing'].includes(os)) return 'pending_review';
    if (cs === 'confirmed' && ['pending', ''].includes(os)) return 'confirmed_unprocessed';
    if (os === 'delivered') return 'delivered_followup';
    if (cs === 'confirmed') return 'done';
    return 'other';
  }

  computeWorkflowPriority(order) {
    return this.getPriorityForOrder(order).priority;
  }

  async getOrderStatus(commerceOrderId) {
    const order = await CommerceOrder.findOne({ commerceOrderId });
    return order;
  }

  async getOrders(filters = {}) {
    const { status, paymentStatus, vendor, customer, segment, search, page = 1, limit = 20, rbac } = filters;
    const query = {};

    if (rbac && Object.keys(rbac).length) {
      query.$and = [rbac];
    }

    if (segment) query.workflowStage = segment;

    if (status) {
      query.$and = [
        ...(query.$and || []),
        { $or: [{ orderStatus: status }, { 'commerce.orderStatus': status }] },
      ];
    }
    if (paymentStatus) {
      query.$and = [
        ...(query.$and || []),
        { $or: [{ paymentStatus }, { 'commerce.paymentStatus': paymentStatus }] },
      ];
    }
    if (vendor) {
      const regex = new RegExp(vendor, 'i');
      query.$and = [
        ...(query.$and || []),
        { $or: [{ vendor: regex }, { 'vendor.name': regex }] },
      ];
    }
    if (customer) {
      const regex = new RegExp(customer, 'i');
      query.$and = [
        ...(query.$and || []),
        { $or: [{ customer: regex }, { 'customer.name': regex }] },
      ];
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { commerceOrderId: regex },
            { orderId: regex },
            { customer: regex },
            { 'customer.name': regex },
            { customerPhone: regex },
            { 'customer.phone': regex },
          ],
        },
      ];
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      CommerceOrder.find(query)
        .sort({ externalUpdatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommerceOrder.countDocuments(query),
    ]);

    const orderIds = orders.map(o => o.commerceOrderId);
    const tasks = await Task.find({
      'sourceOrder.orderId': { $in: orderIds },
      status: { $in: ['pending', 'in-progress', 'overdue'] },
    }).lean();
    const taskMap = {};
    for (const t of tasks) {
      taskMap[t.sourceOrder?.orderId] = { taskId: t._id, taskType: t.type };
    }
    const enrichedOrders = orders.map(o => ({
      ...o,
      taskId: taskMap[o.commerceOrderId]?.taskId || null,
      activeTaskType: taskMap[o.commerceOrderId]?.taskType || null,
    }));

    return { orders: enrichedOrders, total, page, limit };
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
                  'commerce.deliveryStatus': item.externalDeliveryStatus || null,
                  'commerce.deliveryEvent': item.externalDeliveryEvent || null,
                  'commerce.orderType': item.orderType || null,
                  'commerce.branch': item.branch || null,
                  'commerce.sender': item.sender || null,
                  'commerce.receiver': item.receiver || null,
                  'commerce.destinationBranch': item.destinationBranch || null,
                  'commerce.shippingType': item.shippingType || null,
                  'commerce.dispatchMode': item.dispatchMode || null,
                  'commerce.externalNonHeavyLogisticsId': item.externalNonHeavyLogisticsId || null,
                  'commerce.pickupTicketId': item.pickupTicketId || null,
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