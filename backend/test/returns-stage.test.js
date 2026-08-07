const assert = require('assert');
const { computeReturnStage } = require('../modules/commerce/controller/commerce.controller.js');

const s = (o) => computeReturnStage({ customerResponseStatus: 'pending', vendorResponseStatus: 'pending', followUpOrder: 'customer_first', ...o });

// Default order: customer first
assert.strictEqual(s({}), 'customer_response');

// Vendor-first order: pending goes to vendor response
assert.strictEqual(s({ followUpOrder: 'vendor_first' }), 'vendor_response');

// Customer confirmed -> next step is vendor, in either order
assert.strictEqual(s({ customerResponseStatus: 'confirmed' }), 'vendor_response');
assert.strictEqual(s({ followUpOrder: 'vendor_first', customerResponseStatus: 'confirmed' }), 'vendor_response');

// Terminal states
assert.strictEqual(s({ customerResponseStatus: 'rejected' }), 'completed');
assert.strictEqual(s({ vendorResponseStatus: 'accepted' }), 'completed');
assert.strictEqual(s({ vendorResponseStatus: 'rejected' }), 'completed');
assert.strictEqual(s({ followUpOrder: 'vendor_first', customerResponseStatus: 'confirmed', vendorResponseStatus: 'accepted' }), 'completed');

// Any-step editing: a completed return can be re-opened to pending
assert.strictEqual(s({ customerResponseStatus: 'pending', vendorResponseStatus: 'pending' }), 'customer_response');

console.log('returns-stage OK');
