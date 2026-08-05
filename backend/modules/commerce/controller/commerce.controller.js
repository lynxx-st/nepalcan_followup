const axios = require('axios');
const commerceAuth = require('../service/commerce.auth.service');
const { commerceSync } = require('../service/commerce.sync.service');
const { CommerceOrder, Task, OrderReturn } = require('../../../database/models');
const config = require('../../../config');
const { decodeBase64 } = require('../../../utils/decode');
const recoveryService = require('../../../modules/recovery/service/recovery.service');

function mergeNotes(localNotes = [], apiNotes = []) {
  const app = localNotes.map((n) => ({
    note: n.note,
    actor: n.actor,
    actorName: n.actorName,
    createdAt: n.createdAt,
    source: 'internal',
  }));
  const api = apiNotes.map((n) => ({
    note: n.comment || n.note,
    actor: n.addedBy || n.authorName || n.actor,
    createdAt: n.createdAt,
    source: 'api',
  }));
  return [...api, ...app].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function buildRbacQuery(user) {
  if (!user) return {};
  switch (user.role) {
    case 'super-admin':
      return {};
    case 'admin':
      return user.branches?.length
        ? {
            $or: [
              { branch: { $in: user.branches } },
              { 'branch.name': { $in: user.branches } },
              { 'commerce.branch': { $in: user.branches } },
              { 'commerce.branch.name': { $in: user.branches } },
            ],
          }
        : {};
    case 'manager':
      return user.team
        ? { $or: [{ team: user.team }, { assignedTo: user._id }, { assignedTo: { $exists: false } }] }
        : { $or: [{ assignedTo: user._id }, { assignedTo: { $exists: false } }] };
    case 'staff':
    default:
      return { $or: [{ assignedTo: user._id }, { assignedTo: { $exists: false } }] };
  }
}

async function login(req, res) {
  try {
    const token = await commerceAuth.getToken();
    res.json({
      success: true,
      data: { token, message: 'Login successful' },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function syncOrders(req, res) {
  try {
    const { page, limit, status, unattendedOrders, updatedAfter } = req.query;
    const options = {
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.max(1, Math.min(500, parseInt(limit) || 500)),
      status: status || 'Active',
      unattendedOrders: unattendedOrders || '',
      updatedAfter: updatedAfter || undefined,
    };

    const result = await commerceSync.syncOrders(options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function syncExternalNonHeavy(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await commerceSync.syncExternalNonHeavy({
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.max(1, Math.min(500, parseInt(limit) || 500)),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function getOrders(req, res) {
  try {
    const { 
      segment, search, page, limit, 
      status, paymentStatus, vendor, customer 
    } = req.query;
    
    await commerceSync.autoUpdateSlaBreachedOrders();
    const rbacQuery = buildRbacQuery(req.user);
    
    const filters = {
      rbac: buildRbacQuery(req.user),
      segment,
      search,
      status,
      paymentStatus,
      vendor,
      customer,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit) || 20))
    };
    
    const result = await commerceSync.getOrders(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function getReviews(req, res) {
  try {
    const { search, page, limit } = req.query;

    const query = {
      review: { $nin: [null, ''] },
    };
    const rbac = buildRbacQuery(req.user);
    if (rbac && Object.keys(rbac).length) {
      query.$and = [rbac];
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { commerceOrderId: regex },
            { orderId: regex },
            { orderNumber: regex },
            { 'customer.name': regex },
            { 'customer.phone': regex },
          ],
        },
      ];
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      CommerceOrder.find(query)
        .select('commerceOrderId orderId orderNumber review customer updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CommerceOrder.countDocuments(query),
    ]);

    const reviews = orders.map((o) => ({
      commerceOrderId: o.commerceOrderId,
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      customerName: o.customer?.name || '',
      customerPhone: o.customer?.phone || '',
      review: o.review || o.customer?.review || '',
      updatedAt: o.updatedAt,
    }));

    res.json({ success: true, data: { reviews, total, page: pageNum, limit: limitNum } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function getSegmentCounts(req, res) {
  try {
    await commerceSync.autoUpdateSlaBreachedOrders();
    const rbacQuery = buildRbacQuery(req.user);
    
    const counts = await CommerceOrder.aggregate([
      { $match: rbacQuery },
      { $group: { _id: '$workflowStage', count: { $sum: 1 } } }
    ]);
    
    const result = {
      pending_confirmation: 0,
      pending_review: 0,
      confirmed_unprocessed: 0,
      done: 0,
      rescheduled: 0,
      shipped: 0,
      customer_response: 0,
      vendor_response: 0,
      other: 0
    };
    
    for (const c of counts) {
      if (result.hasOwnProperty(c._id)) result[c._id] = c.count;
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function getOrderById(req, res) {
  try {
    const { commerceOrderId } = req.params;
    const order = await CommerceOrder.findOne({ commerceOrderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: { message: 'Order not found' },
      });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function getOrderStatus(req, res) {
  try {
    const { commerceOrderId } = req.params;
    const order = await commerceSync.getOrderStatus(commerceOrderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: { message: 'Order not found in synced data' },
      });
    }

    res.json({
      success: true,
      data: {
        commerceOrderId: order.commerceOrderId,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function getOrderDetail(req, res) {
  try {
    const { commerceOrderId } = req.params;

    const existing = await CommerceOrder.findOne({ commerceOrderId }).select('+rawApiData');

    const activeTask = existing ? await Task.findOne({
      'sourceOrder.orderId': commerceOrderId,
      status: { $in: ['pending', 'in-progress', 'overdue'] },
    }).lean() : null;

    if (existing && existing.rawApiData) {
      const raw = existing.rawApiData.toObject ? existing.rawApiData.toObject() : existing.rawApiData;

      const decodedCustPhone = decodeBase64(raw.customerProfile?.phone);
      const decodedVendPhone = decodeBase64(raw.vendor?.phone);
      const decodedCustName = decodeBase64(raw.customerProfile?.name || raw.customer);
      const decodedVendName = decodeBase64(raw.vendor?.name || raw.vendor);
      const decodedCustEmail = decodeBase64(raw.customerProfile?.email);
      const decodedVendEmail = decodeBase64(raw.vendor?.email);

      const existingCustomerName = typeof existing.customer === 'object' ? existing.customer.name : existing.customer;
      const existingVendorName = typeof existing.vendor === 'object' ? existing.vendor.name : existing.vendor;
      const needsUpdate =
        existing.customer?.phone !== decodedCustPhone ||
        existing.vendor?.phone !== decodedVendPhone ||
        existingCustomerName !== decodedCustName ||
        existingVendorName !== decodedVendName;
      if (needsUpdate) {
        await CommerceOrder.findOneAndUpdate(
          { commerceOrderId },
          { $set: { 'customer.phone': decodedCustPhone, 'vendor.phone': decodedVendPhone, 'customer.name': decodedCustName, 'vendor.name': decodedVendName } }
        ).catch(() => {});
      }

      const cached = {
        ...raw,
        orderStatus: existing.commerce?.orderStatus || existing.orderStatus || raw.orderStatus,
        notes: mergeNotes(existing.notes, raw.notes),
        confirmationStatus: existing.customer?.confirmationStatus || 'pending',
        vendorStatus: existing.vendor?.vendorStatus || 'unassigned',
        review: existing?.review || existing?.customer?.review,
        customer: (typeof existing.customer === 'object' ? existing.customer.name : existing.customer) || decodedCustName,
        customerPhone: existing.customer?.phone || existing.customerPhone || decodedCustPhone,
        vendorName: (typeof existing.vendor === 'object' ? existing.vendor.name : existing.vendor) || decodedVendName,
        vendorPhone: existing.vendor?.phone || existing.vendorPhone || decodedVendPhone,
        customerProfile: { ...raw.customerProfile, phone: decodedCustPhone, name: decodedCustName, email: decodedCustEmail },
        vendor: { ...raw.vendor, phone: decodedVendPhone, name: decodedVendName, email: decodedVendEmail },
        externalDeliveryStatus: existing.commerce?.deliveryStatus,
        externalDeliveryEvent: existing.commerce?.deliveryEvent,
        orderType: existing.commerce?.orderType,
        branch: existing.commerce?.branch || existing.branch,
        sender: existing.commerce?.sender,
        receiver: existing.commerce?.receiver,
        destinationBranch: existing.commerce?.destinationBranch,
        externalNonHeavyLogisticsId: existing.commerce?.externalNonHeavyLogisticsId,
        externalLogisticsOrderId: existing.externalLogisticsOrderId || existing.commerce?.externalLogisticsOrderId,
        externalStatusHistory: existing.externalStatusHistory || [],
        pickupTicketId: existing.commerce?.pickupTicketId,
        activeTaskId: activeTask?._id || null,
      };
      return res.json({ success: true, data: cached, cached: true });
    }

    // Uncached path: fetch from API, decode, store, return decoded
    let richData = null;
    try {
      const token = await commerceAuth.getToken();
      const response = await axios.get(
        `${config.commerceApiBase}/${commerceOrderId}`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
      );
      richData = response.data;
    } catch (error) {
      if (!existing) {
        return res.status(404).json({ success: false, error: { message: 'Order not found' } });
      }
      console.error(`getOrderDetail: external fetch failed for ${commerceOrderId}: ${error.message}`);
    }

    if (richData) {
      const decodedCustPhone = decodeBase64(richData.customerProfile?.phone);
      const decodedVendPhone = decodeBase64(richData.vendor?.phone);
      const decodedCustName = decodeBase64(richData.customerProfile?.name || richData.customer);
      const decodedVendName = decodeBase64(richData.vendor?.name || richData.vendor);
      const decodedCustEmail = decodeBase64(richData.customerProfile?.email);
      const decodedVendEmail = decodeBase64(richData.vendor?.email);

      const normalized = commerceSync.normalizeOrder(richData, existing);
      await CommerceOrder.findOneAndUpdate(
        { commerceOrderId },
        {
          $set: {
            ...normalized,
            rawApiData: richData,
            lastSyncedAt: new Date(),
          },
        }
      );

      // Return DECODED response
      const decodedResponse = {
        ...richData,
        orderStatus: existing?.commerce?.orderStatus || existing?.orderStatus || richData.orderStatus,
        notes: mergeNotes(existing?.notes, richData.notes),
        confirmationStatus: existing?.customer?.confirmationStatus || 'pending',
        vendorStatus: existing?.vendor?.vendorStatus || 'unassigned',
        review: existing?.review || existing?.customer?.review,
        customer: decodedCustName,
        customerPhone: decodedCustPhone,
        vendorName: decodedVendName,
        vendorPhone: decodedVendPhone,
        customerProfile: { ...richData.customerProfile, phone: decodedCustPhone, name: decodedCustName, email: decodedCustEmail },
        vendor: { ...richData.vendor, phone: decodedVendPhone, name: decodedVendName, email: decodedVendEmail },
        externalDeliveryStatus: existing?.commerce?.deliveryStatus || null,
        externalDeliveryEvent: existing?.commerce?.deliveryEvent || null,
        orderType: existing?.commerce?.orderType || null,
        branch: existing?.commerce?.branch || existing?.branch || null,
        sender: existing?.commerce?.sender || null,
        receiver: existing?.commerce?.receiver || null,
        destinationBranch: existing?.commerce?.destinationBranch || null,
        externalNonHeavyLogisticsId: existing?.commerce?.externalNonHeavyLogisticsId || null,
        externalLogisticsOrderId: existing?.externalLogisticsOrderId || existing?.commerce?.externalLogisticsOrderId,
        externalStatusHistory: existing?.externalStatusHistory || [],
        pickupTicketId: existing?.commerce?.pickupTicketId || null,
        activeTaskId: activeTask?._id || null,
      };
      return res.json({ success: true, data: decodedResponse, cached: false });
    }

    // External API unavailable — serve normalized local data instead of failing
    const fallback = {
      ...existing.toObject(),
      notes: existing.notes || [],
      confirmationStatus: existing.customer?.confirmationStatus || 'pending',
      vendorStatus: existing.vendor?.vendorStatus || 'unassigned',
      review: existing.customer?.review,
      customer: typeof existing.customer === 'object' && existing.customer ? existing.customer.name : existing.customer,
      customerPhone: existing.customer?.phone || existing.customerPhone,
      vendorName: typeof existing.vendor === 'object' && existing.vendor ? existing.vendor.name : existing.vendor,
      vendorPhone: existing.vendor?.phone || existing.vendorPhone,
      items: existing.commerce?.items || [],
      orderStatus: existing.commerce?.orderStatus,
      paymentStatus: existing.commerce?.paymentStatus,
      paymentMethod: existing.commerce?.paymentMethod,
      totalAmount: existing.totalAmount || existing.commerce?.totalAmount || (existing.commerce?.items || existing.items || []).reduce((acc, it) => acc + (Number(it.price || it.product?.price || it.product?.sellingPrice || it.variant?.sellingPrice || 0) * Number(it.quantity || 1)), 0) || 0,
      externalLogisticsOrderId: existing.externalLogisticsOrderId || existing.commerce?.externalLogisticsOrderId,
      externalStatusHistory: existing.externalStatusHistory || [],
      activeTaskId: activeTask?._id || null,
      cached: true,
    };
    res.json({ success: true, data: fallback, cached: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function updateOrderPhone(req, res) {
  try {
    const { commerceOrderId } = req.params;
    const { phone, type } = req.body;

    if (!phone || !type || !['customer', 'vendor'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: { message: 'phone and type (customer|vendor) required' },
      });
    }

    const path = type === 'customer' ? 'customer.phone' : 'vendor.phone';
    const updated = await CommerceOrder.findOneAndUpdate(
      { commerceOrderId },
      { $set: { [path]: phone } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { message: 'Order not found' },
      });
    }

    await Task.updateMany(
      { 'sourceOrder.orderId': commerceOrderId },
      { [type === 'customer' ? 'customerPhone' : 'vendorPhone']: phone }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { commerceOrderId } = req.params;
    const { confirmationStatus, vendorStatus, orderStatus, note, review } = req.body;

    const existing = await CommerceOrder.findOne({ commerceOrderId });
    if (!existing) {
      return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    }
    const prevStatus = existing.commerce?.orderStatus || existing.orderStatus;

    const update = {};
    if (confirmationStatus) update['customer.confirmationStatus'] = confirmationStatus;
    if (vendorStatus) update['vendor.vendorStatus'] = vendorStatus;
    if (orderStatus) update['commerce.orderStatus'] = orderStatus;
    if (review !== undefined) update['review'] = review;

    const historyEntry = {
      comment: note || `Status updated`,
      actorName: req.user?.name || req.user?.email || 'staff',
      changedAt: new Date().toISOString(),
    };
    if (confirmationStatus) historyEntry.confirmationStatus = confirmationStatus;
    if (vendorStatus) historyEntry.vendorStatus = vendorStatus;
    if (orderStatus) historyEntry.orderStatus = orderStatus;
    if (review !== undefined) historyEntry.review = review;

    const updated = await CommerceOrder.findOneAndUpdate(
      { commerceOrderId },
      {
        $set: update,
        $push: { statusHistory: historyEntry },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { message: 'Order not found' },
      });
    }

    updated.workflowStage = commerceSync.computeWorkflowStage(updated);
    updated.workflowPriority = commerceSync.computeWorkflowPriority(updated);
    await updated.save();

    // Auto-complete active tasks matching updated stage
    if (confirmationStatus === 'confirmed') {
      await Task.updateMany(
        { orderId: commerceOrderId, type: 'customer-confirmation', status: { $in: ['pending', 'in-progress', 'overdue'] } },
        { $set: { status: 'completed', outcome: 'Customer Confirmed', completedAt: new Date() } }
      );
    }
    if (vendorStatus === 'accepted') {
      await Task.updateMany(
        { orderId: commerceOrderId, type: { $in: ['vendor-call', 'vendor-delay'] }, status: { $in: ['pending', 'in-progress', 'overdue'] } },
        { $set: { status: 'completed', outcome: 'Vendor Accepted', completedAt: new Date() } }
      );
    }

    if (orderStatus && orderStatus !== prevStatus) {
      const isCancel = orderStatus === 'Cancelled';
      const wasCancel = prevStatus === 'Cancelled';
      if (isCancel || wasCancel) {
        recoveryService.recordOrderRecovery({
          order: updated,
          isCancel,
          fromStatus: prevStatus,
          toStatus: orderStatus,
        }).catch((err) => console.error('Recovery record failed', err));
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
}

async function addOrderNote(req, res) {
  try {
    const { commerceOrderId } = req.params;
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Note content is required' } });
    }
    const order = await CommerceOrder.findOne({ commerceOrderId });
    if (!order) {
      return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    }
    const role = req.user?.role || 'staff';
    order.notes.push({ actor: role === 'admin' || role === 'super-admin' ? 'admin' : 'staff', actorName: req.user?.name || req.user?.email || 'staff', note: note.trim() });
    await order.save();
    res.json({ success: true, data: order.notes });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function syncAll(req, res) {
  try {
    const status = commerceSync.getSyncStatus();
    if (status.running) {
      return res.json({ success: true, data: { message: 'Sync already running', running: true } });
    }
    const result = await commerceSync.runSyncAll();
    res.json({ success: true, data: { ...result, running: false } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function resetCursor(req, res) {
  try {
    commerceSync.resetCursor();
    res.json({ success: true, data: { message: 'Sync cursor reset' } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function getSyncStatus(req, res) {
  try {
    res.json({ success: true, data: commerceSync.getSyncStatus() });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function getReturns(req, res) {
  try {
    const { stage = 'customer_response', search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (stage) query.workflowStage = stage;
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { externalReturnId: regex },
        { orderId: regex },
        { commerceOrderId: regex },
        { 'customerProfile.name': regex },
        { customerPhone: regex },
        { 'vendor.name': regex },
        { returnReason: regex },
      ];
    }
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [returns, total] = await Promise.all([
      OrderReturn.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      OrderReturn.countDocuments(query),
    ]);

    const [custCount, vendCount] = await Promise.all([
      OrderReturn.countDocuments({ workflowStage: 'customer_response' }),
      OrderReturn.countDocuments({ workflowStage: 'vendor_response' }),
    ]);

    res.json({
      success: true,
      data: {
        returns,
        total,
        page: pageNum,
        limit: limitNum,
        counts: {
          customer_response: custCount,
          vendor_response: vendCount,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function updateReturnStatus(req, res) {
  try {
    const { returnId } = req.params;
    const { customerResponseStatus, vendorResponseStatus } = req.body;
    const update = {};
    if (customerResponseStatus) {
      update.customerResponseStatus = customerResponseStatus;
      if (customerResponseStatus === 'confirmed') {
        update.workflowStage = 'vendor_response';
      } else if (customerResponseStatus === 'rejected') {
        update.workflowStage = 'completed';
      }
    }
    if (vendorResponseStatus) {
      update.vendorResponseStatus = vendorResponseStatus;
      if (['accepted', 'rejected'].includes(vendorResponseStatus)) {
        update.workflowStage = 'completed';
      }
    }

    const updated = await OrderReturn.findByIdAndUpdate(returnId, { $set: update }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Return not found' } });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function syncReturns(req, res) {
  try {
    const result = await commerceSync.syncOrderReturns();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

module.exports = {
  login,
  syncOrders,
  syncExternalNonHeavy,
  syncAll,
  resetCursor,
  getSyncStatus,
  getOrders,
  getSegmentCounts,
  getReviews,
  getOrderById,
  getOrderStatus,
  getOrderDetail,
  updateOrderPhone,
  updateOrderStatus,
  addOrderNote,
  getReturns,
  updateReturnStatus,
  syncReturns,
};
