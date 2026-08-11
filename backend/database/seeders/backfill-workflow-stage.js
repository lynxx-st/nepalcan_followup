const mongoose = require('mongoose');
require('dotenv').config();
const { connectDatabase } = require('../models');
const CommerceOrder = require('../models').CommerceOrder;

function isOrderSlaBreached(order) {
  if (!order) return false;
  if (order.isOverdue || order.taskStatus === 'overdue' || order.slaBreached) return true;
  const dueAtStr = order.dueAt || order.activeTaskDueAt || order.slaDueAt;
  if (dueAtStr) return new Date() > new Date(dueAtStr);
  const refTime = order.customerCalledAt || order.workflowUpdatedAt || order.createdAt || order.externalUpdatedAt;
  if (refTime) {
    const elapsedMs = Date.now() - new Date(refTime).getTime();
    if (elapsedMs > 30 * 60 * 1000) return true;
  }
  return false;
}

function computeWorkflowStage(order) {
  const cs = order.confirmationStatus || order.customer?.confirmationStatus || 'pending';
  const vs = order.vendorStatus || order.vendor?.vendorStatus || 'unassigned';
  const os = (order.orderStatus || order.commerce?.orderStatus || '').toLowerCase();

  if (['rescheduled', 'no_answer', 'call_later'].includes(cs) || ['rescheduled', 'no_answer', 'call_later'].includes(vs)) return 'rescheduled';
  if (os === 'shipped') return 'shipped';
  if (['delivered', 'return delivered'].includes(os)) return 'delivered_followup';
  if (os === 'processing') return 'confirmed_unprocessed';

  if (cs === 'confirmed') {
    if (isOrderSlaBreached(order)) return 'confirmed_unprocessed';
    return 'done';
  }

  if (cs === 'pending' && os === 'pending') return 'pending_confirmation';
  return 'other';
}

function computeWorkflowPriority(order) {
  const { orderStatus, paymentStatus, paymentMethod, unAttendedCount, totalAmount } = order;
  let priority = 'medium';
  let taskType = 'customer-confirmation';

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

  if (unAttendedCount > 0) {
    if (priority === 'low') priority = 'medium';
    else if (priority === 'medium') priority = 'high';
    else if (priority === 'high') priority = 'critical';
  }

  if (totalAmount > 1000 && priority !== 'critical') {
    const levels = ['low', 'medium', 'high', 'critical'];
    const idx = levels.indexOf(priority);
    if (idx < levels.length - 1) priority = levels[idx + 1];
  }

  return priority;
}

async function backfill() {
  try {
    await connectDatabase(process.env.MONGO_URI || 'mongodb://localhost:27017/nepalcan_followup');
    console.log('Connected to database');

    const orders = await CommerceOrder.find({ workflowStage: { $exists: false } }).lean();
    console.log(`Found ${orders.length} orders without workflowStage`);

    let updated = 0;
    for (const order of orders) {
      const stage = computeWorkflowStage(order);
      const priority = computeWorkflowPriority(order);

      await CommerceOrder.updateOne(
        { _id: order._id },
        {
          $set: {
            workflowStage: stage,
            workflowPriority: priority,
            workflowUpdatedAt: order.externalUpdatedAt || order.updatedAt || new Date(),
          },
        }
      );
      updated++;
    }

    console.log(`Backfilled ${updated} orders`);

    // Verify counts
    const counts = await CommerceOrder.aggregate([
      { $group: { _id: '$workflowStage', count: { $sum: 1 } } },
    ]);
    console.log('Segment counts:', counts);

    await mongoose.disconnect();
    console.log('Done');
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  backfill();
}

module.exports = { backfill, computeWorkflowStage, computeWorkflowPriority };