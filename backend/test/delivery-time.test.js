const assert = require('assert');
const { deliveryMark } = require('../modules/commerce/service/commerce.sync.service.js');

const created = new Date('2026-08-01T10:00:00Z');
const now = new Date('2026-08-03T10:00:00Z'); // 48h later

// First Delivered transition: computes timeToDeliveryMs from anchor
let mark = deliveryMark({}, 'Delivered', created, now);
assert.deepStrictEqual(mark, { deliveredAt: now, timeToDeliveryMs: 48 * 3600000 });

// Preserves an existing deliveredAt (second delivery event is ignored)
mark = deliveryMark({ deliveredAt: new Date('2026-08-02T00:00:00Z') }, 'Delivered', created, now);
assert.strictEqual(mark, null);

// Non-Delivered status: no mark
mark = deliveryMark({}, 'Shipped', created, now);
assert.strictEqual(mark, null);

// Missing anchor: deliveredAt set, timeToDeliveryMs null
mark = deliveryMark({}, 'Delivered', null, now);
assert.deepStrictEqual(mark, { deliveredAt: now, timeToDeliveryMs: null });

console.log('delivery-time OK');
