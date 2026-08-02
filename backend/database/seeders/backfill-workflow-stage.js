const mongoose = require('mongoose');
require('dotenv').config();
const { connectDatabase } = require('../models');
const CommerceOrder = require('../models').CommerceOrder;

function computeWorkflowStage(order) {
  const cs = order.confirmationStatus || 'pending';
  const vs = order.vendorStatus || 'unassigned';
  const os = (order.orderStatus || '').toLowerCase();

  if (cs === 'pending' && os === 'pending') return 'pending_confirmation';
  if (cs === 'confirmed' && vs === 'accepted' && ['pending', 'processing'].includes(os)) return 'pending_review';
  if (cs === 'confirmed' && ['pending', ''].includes(os)) return 'confirmed_unprocessed';
  if (os === 'delivered') return 'delivered_followup';
  if (cs === 'confirmed') return 'done';
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