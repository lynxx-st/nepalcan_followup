const assert = require('assert');
const { commerceSync } = require('../modules/commerce/service/commerce.sync.service.js');

const stage = (os, conf, vs, isOverdue = false) =>
  commerceSync.computeWorkflowStage({
    commerce: { orderStatus: os },
    customer: { confirmationStatus: conf },
    vendor: { vendorStatus: vs },
    isOverdue,
  });

// A Processing order is already handled — must never land in pending_confirmation.
assert.notStrictEqual(stage('Processing', 'pending', 'unassigned'), 'pending_confirmation');
assert.notStrictEqual(stage('Processing', 'confirmed', 'accepted'), 'pending_confirmation');
// Shipped orders must never land in pending_confirmation.
assert.strictEqual(stage('Shipped', 'pending', 'unassigned'), 'shipped');
assert.strictEqual(stage('Delivered', 'pending', 'unassigned'), 'delivered_followup');
// Only truly unconfirmed + pending orders belong in pending_confirmation.
assert.strictEqual(stage('Pending', 'pending', 'unassigned'), 'pending_confirmation');
// Customer follow-up accepted moves to 'done' (Marked Done inside pre processing).
assert.strictEqual(stage('Pending', 'confirmed', 'unassigned'), 'done');
// Only after BOTH customer and vendor are confirmed moves to 'confirmed_unprocessed'.
assert.strictEqual(stage('Pending', 'confirmed', 'accepted'), 'confirmed_unprocessed');

// Logistics API lacks orderStatus — infer it from delivery fields.
const infer = (ev, ds, fb) =>
  commerceSync.inferOrderStatusFromLogistics({ externalDeliveryEvent: ev, externalDeliveryStatus: ds }, fb);
assert.strictEqual(infer('order arrived', '', null), 'Shipped');
assert.strictEqual(infer('shipped', '', null), 'Shipped');
assert.strictEqual(infer('pickup_collected', '', null), 'Processing');
assert.strictEqual(infer('', '', 'Pending'), 'Pending');

console.log('commerce-sync-stage OK');
