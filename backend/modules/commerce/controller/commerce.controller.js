const axios = require('axios');
const commerceAuth = require('../service/commerce.auth.service');
const { commerceSync } = require('../service/commerce.sync.service');
const { CommerceOrder, Task } = require('../../../database/models');
const config = require('../../../config');
const { decodeBase64 } = require('../../../utils/decode');

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
    const { status, paymentStatus, vendor, customer, page, limit } = req.query;

    if (vendor) {
      if (!/^[a-zA-Z0-9\s\-_.,']+$/.test(vendor)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid vendor filter' },
        });
      }
    }

    if (customer) {
      if (!/^[a-zA-Z0-9\s\-_.,']+$/.test(customer)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid customer filter' },
        });
      }
    }

    const result = await commerceSync.getOrders({
      status,
      paymentStatus,
      vendor,
      customer,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.max(1, Math.min(100, parseInt(limit) || 20)),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
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

    const existing = await CommerceOrder.findOne({ commerceOrderId });

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

      const needsUpdate =
        existing.customerPhone !== decodedCustPhone ||
        existing.vendorPhone !== decodedVendPhone ||
        existing.customer !== decodedCustName ||
        existing.vendor !== decodedVendName;
      if (needsUpdate) {
        await CommerceOrder.findOneAndUpdate(
          { commerceOrderId },
          { $set: { customerPhone: decodedCustPhone, vendorPhone: decodedVendPhone, customer: decodedCustName, vendor: decodedVendName } }
        ).catch(() => {});
      }

      const cached = {
        ...raw,
        confirmationStatus: existing.confirmationStatus || 'pending',
        vendorStatus: existing.vendorStatus || 'unassigned',
        customer: existing.customer || decodedCustName,
        customerPhone: existing.customerPhone || decodedCustPhone,
        vendorName: existing.vendor || decodedVendName,
        vendorPhone: existing.vendorPhone || decodedVendPhone,
        customerProfile: { ...raw.customerProfile, phone: decodedCustPhone, name: decodedCustName, email: decodedCustEmail },
        vendor: { ...raw.vendor, phone: decodedVendPhone, name: decodedVendName, email: decodedVendEmail },
        externalDeliveryStatus: existing.externalDeliveryStatus,
        externalDeliveryEvent: existing.externalDeliveryEvent,
        orderType: existing.orderType,
        branch: existing.branch,
        sender: existing.sender,
        receiver: existing.receiver,
        destinationBranch: existing.destinationBranch,
        externalNonHeavyLogisticsId: existing.externalNonHeavyLogisticsId,
        pickupTicketId: existing.pickupTicketId,
        activeTaskId: activeTask?._id || null,
      };
      return res.json({ success: true, data: cached, cached: true });
    }

    // Uncached path: fetch from API, decode, store, return decoded
    const token = await commerceAuth.getToken();
    const response = await axios.get(
      `${config.commerceApiBase}/${commerceOrderId}`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );

    const richData = response.data;

    const decodedCustPhone = decodeBase64(richData.customerProfile?.phone);
    const decodedVendPhone = decodeBase64(richData.vendor?.phone);
    const decodedCustName = decodeBase64(richData.customerProfile?.name || richData.customer);
    const decodedVendName = decodeBase64(richData.vendor?.name || richData.vendor);
    const decodedCustEmail = decodeBase64(richData.customerProfile?.email);
    const decodedVendEmail = decodeBase64(richData.vendor?.email);

    await CommerceOrder.findOneAndUpdate(
      { commerceOrderId },
      {
        $set: {
          customer: decodedCustName,
          customerPhone: decodedCustPhone,
          vendor: decodedVendName,
          vendorPhone: decodedVendPhone,
          vendorInfo: richData.vendor || {},
          customerProfile: { ...richData.customerProfile, phone: decodedCustPhone, name: decodedCustName, email: decodedCustEmail },
          originBranch: richData.originBranch || {},
          destinationBranch: richData.destinationBranch || {},
          shippingType: richData.shippingType || '',
          dispatchMode: richData.dispatchMode || '',
          shippingAddress: richData.shippingAddress || {},
          deliveryChargeBreakdown: richData.deliveryChargeBreakdown || {},
          cancelledBy: richData.cancelledBy || '',
          cancelledReason: richData.cancelledReason || '',
          statusHistory: richData.statusHistory || [],
          items: (richData.items || []).map((item) => ({
            product: item.product || {},
            quantity: item.quantity || 0,
            price: item.price || 0,
            images: item.product?.productImages || [],
            variant: item.variant || {},
          })),
          rawApiData: richData,
          lastSyncedAt: new Date(),
        },
      }
    );

    // Return DECODED response
    const decodedResponse = {
      ...richData,
      confirmationStatus: 'pending',
      vendorStatus: 'unassigned',
      customer: decodedCustName,
      customerPhone: decodedCustPhone,
      vendorName: decodedVendName,
      vendorPhone: decodedVendPhone,
      customerProfile: { ...richData.customerProfile, phone: decodedCustPhone, name: decodedCustName, email: decodedCustEmail },
      vendor: { ...richData.vendor, phone: decodedVendPhone, name: decodedVendName, email: decodedVendEmail },
      externalDeliveryStatus: existing?.externalDeliveryStatus || null,
      externalDeliveryEvent: existing?.externalDeliveryEvent || null,
      orderType: existing?.orderType || null,
      branch: existing?.branch || null,
      sender: existing?.sender || null,
      receiver: existing?.receiver || null,
      destinationBranch: existing?.destinationBranch || null,
      externalNonHeavyLogisticsId: existing?.externalNonHeavyLogisticsId || null,
      pickupTicketId: existing?.pickupTicketId || null,
      activeTaskId: activeTask?._id || null,
    };
    res.json({ success: true, data: decodedResponse, cached: false });
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

    const key = type === 'customer' ? 'customerPhone' : 'vendorPhone';
    const updated = await CommerceOrder.findOneAndUpdate(
      { commerceOrderId },
      { [key]: phone },
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
      { [key === 'customerPhone' ? 'customerPhone' : 'vendorPhone']: phone }
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
    const { confirmationStatus, vendorStatus, orderStatus, note } = req.body;

    const update = {};
    if (confirmationStatus) update.confirmationStatus = confirmationStatus;
    if (vendorStatus) update.vendorStatus = vendorStatus;
    if (orderStatus) update.orderStatus = orderStatus;

    const historyEntry = {
      comment: note || `Status updated`,
      actorName: req.user?.name || 'staff',
      changedAt: new Date().toISOString(),
    };
    if (confirmationStatus) historyEntry.confirmationStatus = confirmationStatus;
    if (vendorStatus) historyEntry.vendorStatus = vendorStatus;
    if (orderStatus) historyEntry.orderStatus = orderStatus;

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
    order.notes.push({ actor: req.user?.name || 'staff', note: note.trim() });
    await order.save();
    res.json({ success: true, data: order.notes });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

module.exports = {
  login,
  syncOrders,
  syncExternalNonHeavy,
  getOrders,
  getOrderById,
  getOrderStatus,
  getOrderDetail,
  updateOrderPhone,
  updateOrderStatus,
  addOrderNote,
};