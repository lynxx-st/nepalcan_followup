const assert = require('assert');
const { bundleOf } = require('../modules/analytics/controller/analytics.controller');

assert.strictEqual(bundleOf('pending', 'unassigned', 'Pending'), 'pre-order');
assert.strictEqual(bundleOf('confirmed', 'unassigned', 'Pending'), 'processing');
assert.strictEqual(bundleOf('confirmed', 'accepted', 'Pending'), 'processing');
assert.strictEqual(bundleOf('confirmed', 'accepted', 'Delivered'), 'after-delivery');
assert.strictEqual(bundleOf('confirmed', 'accepted', 'Cancelled'), 'return');
assert.strictEqual(bundleOf('pending', 'rescheduled', 'Pending'), 'return');
assert.strictEqual(bundleOf('rescheduled', 'unassigned', 'Pending'), 'return');

require('../modules/analytics/routes/analytics.routes');
console.log('analytics bundleOf + routes OK');
