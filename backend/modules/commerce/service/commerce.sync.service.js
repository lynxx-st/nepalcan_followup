const axios = require('axios');
const { CommerceOrder, Task, OrderReturn } = require('../../../database/models');
const commerceAuth = require('./commerce.auth.service');
const taskGeneratorService = require('../../../modules/tasks/generator/task-generator.service');
const taskService = require('../../../modules/tasks/service/task.service');
const config = require('../../../config');
const logger = require('../../../utils/logger');
const { decodeBase64 } = require('../../../utils/decode');
const settingsService = require('../../../modules/settings/service/settings.service');
const recoveryService = require('../../../modules/recovery/service/recovery.service');

const COMMERCE_BASE = config.commerceApiBase;

// NCM vendor API comments: `{orderid, comments, addedBy, added_time}` → internal
// note shape so the frontend renders them like other api-sourced notes.
function normalizeExternalComments(list) {
  if (!Array.isArray(list)) return [];
  return list.map((c) => ({
    note: c.comments,
    actor: c.addedBy,
    createdAt: c.added_time,
  }));
}

// First Delivered transition only: preserves an existing deliveredAt, computes
// timeToDeliveryMs from the external creation anchor (null when anchor missing).
function deliveryMark(existing, status, createdAnchor, now = new Date()) {
  if (status !== 'Delivered' || existing?.deliveredAt) return null;
  const created = createdAnchor ? new Date(createdAnchor) : null;
  return {
    deliveredAt: now,
    timeToDeliveryMs: created ? Math.max(0, now.getTime() - created.getTime()) : null,
  };
}

// Return attachments come in as strings or loose objects; normalize to
// {url, name, type} and mark zoomable so the frontend lightbox can render them.
function normalizeAttachment(a) {
  if (!a) return null;
  if (typeof a === 'string') a = { url: a };
  const url = a.url || a.imageUrl || a.src || '';
  return {
    url,
    name: a.name || a.filename || '',
    type: a.type || (url.match(/\.(\w{2,5})(\?|$)/) || [])[1]?.toLowerCase() || '',
    zoomable: true,
  };
}

