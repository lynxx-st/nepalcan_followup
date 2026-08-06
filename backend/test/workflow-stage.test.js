const assert = require('assert');
const { commerceSync } = require('../modules/commerce/service/commerce.sync.service.js');

const stageOf = (overrides) => {
  const base = {
    customer: { confirmationStatus: 'pending' },
    vendor: { vendorStatus: 'unassigned' },
    commerce: { orderStatus: 'Pending' },
  };
  return commerceSync.computeWorkflowStage({ ...base, ...overrides });
};

// Rescheduled takes priority (recorded in DB, shown in Rescheduled stage)
assert.strictEqual(stageOf({ customer: { confirmationStatus: 'rescheduled' } }), 'rescheduled');
assert.strictEqual(
  stageOf({ vendor: { vendorStatus: 'rescheduled' }, commerce: { orderStatus: 'Shipped' } }),
  'rescheduled'
);

// Customer confirmed only -> done (marked done in pre-processing)
assert.strictEqual(stageOf({ customer: { confirmationStatus: 'confirmed' } }), 'done');

// Both customer and vendor confirmed -> confirmed_unprocessed (awaiting pickup)
assert.strictEqual(
  stageOf({ customer: { confirmationStatus: 'confirmed' }, vendor: { vendorStatus: 'accepted' } }),
  'confirmed_unprocessed'
);
assert.strictEqual(stageOf({ commerce: { orderStatus: 'Processing' } }), 'confirmed_unprocessed');

// Shipped orders -> shipped stage
assert.strictEqual(stageOf({ commerce: { orderStatus: 'Shipped' } }), 'shipped');

// Delivered -> pending_review; fresh pending -> pending_confirmation
assert.strictEqual(stageOf({ commerce: { orderStatus: 'Delivered' } }), 'pending_review');
assert.strictEqual(stageOf({}), 'pending_confirmation');

console.log('workflow-stage OK');
