const assert = require('assert');
const { bundleOf, rangeFilter } = require('../modules/analytics/controller/analytics.controller');

assert.strictEqual(bundleOf('pending', 'unassigned', 'Pending'), 'pre-order');
assert.strictEqual(bundleOf('confirmed', 'unassigned', 'Pending'), 'processing');
assert.strictEqual(bundleOf('confirmed', 'accepted', 'Pending'), 'processing');
assert.strictEqual(bundleOf('confirmed', 'accepted', 'Delivered'), 'after-delivery');
assert.strictEqual(bundleOf('confirmed', 'accepted', 'Cancelled'), 'return');
assert.strictEqual(bundleOf('pending', 'rescheduled', 'Pending'), 'return');
assert.strictEqual(bundleOf('rescheduled', 'unassigned', 'Pending'), 'return');

assert.deepStrictEqual(rangeFilter({ query: {} }), {});
assert.deepStrictEqual(rangeFilter({}), {});
assert.deepStrictEqual(rangeFilter({ query: { from: 'garbage', to: 'also-garbage' } }), {});
const r = rangeFilter({ query: { from: '2026-08-01', to: '2026-08-07' } });
assert(r.createdAt.$gte instanceof Date && r.createdAt.$lte instanceof Date);
assert.strictEqual(r.createdAt.$gte.getHours(), 0);
assert.strictEqual(r.createdAt.$lte.getHours(), 23);
assert.strictEqual(r.createdAt.$lte.getMinutes(), 59);

require('../modules/analytics/routes/analytics.routes');
console.log('analytics bundleOf + rangeFilter + routes OK');