class CommerceSyncService {
  constructor() {
    this.baseUrl = COMMERCE_BASE;
    this.maxPages = 50;
    this.lastSyncCursor = null;
    this.logisticsFollowupHours = 6;
    this.reviewFollowupDelayHours = 24;
    this.priorityAmountThreshold = 1000;
    this.deliveryZones = null;
    this.slaDefaults = {
      'customer-confirmation': 30,
      'vendor-call': 120,
      'cancelled-recovery': 15,
      'review-call': 1440,
      'return-customer-response': 60,
      'return-vendor-response': 120,
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
    return { ...this.syncStatus, lastSyncCursor: this.lastSyncCursor || null };
  }

  // NCM vendor API (doc: GET /api/v1/order/comment?id=ORDERID, Token auth).
  async fetchExternalComments(orderId) {
    if (!config.ncmApiToken) throw new Error('NCM_API_TOKEN not configured');
    const url = `${config.ncmApiBase}/api/v1/order/comment?id=${encodeURIComponent(orderId)}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Token ${config.ncmApiToken}` },
      timeout: 15000,
    });
    return normalizeExternalComments(response.data || []);
  }

  // NCM vendor API (doc: POST /api/v1/comment {orderid, comments}).
  async postExternalComment(orderId, text) {
    if (!config.ncmApiToken) throw new Error('NCM_API_TOKEN not configured');
    const url = `${config.ncmApiBase}/api/v1/comment`;
    const response = await axios.post(
      url,
      { orderid: orderId, comments: text },
      { headers: { Authorization: `Token ${config.ncmApiToken}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return response.data;
  }

  resetCursor() {
    this.lastSyncCursor = null;
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

      const returnsResult = await this.syncOrderReturns();
      this.syncStatus.totalReturnsSynced = returnsResult.totalSynced || 0;

      this.syncStatus.lastCompletedAt = new Date().toISOString();
      return {
        ordersSynced: orderResult.totalFetched,
        logisticsSynced: logisticsResult.totalUpdated,
        tasksCreated: logisticsResult.tasksCreated,
      };
    } catch (err) {
      this.syncStatus.lastError = err.message;
      logger.error('Sync all failed', { error: err.message });
      return { ordersSynced: 0, logisticsSynced: 0, tasksCreated: 0, error: err.message };
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
      if (settings.reviewFollowupDelayHours !== undefined) this.reviewFollowupDelayHours = settings.reviewFollowupDelayHours;
      if (settings.returnCustomerResponseSlaMinutes) this.slaDefaults['return-customer-response'] = settings.returnCustomerResponseSlaMinutes;
      if (settings.returnVendorResponseSlaMinutes) this.slaDefaults['return-vendor-response'] = settings.returnVendorResponseSlaMinutes;
      if (settings.reviewCallSlaMinutes) this.slaDefaults['review-call'] = settings.reviewCallSlaMinutes;
      if (settings.escalationSlaMinutes) this.slaDefaults.escalation = settings.escalationSlaMinutes;
      if (Array.isArray(settings.deliveryZones)) this.deliveryZones = settings.deliveryZones;
    } catch (err) {
      logger.warn('Failed to load settings, using defaults', { error: err.message });
    }
  }

  computeDeliveryZone(branch) {
    const name = (branch && typeof branch === 'object' ? branch.name : branch) || '';
    const needle = String(name).trim().toUpperCase();
    if (!needle) return 'other';
    for (const tier of this.deliveryZones || []) {
      if (Array.isArray(tier.branches) && tier.branches.includes(needle)) {
        return ['same-city', 'major', 'third-tier'].includes(tier.key) ? tier.key : 'other';
      }
    }
    return 'other';
  }

  getSlaHours(zone) {
    const zones = Array.isArray(this.deliveryZones) ? this.deliveryZones : [];
    const tier = zones.find((z) => z.key === zone) || zones.find((z) => z.key === 'third-tier');
    return (tier && tier.slaHours) || 72;
  }

  // Two SLA windows per order: from creation and from pickup collected.
  // Operative deadline = earlier of the two; status flips to 'breached' once
  // past it (unless already delivered). 'other' zone falls back to third-tier
  // hours.
  computeSla({ created, pickup, zone = 'other', delivered = false }, now = new Date()) {
    const hours = this.getSlaHours(zone);
    const deadlineA = created ? new Date(created.getTime() + hours * 3600000) : null;
    const deadlineB = pickup ? new Date(pickup.getTime() + hours * 3600000) : null;
    const deadlines = [deadlineA, deadlineB].filter(Boolean);
    const slaDeliveryDeadline = deadlines.length ? new Date(Math.min(...deadlines.map((d) => d.getTime()))) : null;
    let slaStatus = 'pending';
    if (delivered) {
      slaStatus = 'ok';
    } else if (slaDeliveryDeadline && now > slaDeliveryDeadline) {
      slaStatus = 'breached';
    }
    return { deadlineA, deadlineB, slaDeliveryDeadline, slaStatus };
  }

  // Periodic pass (scheduler): refresh deadlines from stored anchors + current
  // zone hours and flip pending → breached as time passes without new events.
  async updateSlaStatuses() {
    try {
      await this.loadSettings();
      const now = new Date();
      const orders = await CommerceOrder.find({ 'sla.slaStatus': { $in: ['pending', 'breached'] } }).lean();
      const ops = [];
      for (const o of orders) {
        const cur = o.sla || {};
        const created = cur.slaCreatedAt ? new Date(cur.slaCreatedAt) : null;
        const pickup = cur.slaPickupAt ? new Date(cur.slaPickupAt) : null;
        const sla = this.computeSla({
          created,
          pickup,
          zone: o.deliveryZone || 'other',
          delivered: o.commerce?.orderStatus === 'Delivered',
        }, now);
        if (sla.slaStatus !== cur.slaStatus ||
            String(sla.slaDeliveryDeadline) !== String(cur.slaDeliveryDeadline)) {
          ops.push({
            updateOne: {
              filter: { _id: o._id },
              update: { $set: { 'sla.deadlineA': sla.deadlineA, 'sla.deadlineB': sla.deadlineB, 'sla.slaDeliveryDeadline': sla.slaDeliveryDeadline, 'sla.slaStatus': sla.slaStatus } },
            },
          });
        }
      }
      if (ops.length > 0) {
        await CommerceOrder.bulkWrite(ops);
        logger.info('SLA statuses refreshed', { updated: ops.length });
      }
    } catch (err) {
      logger.error('Failed to update SLA statuses', { error: err.message });
    }
  }

  // Legacy docs stored customer/vendor as plain strings; nested $set on
  // customer.confirmationStatus / vendor.vendorStatus then fails on a scalar.
  // Convert them to objects once (idempotent).
  async migrateLegacySchema() {
    const r = await CommerceOrder.updateMany(
      { customer: { $type: 'string' } },
      [{ $set: { customer: { name: '$customer', confirmationStatus: 'pending' } } }]
    );
    const v = await CommerceOrder.updateMany(
      { vendor: { $type: 'string' } },
      [{ $set: { vendor: { name: '$vendor', vendorStatus: 'unassigned' } } }]
    );
    if (r.modifiedCount + v.modifiedCount > 0) {
      logger.info('Migrated legacy customer/vendor fields', { customers: r.modifiedCount, vendors: v.modifiedCount });
    }
  }

  async syncOrders(options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 500, status = 'Active', unattendedOrders = '', updatedAfter } = options;

    logger.info('Starting order sync', { page, limit, status, updatedAfter: updatedAfter || this.lastSyncCursor });

    await this.migrateLegacySchema();
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
        const dm = deliveryMark(existing, normalized.commerce?.orderStatus, normalized.externalCreatedAt || existing.sla?.slaCreatedAt || existing.createdAt);
        if (dm) {
          $set.deliveredAt = dm.deliveredAt;
          $set.timeToDeliveryMs = dm.timeToDeliveryMs;
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
        const normalized = this.normalizeOrder(order);
        const dm = deliveryMark(null, normalized.commerce?.orderStatus, normalized.externalCreatedAt);
        if (dm) {
          normalized.deliveredAt = dm.deliveredAt;
          normalized.timeToDeliveryMs = dm.timeToDeliveryMs;
        }
        const created = await CommerceOrder.create(normalized);
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
        externalLogisticsOrderId: order.externalLogisticsOrderId || order.externalNonHeavyLogisticsId,
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
      externalStatusHistory: order.externalStatusHistory || [],
      externalLogisticsOrderId: order.externalLogisticsOrderId || order.externalNonHeavyLogisticsId,
      externalCreatedAt: order.createdAt || order.updatedAt || order.lastUpdatedAt || undefined,
      externalUpdatedAt: order.updatedAt || order.updated_at || order.lastUpdatedAt,
    };

    // Compute workflow fields
    normalized.workflowStage = this.computeWorkflowStage(normalized);
    normalized.workflowPriority = this.computeWorkflowPriority(normalized);
    normalized.workflowUpdatedAt = normalized.externalUpdatedAt || new Date();
    normalized.deliveryZone = this.computeDeliveryZone(order.destinationBranch);

    return normalized;
  }

  async generateTasksForOrder(order) {
    const c = order.commerce || {};
    const nameOf = (e) => (e && typeof e === 'object' ? (e.name || '') : (e || ''));
    const phoneOf = (e) => (e && typeof e === 'object' ? (e.phone || '') : (e || ''));

    const priorityMap = this.getPriorityForOrder(order);
    if (!priorityMap) return;

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
    if (orderStatus === 'Shipped') return null;
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

  // ponytail: the logistics API (external-non-heavy) returns delivery event/status
  // but NOT orderStatus. Infer it so shipped/delivered orders never fall back into
  // pending_confirmation. Upgrade: read authoritative orderStatus once the API provides it.
  inferOrderStatusFromLogistics(item, fallback) {
    const de = (item.externalDeliveryEvent || '').toLowerCase();
    const ds = (item.externalDeliveryStatus || '').toLowerCase();
    if (de.includes('delivered') || de.includes('return') || ds.includes('delivered')) return 'Delivered';
    if (de.includes('shipped') || de.includes('in_transit') || de.includes('dispatched') || de.includes('arrived')) return 'Shipped';
    if (de.includes('pickup') || de.includes('collected')) return 'Processing';
    return fallback;
  }

  isOrderSlaBreached(order) {
    if (!order) return false;
    if (order.isOverdue || order.taskStatus === 'overdue' || order.slaBreached) return true;

    const dueAtStr = order.dueAt || order.activeTaskDueAt || order.slaDueAt;
    if (dueAtStr) {
      return new Date() > new Date(dueAtStr);
    }

    const refTime = order.customerCalledAt || order.workflowUpdatedAt || order.createdAt || order.externalUpdatedAt;
    if (refTime) {
      const slaMinutes = order.slaMinutes || this.slaDefaults?.['customer-confirmation'] || 30;
      const elapsedMs = Date.now() - new Date(refTime).getTime();
      if (elapsedMs > slaMinutes * 60 * 1000) {
        return true;
      }
    }

    return false;
  }

  computeWorkflowStage(order) {
    const cs = order.customer?.confirmationStatus || order.confirmationStatus || 'pending';
    const vs = order.vendor?.vendorStatus || order.vendorStatus || 'unassigned';
    const os = (order.commerce?.orderStatus || order.orderStatus || '').toLowerCase();

    if (cs === 'rescheduled' || vs === 'rescheduled') return 'rescheduled';
    if (os === 'shipped') return 'shipped';

    // Delivered orders
    if (['delivered', 'return delivered'].includes(os)) {
      return 'pending_review';
    }

    // Processing (picked up by logistics) → collected_by_logistics
    if (os === 'processing' && cs === 'confirmed' && vs === 'accepted') {
      return 'collected_by_logistics';
    }

    // Both customer AND vendor confirmed → confirmed_unprocessed (awaiting pickup/dropoff)
    if (cs === 'confirmed' && vs === 'accepted') {
      return 'confirmed_unprocessed';
    }

    // Only customer confirmed (vendor not yet accepted) → done (marked done in pre-processing)
    if (cs === 'confirmed' && vs !== 'accepted') {
      return 'done';
    }

    // Only vendor confirmed (customer not yet confirmed) → stays in pending_confirmation
    if (vs === 'accepted' && cs !== 'confirmed') {
      return 'pending_confirmation';
    }

    if (cs === 'pending' && os === 'pending') return 'pending_confirmation';
    return 'other';
  }

  async autoUpdateSlaBreachedOrders() {
    try {
      const doneOrders = await CommerceOrder.find({
        workflowStage: 'done',
        'commerce.orderStatus': { $in: ['Pending', 'pending', ''] },
      }).lean();

      for (const order of doneOrders) {
        if (this.isOrderSlaBreached(order)) {
          await CommerceOrder.updateOne(
            { _id: order._id },
            { $set: { workflowStage: 'confirmed_unprocessed', workflowUpdatedAt: new Date() } }
          );
        }
      }
    } catch (err) {
      logger.error('Failed to auto update SLA breached orders:', err);
    }
  }

  computeWorkflowPriority(order) {
    const p = this.getPriorityForOrder(order);
    return p ? p.priority : 'low';
  }

  getTaskTypeForStage(stage) {
    const map = {
      pending_confirmation: 'customer-confirmation',
      confirmed_unprocessed: 'vendor-call',
      collected_by_logistics: 'logistics-followup',
      shipped: 'logistics-followup',
      pending_review: 'review-call',
      customer_response: 'return-customer-response',
      vendor_response: 'return-vendor-response',
      rescheduled: 'cancelled-recovery',
    };
    return map[stage] || 'customer-confirmation';
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
    const enrichedOrders = orders.map(o => {
      const rawTotal = o.totalAmount || o.commerce?.totalAmount;
      const itemsList = o.commerce?.items || o.items || [];
      const computedTotal = itemsList.reduce((acc, it) => {
        const p = Number(it.price || it.product?.price || it.product?.sellingPrice || it.variant?.sellingPrice || 0);
        return acc + (p * Number(it.quantity || 1));
      }, 0);
      const totalAmount = rawTotal || computedTotal || 0;

      const activeTask = taskMap[o.commerceOrderId];
      const activeTaskType = activeTask?.taskType || this.getTaskTypeForStage(o.workflowStage);
      const slaMinutes = activeTask?.slaMinutes || this.slaDefaults[activeTaskType] || 60;
      const dueAt = activeTask?.dueAt || (o.workflowUpdatedAt ? new Date(new Date(o.workflowUpdatedAt).getTime() + slaMinutes * 60000).toISOString() : null);

      return {
        ...o,
        totalAmount,
        taskId: activeTask?.taskId || null,
        activeTaskType,
        priority: o.workflowPriority || 'low',
        slaMinutes,
        dueAt,
        externalLogisticsOrderId: o.externalLogisticsOrderId || o.commerce?.externalLogisticsOrderId || o.commerce?.externalNonHeavyLogisticsId,
      };
    });

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
    const changedOrders = [];
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
        const existingMap = {};
        for (const doc of existingOrders) existingMap[doc.commerceOrderId] = doc;

        const bulkOps = [];
        for (const item of items) {
          if (!existingSet.has(item._id)) continue;
          totalUpdated++;

          const existing = existingMap[item._id];
          const orderStatus = this.inferOrderStatusFromLogistics(item, existing?.commerce?.orderStatus || null);
          const order = {
            commerce: { orderStatus },
            customer: { confirmationStatus: existing?.customer?.confirmationStatus || 'pending' },
            vendor: { vendorStatus: existing?.vendor?.vendorStatus || 'unassigned' },
          };
          const workflowStage = this.computeWorkflowStage(order);
          const workflowPriority = this.computeWorkflowPriority(order);

          const deliveryZone = this.computeDeliveryZone(item.destinationBranch);
          const deliveryEvent = (item.externalDeliveryEvent || '').toLowerCase();
          const isPickupEvent = deliveryEvent.includes('pickup') || deliveryEvent.includes('collected');
          const slaInput = {
            created: item.createdAt ? new Date(item.createdAt) : (existing?.sla?.slaCreatedAt || null),
            pickup: existing?.sla?.slaPickupAt
              ? new Date(existing.sla.slaPickupAt)
              : (isPickupEvent && item.updatedAt ? new Date(item.updatedAt) : null),
            zone: deliveryZone,
            delivered: orderStatus === 'Delivered',
          };
          const sla = this.computeSla(slaInput, new Date());

          if (existing?.commerce?.orderStatus !== orderStatus) {
            changedOrders.push({ orderId: item.orderId, changes: [{ field: 'commerce.orderStatus', from: existing?.commerce?.orderStatus, to: orderStatus }] });
          }

           const bulkUpdate = {
             $set: {
               'commerce.deliveryStatus': item.externalDeliveryStatus || null,
               'commerce.deliveryEvent': item.externalDeliveryEvent || null,
               'commerce.orderStatus': orderStatus,
               'commerce.orderType': item.orderType || null,
               'commerce.branch': item.branch || null,
               'commerce.sender': item.sender || null,
               'commerce.receiver': item.receiver || null,
               'commerce.destinationBranch': item.destinationBranch || null,
               'deliveryZone': deliveryZone,
               'sla.slaCreatedAt': slaInput.created || null,
               'sla.slaPickupAt': slaInput.pickup || null,
               'sla.deadlineA': sla.deadlineA || null,
               'sla.deadlineB': sla.deadlineB || null,
               'sla.slaDeliveryDeadline': sla.slaDeliveryDeadline || null,
               'sla.slaStatus': sla.slaStatus,
               'commerce.shippingType': item.shippingType || null,
               'commerce.dispatchMode': item.dispatchMode || null,
               'commerce.externalNonHeavyLogisticsId': item.externalNonHeavyLogisticsId || null,
               'commerce.externalLogisticsOrderId': item.externalNonHeavyLogisticsId || item.externalLogisticsOrderId || null,
               'commerce.pickupTicketId': item.pickupTicketId || null,
               externalLogisticsOrderId: item.externalNonHeavyLogisticsId || item.externalLogisticsOrderId || null,
               externalStatusHistory: item.externalStatusHistory || [{
                 event: item.externalDeliveryEvent || 'unknown',
                 status: item.externalDeliveryStatus || 'Unknown',
                 rawPayload: item,
                 receivedAt: new Date(),
               }],
               workflowStage,
               workflowPriority,
               externalUpdatedAt: item.updatedAt || item.updated_at || null,
               lastSyncedAt: new Date(),
             },
           };
           const dm = deliveryMark(existing, orderStatus, slaInput.created || existing.externalCreatedAt || existing.createdAt);
           if (dm) {
             bulkUpdate.$set.deliveredAt = dm.deliveredAt;
             bulkUpdate.$set.timeToDeliveryMs = dm.timeToDeliveryMs;
           }
           bulkOps.push({
             updateOne: {
               filter: { commerceOrderId: item._id },
               update: bulkUpdate,
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
          if (changedOrders.length > 0 && global.io) {
            global.io.emit('order-updates', { count: changedOrders.length, orders: changedOrders });
          }
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

  async syncOrderReturns(options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 1000 } = options;
    logger.info('Starting external order returns sync', { page, limit });

    await this.loadSettings();
    const token = await commerceAuth.getToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const url = `https://commerce.thecanbrand.com/api/order-return/provider/list?status=Active&keywords=&page=${page}&limit=${limit}&vendor=&from=&to=&returnStatus=`;

    try {
      const response = await axios.get(url, { headers, timeout: 15000 });
      const returnList = response.data?.data || response.data || [];
      if (!Array.isArray(returnList)) {
        logger.warn('Order returns sync returned non-array data');
        return { totalSynced: 0, summary: response.data?.summary || {} };
      }

      let totalSynced = 0;
      for (const item of returnList) {
        if (!item._id) continue;
        const externalReturnId = String(item._id);
        const orderInfo = item.order || {};
        const commerceOrderId = orderInfo._id ? String(orderInfo._id) : null;
        const orderId = orderInfo.orderId || null;
        const customerProfile = orderInfo.customerProfile || item.customerProfile || {};
        const customerPhone = customerProfile.phone || item.customerPhone || '';
        const vendor = orderInfo.vendor || item.vendor || {};

        const updateData = {
          externalReturnId,
          commerceOrderId,
          orderId,
          order: orderInfo,
          vendor,
          customerProfile,
          customerPhone,
          items: item.items || [],
          returnReason: item.returnReason || '',
          type: item.type || 'Return',
          attachments: (item.attachments || []).map(normalizeAttachment).filter(Boolean),
          status: item.status || 'Initiated',
          superAdminStatus: item.superAdminStatus || 'None',
          rejectReason: item.rejectReason || null,
          concernReason: item.concernReason || null,
          isActive: item.isActive !== undefined ? item.isActive : true,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        };

        await OrderReturn.findOneAndUpdate(
          { externalReturnId },
          { $setOnInsert: { customerResponseStatus: 'pending', vendorResponseStatus: 'pending', workflowStage: 'customer_response' }, $set: updateData },
          { upsert: true, new: true }
        );
        totalSynced++;
      }

      logger.info('Order returns sync completed', { totalSynced, elapsedMs: Date.now() - startTime });
      return { totalSynced, summary: response.data?.summary || {} };
    } catch (err) {
      logger.error('Failed to sync order returns', { error: err.message });
      return { totalSynced: 0, error: err.message };
    }
  }
}

const commerceSync = new CommerceSyncService();

module.exports = { commerceSync, CommerceSyncService, normalizeExternalComments, deliveryMark, normalizeAttachment };